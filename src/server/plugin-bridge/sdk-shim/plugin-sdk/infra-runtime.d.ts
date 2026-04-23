export interface FileLockOptions {
  retries?: {
    retries: number;
    factor?: number;
    minTimeout?: number;
    maxTimeout?: number;
    randomize?: boolean;
  };
  stale?: number;
}

export interface FileLockHandle {
  lockPath: string;
  release(): Promise<void>;
}

export function resolvePreferredOpenClawTmpDir(options?: any): string;
export function withFileLock<T>(filePath: string, options: FileLockOptions, fn: () => Promise<T>): Promise<T>;
export function acquireFileLock(filePath: string, options: FileLockOptions): Promise<FileLockHandle>;
