// OpenClaw plugin system — shared types between Rust and frontend.
//
// Source of truth: src-tauri/src/openclaw/mod.rs.
// Kept in sync manually — if you add fields here, add them there too.

/**
 * One installed OpenClaw plugin (npm package under ~/.soagents/openclaw-plugins/<pluginId>/).
 * Returned by `cmd_list_openclaw_plugins` and `cmd_install_openclaw_plugin`.
 */
export interface InstalledPlugin {
  /** Plugin ID (matches the key the plugin registers via registerChannel()). */
  pluginId: string;

  /** Absolute path to the plugin install directory. */
  installDir: string;

  /** Original npm spec used to install (e.g. "@sliverp/qqbot", "@sliverp/qqbot@1.2.0"). */
  npmSpec: string;

  /** Parsed plugin manifest (from package.json "openclaw" field + configSchema).
   *  Null when manifest can't be read or parsed. */
  manifest: PluginManifest | null;

  /** Installed version (from package.json "version"). */
  packageVersion?: string;

  /** Homepage URL (from package.json "homepage"). */
  homepage?: string;

  /** Required config field keys extracted from manifest.configSchema.required.
   *  Used by the wizard to generate input fields. */
  requiredFields?: string[];

  /** Whether the plugin's gateway exposes loginWithQrStart() — detected at load time. */
  supportsQrLogin?: boolean;

  /** Optional compat warning if plugin was loaded with known caveats. */
  compatWarning?: string;
}

export interface PluginManifest {
  id?: string;
  name?: string;
  description?: string;
  channels?: string[];
  configSchema?: PluginConfigSchema;
}

export interface PluginConfigSchema {
  type: 'object';
  properties: Record<string, PluginConfigProperty>;
  required?: string[];
}

export interface PluginConfigProperty {
  type?: 'string' | 'boolean' | 'number';
  description?: string;
  default?: string | number | boolean;
  /** If set, the field should be rendered as a masked input (password / secret). */
  secret?: boolean;
}

/**
 * Result of QR login flow from Plugin Bridge.
 * Returned by `cmd_plugin_qr_login_start`.
 */
export interface PluginQrLoginStartResult {
  /** Data URL (image/png base64) to render as <img src=...>. */
  qrDataUrl: string;
  /** Opaque session key — pass back into qr-login-wait. */
  sessionKey: string;
  /** Expected TTL of the QR code in seconds (client should refresh after this). */
  expiresInSec?: number;
}

export interface PluginQrLoginWaitResult {
  /** Whether scan completed successfully. */
  connected: boolean;
  /** Stable ID of the logged-in account (e.g. WeChat wxid). Present when connected=true. */
  accountId?: string;
  /** Optional error string when connected=false. */
  error?: string;
}

/**
 * WeCom QR flow — creates a smart-bot on work.weixin.qq.com and returns its
 * botId/secret. Independent of the Plugin Bridge; used by the ChannelWizard's
 * dualConfig "scan to create" path.
 */
export interface WecomQrGenerateResult {
  scode: string;
  authUrl: string;
}

export interface WecomQrPollResult {
  status: 'waiting' | 'success' | 'expired';
  botId?: string;
  secret?: string;
}
