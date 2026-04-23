/**
 * Feishu Streaming Card Adapter
 *
 * Simplified local copy of the Feishu plugin's FeishuStreamingSession,
 * adapted for the Plugin Bridge environment:
 *   - Uses plain `fetch` instead of `fetchWithSsrFGuard`
 *   - Uses raw HTTP API calls instead of @larksuiteoapi/node-sdk Client
 *   - Inlines the FeishuDomain type
 *
 * Core flow: create card → send message → update content → close streaming
 */

type FeishuDomain = 'feishu' | 'lark' | (string & {});
type Credentials = { appId: string; appSecret: string; domain?: FeishuDomain };
type CardState = { cardId: string; messageId: string; sequence: number; currentText: string };

/** Optional header for streaming cards (title bar with color template) */
export type StreamingCardHeader = {
  title: string;
  /** Color template: blue, green, red, orange, purple, indigo, wathet, turquoise, yellow, grey, carmine, violet, lime */
  template?: string;
};

type StreamingStartOptions = {
  replyToMessageId?: string;
  replyInThread?: boolean;
  rootId?: string;
  header?: StreamingCardHeader;
};

// Token cache (keyed by domain + appId)
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

function resolveApiBase(domain?: FeishuDomain): string {
  if (domain === 'lark') {
    return 'https://open.larksuite.com/open-apis';
  }
  if (domain && domain !== 'feishu' && domain.startsWith('http')) {
    return `${domain.replace(/\/+$/, '')}/open-apis`;
  }
  return 'https://open.feishu.cn/open-apis';
}

