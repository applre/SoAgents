export function createPluginRuntimeStore(): {
  get(key: string): any;
  set(key: string, value: any): void;
  delete(key: string): void;
  has(key: string): boolean;
  clear(): void;
};

export function registerChannelPlugin(...args: any[]): any;
export function createChannelPluginFromModule(...args: any[]): any;
