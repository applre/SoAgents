export interface CommandAuthorizer {
  configured: boolean;
  allowed: boolean;
}

export interface CommandAuthorizationRuntime {
  shouldComputeCommandAuthorized: (rawBody: string, cfg: any) => boolean;
  resolveCommandAuthorizedFromAuthorizers: (params: {
    useAccessGroups: boolean;
    authorizers: CommandAuthorizer[];
  }) => boolean;
}

export function resolveControlCommandGate(params: {
  useAccessGroups: boolean;
  authorizers: CommandAuthorizer[];
  allowTextCommands: boolean;
  hasControlCommand: boolean;
  modeWhenAccessGroupsOff?: string;
}): { commandAuthorized: boolean; shouldBlock: boolean };

export function resolveDualTextControlCommandGate(params: {
  useAccessGroups: boolean;
  primaryConfigured: boolean;
  primaryAllowed: boolean;
  secondaryConfigured: boolean;
  secondaryAllowed: boolean;
  hasControlCommand: boolean;
  modeWhenAccessGroupsOff?: string;
}): { commandAuthorized: boolean; shouldBlock: boolean };

export function resolveCommandAuthorizedFromAuthorizers(params: {
  useAccessGroups: boolean;
  authorizers: CommandAuthorizer[];
  modeWhenAccessGroupsOff?: string;
}): boolean;

export function resolveDirectDmAuthorizationOutcome(params: {
  isGroup: boolean;
  dmPolicy: string;
  senderAllowedForCommands: boolean;
}): 'disabled' | 'unauthorized' | 'allowed';

export function resolveSenderCommandAuthorizationWithRuntime(params: {
  cfg: any;
  rawBody: string;
  isGroup: boolean;
  dmPolicy: string;
  configuredAllowFrom: string[];
  configuredGroupAllowFrom?: string[];
  senderId: string;
  isSenderAllowed: (senderId: string, allowFrom: string[]) => boolean;
  readAllowFromStore: () => Promise<string[]>;
  runtime: CommandAuthorizationRuntime;
}): Promise<{
  shouldComputeAuth: boolean;
  effectiveAllowFrom: string[];
  effectiveGroupAllowFrom: string[];
  senderAllowedForCommands: boolean;
  commandAuthorized: boolean | undefined;
}>;

export function resolveSenderCommandAuthorization(params: any): Promise<{
  shouldComputeAuth: boolean;
  effectiveAllowFrom: string[];
  effectiveGroupAllowFrom: string[];
  senderAllowedForCommands: boolean;
  commandAuthorized: boolean | undefined;
}>;

export function shouldComputeCommandAuthorized(rawBody: string, cfg: any): boolean;
export function createCommandAuthorizationRuntime(): CommandAuthorizationRuntime;
