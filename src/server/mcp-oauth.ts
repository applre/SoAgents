/**
 * MCP OAuth 2.0 Client
 *
 * Implements OAuth 2.0 Authorization Code Flow with PKCE for MCP servers.
 * Supports:
 * - OAuth metadata discovery (RFC 8414 / MCP spec)
 * - PKCE code challenge (RFC 7636)
 * - Local callback server for receiving authorization codes
 * - Token exchange and refresh
 * - Token storage at ~/.soagents/mcp_oauth_tokens.json
 *
 * Flow:
 *   1. User clicks "Connect" → startOAuthFlow(serverId, serverUrl, config)
 *   2. Discovers OAuth metadata from /.well-known/oauth-authorization-server
 *   3. Generates PKCE code_verifier + code_challenge
 *   4. Starts local callback HTTP server on random port
 *   5. Returns authorization URL for browser redirect
 *   6. User authorizes → browser redirects to http://127.0.0.1:<port>/callback
 *   7. Callback server receives code → exchanges for token
 *   8. Token stored → callback server shut down
 */

import { createHash, randomBytes } from 'crypto';
import http from 'http';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

import type { McpOAuthConfig, McpOAuthToken } from '../shared/types/mcp';

// ===== Types =====

/** OAuth 2.0 Authorization Server Metadata (RFC 8414 subset) */
interface OAuthMetadata {
  issuer?: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
  scopes_supported?: string[];
  response_types_supported?: string[];
  code_challenge_methods_supported?: string[];
}

/** PKCE pair */
interface PKCEPair {
  codeVerifier: string;
  codeChallenge: string;
}

/** Pending OAuth flow state */
interface PendingOAuthFlow {
  serverId: string;
  serverUrl: string;
  config: McpOAuthConfig;
  metadata: OAuthMetadata;
  pkce: PKCEPair;
  callbackPort: number;
  callbackServer: http.Server;
  state: string;
  /** Resolve the flow promise */
  resolve: (token: McpOAuthToken | null) => void;
}

// ===== State =====

const TOKEN_FILE = join(homedir(), '.soagents', 'mcp_oauth_tokens.json');
const pendingFlows = new Map<string, PendingOAuthFlow>();

// ===== HTML Escaping =====

/** Escape HTML special characters to prevent XSS */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ===== Token Storage =====

function ensureDir(): void {
  const dir = join(homedir(), '.soagents');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/** Load all stored OAuth tokens */
export function loadOAuthTokens(): Record<string, McpOAuthToken> {
  try {
    if (!existsSync(TOKEN_FILE)) return {};
    const data = readFileSync(TOKEN_FILE, 'utf-8');
    return JSON.parse(data) as Record<string, McpOAuthToken>;
  } catch (err) {
    console.error('[mcp-oauth] Failed to load tokens:', err);
    return {};
  }
}

/** Save all OAuth tokens to disk */
function saveOAuthTokens(tokens: Record<string, McpOAuthToken>): void {
  try {
    ensureDir();
    writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2), { encoding: 'utf-8', mode: 0o600 });
  } catch (err) {
    console.error('[mcp-oauth] Failed to save tokens:', err);
  }
}

/** Get stored token for a specific MCP server */
export function getOAuthToken(serverId: string): McpOAuthToken | null {
  const tokens = loadOAuthTokens();
  return tokens[serverId] ?? null;
}

/** Delete stored token for a specific MCP server */
export function revokeOAuthToken(serverId: string): void {
  const tokens = loadOAuthTokens();
  delete tokens[serverId];
  saveOAuthTokens(tokens);
  console.log(`[mcp-oauth] Token revoked for ${serverId}`);
}

// ===== PKCE =====

/** Generate PKCE code_verifier and code_challenge (S256) */
function generatePKCE(): PKCEPair {
  // code_verifier: 43-128 chars of unreserved characters
  const codeVerifier = randomBytes(32).toString('base64url');

  // code_challenge: SHA-256 hash of verifier, base64url-encoded
  const codeChallenge = createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  return { codeVerifier, codeChallenge };
}

