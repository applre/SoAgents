/**
 * 格式化文件大小（字节）为人类可读格式
 * @param bytes 文件大小（字节）
 * @returns 格式化后的字符串，如 "1.2 KB", "3.4 MB"
 */
export function formatSize(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1000 * 1000) return `${Math.round(bytes / 1000)} KB`;
  return `${(bytes / (1000 * 1000)).toFixed(1)} MB`;
}