async function getToken(creds: Credentials): Promise<string> {
  const key = `${creds.domain ?? 'feishu'}|${creds.appId}`;
  const cached = tokenCache.get(key);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }

  const resp = await fetch(`${resolveApiBase(creds.domain)}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: creds.appId, app_secret: creds.appSecret }),
  });
  if (!resp.ok) {
    throw new Error(`Token request failed with HTTP ${resp.status}`);
  }
  const data = (await resp.json()) as {
    code: number;
    msg: string;
    tenant_access_token?: string;
    expire?: number;
  };
  if (data.code !== 0 || !data.tenant_access_token) {
    throw new Error(`Token error: ${data.msg}`);
  }
  tokenCache.set(key, {
    token: data.tenant_access_token,
    expiresAt: Date.now() + (data.expire ?? 7200) * 1000,
  });
  return data.tenant_access_token;
}

function truncateSummary(text: string, max = 50): string {
  if (!text) return '';
  const clean = text.replace(/\n/g, ' ').trim();
  return clean.length <= max ? clean : clean.slice(0, max - 3) + '...';
}

export function mergeStreamingText(
  previousText: string | undefined,
  nextText: string | undefined,
): string {
  const previous = typeof previousText === 'string' ? previousText : '';
  const next = typeof nextText === 'string' ? nextText : '';
  if (!next) return previous;
  if (!previous || next === previous) return next;
  if (next.startsWith(previous)) return next;
  if (previous.startsWith(next)) return previous;
  if (next.includes(previous)) return next;
  if (previous.includes(next)) return previous;

  // Fallback: use `next` (the newer cumulative text from Rust).
  // The SDK's partial events carry the FULL accumulated text, so `next` is always
  // the authoritative latest version. Appending would duplicate content when the AI
  // reformats mid-stream (e.g., switches from **bold** markdown to plain text).
  return next;
}

/** Streaming card session manager (standalone, no SDK dependency) */
export class FeishuStreamingSession {
  private creds: Credentials;
  private state: CardState | null = null;
  private queue: Promise<void> = Promise.resolve();
  private closed = false;
  private log?: (msg: string) => void;
  private lastUpdateTime = 0;
  private pendingText: string | null = null;
  private updateThrottleMs = 500; // Throttle updates — Feishu API latency ~300ms per call

  constructor(creds: Credentials, log?: (msg: string) => void) {
    this.creds = creds;
    this.log = log;
  }

  /** Get the current card state (for external status queries) */
  getState(): { cardId: string; messageId: string; sequence: number; currentText: string } | null {
    return this.state ? { ...this.state } : null;
  }

  async start(
    receiveId: string,
    receiveIdType: 'open_id' | 'user_id' | 'union_id' | 'email' | 'chat_id' = 'chat_id',
    options?: StreamingStartOptions,
  ): Promise<void> {
    if (this.state) return;

    const apiBase = resolveApiBase(this.creds.domain);
    const token = await getToken(this.creds);

    const cardJson: Record<string, unknown> = {
      schema: '2.0',
      config: {
        streaming_mode: true,
        summary: { content: '[Generating...]' },
        streaming_config: { print_frequency_ms: { default: 50 }, print_step: { default: 1 } },
      },
      body: {
        elements: [{ tag: 'markdown', content: '\u23f3 Thinking...', element_id: 'content' }],
      },
    };
    if (options?.header) {
      cardJson.header = {
        title: { tag: 'plain_text', content: options.header.title },
        template: options.header.template ?? 'blue',
      };
    }

    // 1. Create card entity
    const createResp = await fetch(`${apiBase}/cardkit/v1/cards`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: 'card_json', data: JSON.stringify(cardJson) }),
    });
    if (!createResp.ok) {
      throw new Error(`Create card request failed with HTTP ${createResp.status}`);
    }
    const createData = (await createResp.json()) as {
      code: number;
      msg: string;
      data?: { card_id: string };
    };
    if (createData.code !== 0 || !createData.data?.card_id) {
      throw new Error(`Create card failed: ${createData.msg}`);
    }
    const cardId = createData.data.card_id;
    const cardContent = JSON.stringify({ type: 'card', data: { card_id: cardId } });

    // 2. Send message (create or reply)
    let sendData: { code: number; msg: string; data?: { message_id?: string } };

    if (options?.replyToMessageId) {
      // Reply mode
      const replyResp = await fetch(`${apiBase}/im/v1/messages/${options.replyToMessageId}/reply`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          msg_type: 'interactive',
          content: cardContent,
          ...(options.replyInThread ? { reply_in_thread: true } : {}),
        }),
      });
      if (!replyResp.ok) {
        throw new Error(`Reply message failed with HTTP ${replyResp.status}`);
      }
      sendData = (await replyResp.json()) as typeof sendData;
    } else {
      // Create mode (with optional root_id for threads)
      const createBody: Record<string, unknown> = {
        receive_id: receiveId,
        msg_type: 'interactive',
        content: cardContent,
      };
      if (options?.rootId) {
        createBody.root_id = options.rootId;
      }
      const msgResp = await fetch(`${apiBase}/im/v1/messages?receive_id_type=${receiveIdType}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createBody),
      });
      if (!msgResp.ok) {
        throw new Error(`Send message failed with HTTP ${msgResp.status}`);
      }
      sendData = (await msgResp.json()) as typeof sendData;
    }

    if (sendData.code !== 0 || !sendData.data?.message_id) {
      throw new Error(`Send card failed: ${sendData.msg}`);
    }

    this.state = { cardId, messageId: sendData.data.message_id, sequence: 1, currentText: '' };
    this.log?.(`Started streaming: cardId=${cardId}, messageId=${sendData.data.message_id}`);
  }

  private async updateCardContent(text: string, onError?: (error: unknown) => void): Promise<void> {
    if (!this.state) return;
    const apiBase = resolveApiBase(this.creds.domain);
    this.state.sequence += 1;
    try {
      const resp = await fetch(
        `${apiBase}/cardkit/v1/cards/${this.state.cardId}/elements/content/content`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${await getToken(this.creds)}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: text,
            sequence: this.state.sequence,
            uuid: `s_${this.state.cardId}_${this.state.sequence}`,
          }),
        },
      );
      if (!resp.ok) {
        onError?.(new Error(`Update card element failed with HTTP ${resp.status}`));
      }
    } catch (error) {
      onError?.(error);
    }
  }

  async update(text: string): Promise<void> {
    if (!this.state || this.closed) return;
    const mergedInput = mergeStreamingText(this.pendingText ?? this.state.currentText, text);
    if (!mergedInput || mergedInput === this.state.currentText) return;

    // Throttle: skip if updated recently, but remember pending text
    const now = Date.now();
    if (now - this.lastUpdateTime < this.updateThrottleMs) {
      this.pendingText = mergedInput;
      return;
    }
    this.pendingText = null;
    this.lastUpdateTime = now;

    this.queue = this.queue.then(async () => {
      if (!this.state || this.closed) return;
      const mergedText = mergeStreamingText(this.state.currentText, mergedInput);
      if (!mergedText || mergedText === this.state.currentText) return;
      this.state.currentText = mergedText;
      await this.updateCardContent(mergedText, (e) => this.log?.(`Update failed: ${String(e)}`));
    });
    await this.queue;
  }

  async close(finalText?: string): Promise<void> {
    if (!this.state || this.closed) return;
    this.closed = true;
    await this.queue;

    const pendingMerged = mergeStreamingText(this.state.currentText, this.pendingText ?? undefined);
    const text = finalText ? mergeStreamingText(pendingMerged, finalText) : pendingMerged;
    const apiBase = resolveApiBase(this.creds.domain);

    // Only send final update if content differs from what's already displayed
    if (text && text !== this.state.currentText) {
      await this.updateCardContent(text);
      this.state.currentText = text;
    }

    // Close streaming mode
    this.state.sequence += 1;
    try {
      const resp = await fetch(`${apiBase}/cardkit/v1/cards/${this.state.cardId}/settings`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${await getToken(this.creds)}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          settings: JSON.stringify({
            config: { streaming_mode: false, summary: { content: truncateSummary(text) } },
          }),
          sequence: this.state.sequence,
          uuid: `c_${this.state.cardId}_${this.state.sequence}`,
        }),
      });
      if (!resp.ok) {
        this.log?.(`Close request failed with HTTP ${resp.status}`);
      }
    } catch (e) {
      this.log?.(`Close failed: ${String(e)}`);
    }

    this.log?.(`Closed streaming: cardId=${this.state.cardId}`);
  }

  isActive(): boolean {
    return this.state !== null && !this.closed;
  }
}
