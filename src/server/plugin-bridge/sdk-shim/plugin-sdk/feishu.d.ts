// Type declarations for openclaw/plugin-sdk/feishu shim

// ===== Type-only exports (no runtime implementation needed) =====
export interface HistoryEntry { [key: string]: any; }
export interface ReplyPayload { text?: string; mediaUrl?: string; mediaUrls?: string[]; [key: string]: any; }
export interface AllowlistMatch { [key: string]: any; }
export interface ChannelOnboardingAdapter { [key: string]: any; }
export type ChannelOnboardingDmPolicy = 'open' | 'pairing' | 'allowlist' | 'disabled';
export interface BaseProbeResult { [key: string]: any; }
export interface ChannelGroupContext { [key: string]: any; }
export interface ChannelMeta { [key: string]: any; }
export interface ChannelOutboundAdapter { [key: string]: any; }
export interface ChannelPlugin { [key: string]: any; }
export interface ClawdbotConfig { [key: string]: any; }
export type OpenClawConfig = ClawdbotConfig;
export type DmPolicy = 'open' | 'pairing' | 'allowlist' | 'disabled';
export interface GroupToolPolicyConfig { [key: string]: any; }
export interface SecretInput { [key: string]: any; }
export interface PluginRuntime { channel: any; [key: string]: any; }
export interface AnyAgentTool { name: string; description: string; execute: (...args: any[]) => any; [key: string]: any; }
export interface OpenClawPluginApi { registerChannel(plugin: any): void; registerTool(tool: any, opts?: any): void; config: any; logger: any; runtime: any; [key: string]: any; }
export interface RuntimeEnv { [key: string]: any; }
export interface WizardPrompter { confirm: any; text: any; select: any; note: any; [key: string]: any; }

// ===== Runtime exports =====
export declare const DEFAULT_GROUP_HISTORY_LIMIT: 50;
export declare const DEFAULT_ACCOUNT_ID: string;
export declare const PAIRING_APPROVED_MESSAGE: string;
export declare const WEBHOOK_RATE_LIMIT_DEFAULTS: Readonly<{ windowMs: number; maxRequests: number; maxTrackedKeys: number }>;
export declare const WEBHOOK_ANOMALY_COUNTER_DEFAULTS: Readonly<{ maxTrackedKeys: number; ttlMs: number; logEvery: number }>;

export declare function buildPendingHistoryContextFromMap(params: { currentMessage: string; [key: string]: any }): string;
export declare function clearHistoryEntriesIfEnabled(params: any): void;
export declare function recordPendingHistoryEntryIfEnabled(params: any): any[];
export declare function logTypingFailure(params: any): void;
export declare function buildSingleChannelSecretPromptState(params: any): any;
export declare function addWildcardAllowFrom(allowFrom?: any[]): string[];
export declare function mergeAllowFromEntries(current: any, additions: any[]): string[];
export declare function promptSingleChannelSecretInput(params: any): Promise<{ action: string; value?: string }>;
export declare function setTopLevelChannelAllowFrom(params: any): any;
export declare function setTopLevelChannelDmPolicyWithAllowFrom(params: any): any;
export declare function setTopLevelChannelGroupPolicy(params: any): any;
export declare function splitOnboardingEntries(raw: string): string[];
export declare function createReplyPrefixContext(params: any): any;
export declare function createTypingCallbacks(params: any): { onReplyStart: () => Promise<void>; onIdle: () => void; onCleanup: () => void };
export declare function resolveAllowlistProviderRuntimeGroupPolicy(params: any): any;
export declare function resolveDefaultGroupPolicy(cfg: any): any;
export declare function resolveOpenProviderRuntimeGroupPolicy(params: any): any;
export declare function warnMissingProviderGroupPolicyFallbackOnce(params: any): boolean;
export declare function hasConfiguredSecretInput(value: unknown, defaults?: any): boolean;
export declare function normalizeResolvedSecretInputString(params: any): string | undefined;
export declare function normalizeSecretInputString(value: unknown): string | undefined;
export declare function buildSecretInputSchema(): any;
export declare function createDedupeCache(options?: any): { check(key: string, now?: number): boolean; peek(key: string, now?: number): boolean; delete(key: string): void; clear(): void; size(): number };
export declare function installRequestBodyLimitGuard(req: any, res: any, options: any): { dispose(): void; isTripped(): boolean; code(): any };
export declare function readJsonBodyWithLimit(req: any, options: any): Promise<{ ok: boolean; value: any; error?: string }>;
export declare function fetchWithSsrFGuard(opts: { url: string; init?: RequestInit }): Promise<{ response: Response; release: () => Promise<void> }>;
export declare function emptyPluginConfigSchema(): any;
export declare function normalizeAgentId(value: string | null | undefined): string;
export declare function formatDocsLink(path: string, label?: string): string;
export declare function evaluateSenderGroupAccessForPolicy(...args: any[]): { allowed: boolean };
export declare function buildAgentMediaPayload(mediaList: any[]): any;
export declare function readJsonFileWithFallback<T>(filePath: string, fallback: T): Promise<{ value: T; exists: boolean }>;
export declare function createScopedPairingAccess(params: any): any;
export declare function issuePairingChallenge(params: any): Promise<{ created: boolean; code?: string }>;
export declare function createPersistentDedupe(options: any): { checkAndRecord(key: string): Promise<boolean>; warmup(): Promise<number>; clearMemory(): void; memorySize(): number };
export declare function createDefaultChannelRuntimeState(accountId: string, extra?: any): any;
export declare function buildBaseChannelStatusSummary(snapshot: any): any;
export declare function buildProbeChannelStatusSummary(snapshot: any, extra?: any): any;
export declare function buildRuntimeAccountStatusSnapshot(params: any): any;
export declare function createFixedWindowRateLimiter(options?: any): { isRateLimited(key: string): boolean; size(): number; clear(): void };
export declare function createWebhookAnomalyTracker(options?: any): { record(params: any): number; size(): number; clear(): void };
export declare function applyBasicWebhookRequestGuards(params: any): boolean;
export declare function withTempDownloadPath<T>(ext: string, callback: (filePath: string) => Promise<T>): Promise<T>;
