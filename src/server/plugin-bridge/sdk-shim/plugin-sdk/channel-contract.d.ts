export interface ChannelAccountSnapshot {
  accountId: string;
  name?: string;
  enabled?: boolean;
  configured?: boolean;
  linked?: boolean;
  running?: boolean;
  connected?: boolean;
  restartPending?: boolean;
  reconnectAttempts?: number;
  lastConnectedAt?: number | null;
  lastDisconnect?: string | { at: number; status?: number; error?: string; loggedOut?: boolean } | null;
  lastMessageAt?: number | null;
  lastEventAt?: number | null;
  lastError?: string | null;
  healthState?: string;
  lastStartAt?: number | null;
  lastStopAt?: number | null;
  lastInboundAt?: number | null;
  lastOutboundAt?: number | null;
  busy?: boolean;
  activeRuns?: number;
  lastRunActivityAt?: number | null;
  mode?: string;
  dmPolicy?: string;
  allowFrom?: string[];
  tokenSource?: string;
  botTokenSource?: string;
  appTokenSource?: string;
  [key: string]: any;
}

export interface ChannelGroupContext {
  groupId: string;
  groupName?: string;
  [key: string]: any;
}

export interface ChannelMessageActionContext {
  [key: string]: any;
}

export interface ChannelThreadingContext {
  threadId?: string | number;
  [key: string]: any;
}