// ===== OAuth Metadata Discovery =====

/**
 * Discover OAuth metadata from MCP server.
 * Tries /.well-known/oauth-authorization-server first, falls back to server root.
 */
async function discoverOAuthMetadata(serverUrl: string): Promise<OAuthMetadata | null> {
  const url = new URL(serverUrl);
  const baseUrl = `${url.protocol}//${url.host}`;

  // Try well-known endpoint first
  const wellKnownUrl = `${baseUrl}/.well-known/oauth-authorization-server`;
  try {
    const response = await fetch(wellKnownUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (response.ok) {
      const metadata = await response.json() as OAuthMetadata;
      if (metadata.authorization_endpoint && metadata.token_endpoint) {
        console.log(`[mcp-oauth] Discovered OAuth metadata from ${wellKnownUrl}`);
        return metadata;
      }
    }
  } catch {
    // well-known not available, continue
  }

  return null;
}

// ===== Callback Server =====

/**
 * Start a local HTTP callback server to receive the OAuth authorization code.
 * Returns the port and a promise that resolves when the code is received.
 */
function startCallbackServer(
  serverId: string,
  onCode: (code: string, state: string) => void,
  onError: (error: string) => void,
): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://127.0.0.1`);

      if (url.pathname === '/callback') {
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error');

        if (error) {
          const desc = url.searchParams.get('error_description') || error;
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(buildCallbackHtml(false, `Authorization failed: ${escapeHtml(desc)}`));
          onError(desc);
          return;
        }

        if (code && state) {
          // Validate state before showing success — state is checked in the onCode handler,
          // but we validate here too to avoid showing "success" for state mismatches.
          const flow = pendingFlows.get(serverId);
          if (flow && state !== flow.state) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(buildCallbackHtml(false, 'Authorization failed: state parameter mismatch'));
            onError('State parameter mismatch');
            return;
          }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(buildCallbackHtml(true, 'Authorization successful! You can close this tab.'));
          onCode(code, state);
          return;
        }

        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Missing code or state parameter');
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    });

    server.on('error', (err) => {
      reject(new Error(`Callback server error: ${err.message}`));
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        console.log(`[mcp-oauth] Callback server for ${serverId} started on port ${addr.port}`);
        resolve({ server, port: addr.port });
      } else {
        reject(new Error('Failed to get callback server address'));
      }
    });
  });
}

/** Build a minimal HTML page for the OAuth callback response */
function buildCallbackHtml(success: boolean, message: string): string {
  const color = success ? '#22c55e' : '#ef4444';
  const icon = success ? '&#10003;' : '&#10007;';
  // message is already escaped by callers via escapeHtml()
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>SoAgents OAuth</title>
<style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0a0a0a;color:#e5e5e5}
.card{text-align:center;padding:2rem;border-radius:12px;background:#171717;border:1px solid #262626}
.icon{font-size:3rem;color:${color}}.msg{margin-top:1rem;font-size:1.1rem}</style></head>
<body><div class="card"><div class="icon">${icon}</div><div class="msg">${message}</div>
<p style="color:#737373;font-size:0.9rem;margin-top:1rem">You can close this tab now.</p></div></body></html>`;
}

// ===== Token Exchange =====

/** Exchange authorization code for access token */
async function exchangeCodeForToken(
  code: string,
  tokenUrl: string,
  clientId: string,
  clientSecret: string | undefined,
  codeVerifier: string,
  redirectUri: string,
): Promise<McpOAuthToken> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier,
  });
  if (clientSecret) {
    body.set('client_secret', clientSecret);
  }

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: body.toString(),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Token exchange failed (HTTP ${response.status}): ${text.slice(0, 200)}`);
  }

  const data = await response.json() as {
    access_token: string;
    token_type?: string;
    expires_in?: number;
    refresh_token?: string;
    scope?: string;
  };

  if (!data.access_token) {
    throw new Error('Token exchange response missing access_token');
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenType: data.token_type || 'Bearer',
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : 0,
    serverUrl: tokenUrl,
    clientId,
  };
}

