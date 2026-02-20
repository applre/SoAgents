/**
 * 格式化 token 数量，自动转换为 K/M 单位
 * @param tokens - token 数量
 * @returns 格式化后的字符串，如 "1.2K", "3.5M"
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return tokens.toString();
}
