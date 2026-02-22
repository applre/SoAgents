const CLICK_THRESHOLD = 5;
const WINDOW_MS = 10_000;

let clickTimestamps: number[] = [];
let unlocked = false;

export function isDeveloperMode(): boolean {
  return unlocked;
}

/**
 * 记录一次点击并判断是否达到解锁条件。
 * 返回 true 表示本次点击触发了解锁。
 */
export function recordDeveloperClick(): boolean {
  if (unlocked) return false;

  const now = Date.now();
  clickTimestamps.push(now);

  // 只保留窗口期内的点击
  clickTimestamps = clickTimestamps.filter((t) => now - t < WINDOW_MS);

  if (clickTimestamps.length >= CLICK_THRESHOLD) {
    unlocked = true;
    clickTimestamps = [];
    return true;
  }
  return false;
}