// ===== Token Refresh =====

/**
 * Refresh an expired access token using the refresh token.
 * Returns the new token or null if refresh failed.
 */
export async function refreshOAuthToken(serverId: string): Promise<McpOAuthToken | null> {
  const tokens = loadOAuthTokens();
  const existing = tokens[serverId];
  if (!existing?.refreshToken) {
    console.warn(`[mcp-oauth] No refresh token for ${serverId}`);
    return null;
  }

  try {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: existing.refreshToken,
    });
    // RFC 6749 Section 6: public clients MUST include client_id on refresh
    if (existing.clientId) {
      body.set('client_id', existing.clientId);
    }

    const response = await fetch(existing.serverUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: body.toString(),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error(`[mcp-oauth] Token refresh failed for ${serverId}: HTTP ${response.status}`);
      return null;
    }

    const data = await response.json() as {
      access_token: string;
      token_type?: string;
      expires_in?: number;
      refresh_token?: string;
    };

    if (!data.access_token) return null;

    const newToken: McpOAuthToken = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || existing.refreshToken,
      tokenType: data.token_type || 'Bearer',
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : existing.expiresAt,
      serverUrl: existing.serverUrl,
      clientId: existing.clientId,
    };

    tokens[serverId] = newToken;
    saveOAuthTokens(tokens);
    console.log(`[mcp-oauth] Token refreshed for ${serverId}`);
    return newToken;
  } catch (err) {
    console.error(`[mcp-oauth] Token refresh error for ${serverId}:`, err);
    return null;
  }
}

// ===== Main OAuth Flow =====

/**
 * Start the OAuth 2.0 authorization flow for an MCP server.
 *
 * @returns Object with `authUrl` to open in browser, and `waitForToken` promise
 */
