export interface OpenClawPluginApi {
  registerChannel(plugin: any): void;
  config: any;
  logger: any;
}

export interface OpenClawConfig {
  [key: string]: any;
}

export interface ChannelPlugin {
  id: string;
  name: string;
  gateway: any;
  [key: string]: any;
}

export interface PluginRuntime {
  channel: any;
  [key: string]: any;
}

export function emptyPluginConfigSchema(): any;
export function applyAccountNameToChannelSection(config: any, section: string, name: string): any;
export function deleteAccountFromConfigSection(config: any, section: string): any;
export function setAccountEnabledInConfigSection(config: any, section: string, enabled: boolean): any;
