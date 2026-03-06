const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico']);

/** 从 bash 命令字符串里提取可能写出的图片文件路径（绝对路径） */
function extractImagePath(command: string): string | null {
  // 匹配 > /abs/path/to/file.ext 或 -o /abs/path 或最后一个参数是绝对路径图片
  const patterns = [
    />\s*(\S+)/g,               // 重定向输出
    /-o\s+(\S+)/g,              // -o 输出参数（convert/ffmpeg 等）
    /(?:^|\s)(\/[^\s]+)/g,      // 任意绝对路径参数
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(command)) !== null) {
      const p = m[1];
      const ext = p.split('.').pop()?.toLowerCase() ?? '';
      if (IMAGE_EXTS.has(ext)) return p;
    }
  }
  return null;
}

interface Props { input: Record<string, unknown>; result?: string }

export default function BashTool({ input, result }: Props) {
  const command = String(input.command ?? '');
  const lines = result?.split('\n') ?? [];
  const preview = lines.slice(0, 20).join('\n');
  const truncated = lines.length > 20;

  // 只在命令执行成功后才尝试预览（result 存在且不是错误）
  const imagePath = result ? extractImagePath(command) : null;
  const previewUrl = imagePath ? `asset://localhost${imagePath}` : null;

  return (
    <div className="space-y-1">
      <div className="font-mono text-[var(--ink-secondary)]">
        <span className="text-[var(--ink-tertiary)]">$ </span>{command}
      </div>
      {result && (
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded bg-[var(--paper)] p-1.5 font-mono text-[var(--ink-secondary)]">
          {preview}{truncated && '\n...'}
        </pre>
      )}
      {previewUrl && (
        <img
          src={previewUrl}
          alt={imagePath?.split('/').pop()}
          className="mt-1 max-w-full max-h-64 rounded-lg border border-[var(--border)]"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      )}
    </div>
  );
}