export async function startOAuthFlow(
  serverId: string,
  serverUrl: string,
  config: McpOAuthConfig,
  manualMetadata?: { authorizationUrl: string; tokenUrl: string },
): Promise<{ authUrl: string; waitForToken: Promise<McpOAuthToken | null> }> {
  // Cancel any existing flow for this server
  cancelOAuthFlow(serverId);

  // Discover or use manual metadata
  let metadata: OAuthMetadata;
  if (manualMetadata) {
    metadata = {
      authorization_endpoint: manualMetadata.authorizationUrl,
      token_endpoint: manualMetadata.tokenUrl,
    };
  } else {
    const discovered = await discoverOAuthMetadata(serverUrl);
    if (!discovered) {
      throw new Error('OAuth metadata not found. Please provide authorization and token URLs manually.');
    }
    metadata = discovered;
  }

  // Generate PKCE
  const pkce = generatePKCE();

  // Generate state parameter
  const state = randomBytes(16).toString('hex');

  // Start callback server and create token promise
  const tokenPromise = new Promise<McpOAuthToken | null>((resolveToken) => {
    startCallbackServer(
      serverId,
      // onCode
      async (code, receivedState) => {
        const flow = pendingFlows.get(serverId);
        if (!flow) {
          console.error(`[mcp-oauth] No pending flow for ${serverId}`);
          resolveToken(null);
          return;
        }

        // Validate state
        if (receivedState !== flow.state) {
          console.error(`[mcp-oauth] State mismatch for ${serverId}`);
          cleanupFlow(serverId);
          resolveToken(null);
          return;
        }

        try {
          const redirectUri = `http://127.0.0.1:${flow.callbackPort}/callback`;
          const token = await exchangeCodeForToken(
            code,
            flow.metadata.token_endpoint,
            flow.config.clientId,
            flow.config.clientSecret,
            flow.pkce.codeVerifier,
            redirectUri,
          );

          // Store token
          const tokens = loadOAuthTokens();
          tokens[serverId] = token;
          saveOAuthTokens(tokens);
          console.log(`[mcp-oauth] Token obtained and stored for ${serverId}`);

          cleanupFlow(serverId);
          resolveToken(token);
        } catch (err) {
          console.error(`[mcp-oauth] Token exchange failed for ${serverId}:`, err);
          cleanupFlow(serverId);
          resolveToken(null);
        }
      },
      // onError
      (error) => {
        console.error(`[mcp-oauth] OAuth error for ${serverId}: ${error}`);
        cleanupFlow(serverId);
        resolveToken(null);
      },
    ).then(({ server: srv, port: srvPort }) => {
      // Store flow state
      pendingFlows.set(serverId, {
        serverId,
        serverUrl,
        config,
        metadata,
        pkce,
        callbackPort: srvPort,
        callbackServer: srv,
        state,
        resolve: resolveToken,
      });
    }).catch((err: Error) => {
      console.error(`[mcp-oauth] Failed to start callback server: ${err.message}`);
      resolveToken(null);
    });
  });

  // Wait for callback server to be ready
  await new Promise<void>((resolve) => {
    const check = () => {
      if (pendingFlows.has(serverId)) {
        resolve();
      } else {
        setTimeout(check, 50);
      }
    };
    // Give it up to 3s to start
    setTimeout(() => resolve(), 3000);
    check();
  });

  const flow = pendingFlows.get(serverId);
  if (!flow) {
    throw new Error('Failed to start OAuth callback server');
  }

  // Build authorization URL
  const redirectUri = `http://127.0.0.1:${flow.callbackPort}/callback`;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: redirectUri,
    state,
    code_challenge: pkce.codeChallenge,
    code_challenge_method: 'S256',
  });
  if (config.scopes && config.scopes.length > 0) {
    params.set('scope', config.scopes.join(' '));
  }

  const authUrl = `${metadata.authorization_endpoint}?${params.toString()}`;
  console.log(`[mcp-oauth] OAuth flow started for ${serverId}, auth URL ready`);

  // Auto-cleanup after 5 minutes (flow timeout)
  setTimeout(() => {
    if (pendingFlows.has(serverId)) {
      console.warn(`[mcp-oauth] OAuth flow timed out for ${serverId}`);
      const timedOutFlow = pendingFlows.get(serverId);
      timedOutFlow?.resolve(null); // Resolve hanging promise
      cleanupFlow(serverId);
    }
  }, 5 * 60 * 1000);

  return { authUrl, waitForToken: tokenPromise };
}

/** Cancel a pending OAuth flow */
export function cancelOAuthFlow(serverId: string): void {
  const flow = pendingFlows.get(serverId);
  if (flow) {
    flow.resolve(null); // Resolve hanging promise before cleanup
    cleanupFlow(serverId);
  }
}

/** Clean up flow resources */
function cleanupFlow(serverId: string): void {
  const flow = pendingFlows.get(serverId);
  if (flow) {
    try { flow.callbackServer.close(); } catch { /* noop */ }
    pendingFlows.delete(serverId);
  }
}

// ===== Token Validation =====

/**
 * Get a valid access token for an MCP server.
 * Attempts to refresh if expired.
 * Returns null if no token or refresh fails.
 */
export async function getValidOAuthToken(serverId: string): Promise<string | null> {
  const token = getOAuthToken(serverId);
  if (!token) return null;

  // Check expiry (with 60s buffer)
  if (token.expiresAt && token.expiresAt < Date.now() + 60000) {
    console.log(`[mcp-oauth] Token expired or expiring soon for ${serverId}, attempting refresh`);
    const refreshed = await refreshOAuthToken(serverId);
    return refreshed?.accessToken ?? null;
  }

  return token.accessToken;
}

/**
 * Get the OAuth status for an MCP server.
 */
export function getOAuthStatus(serverId: string): 'disconnected' | 'connecting' | 'connected' | 'expired' {
  if (pendingFlows.has(serverId)) return 'connecting';

  const token = getOAuthToken(serverId);
  if (!token) return 'disconnected';

  if (token.expiresAt && token.expiresAt < Date.now()) return 'expired';

  return 'connected';
}
