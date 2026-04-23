export interface ChannelPlugin {
  id: string;
  name: string;
  gateway: any;
  [key: string]: any;
}

export interface OpenClawConfig {
  channels?: Record<string, any>;
  [key: string]: any;
}

export interface PluginRuntime {
  version?: string;
  channel: any;
  config: any;
  logging: any;
  system: any;
  [key: string]: any;
}

export interface OpenClawPluginApi {
  registerChannel(plugin: any): void;
  config: any;
  logger: any;
  runtime: any;
}

export function defineChannelPluginEntry(params: {
  id: string;
  name: string;
  description: string;
  plugin: any;
  configSchema?: any;
  setRuntime?: (runtime: PluginRuntime) => void;
  registerFull?: (api: OpenClawPluginApi) => void;
}): any;

export function createChatChannelPlugin(params: {
  base: any;
  security?: any;
  pairing?: any;
  threading?: any;
  outbound?: any;
}): ChannelPlugin;

export function createChannelPluginBase(params: any): any;
export function buildChannelOutboundSessionRoute(params: any): any;
export function stripChannelTargetPrefix(raw: string, ...providers: string[]): string;
export function stripTargetKindPrefix(raw: string): string;
export { normalizeAccountId, DEFAULT_ACCOUNT_ID } from './account-id';
