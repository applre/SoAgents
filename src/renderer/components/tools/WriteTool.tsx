const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico']);

function getImagePreviewUrl(filePath: string): string | null {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  if (!IMAGE_EXTS.has(ext)) return null;
  // Tauri asset protocol: convert absolute path to asset://localhost/<path>
  return `asset://localhost${filePath}`;
}

interface Props { input: Record<string, unknown>; result?: string }
export default function WriteTool({ input, result }: Props) {
  const filePath = String(input.file_path ?? '');
  const previewUrl = result ? getImagePreviewUrl(filePath) : null;

  return (
    <div className="text-[var(--ink-secondary)]">
      <span className="font-mono">{filePath}</span>
      {result && <span className="ml-2 text-green-600">✓ 写入成功</span>}
      {previewUrl && (
        <div className="mt-2">
          <img
            src={previewUrl}
            alt={filePath.split('/').pop()}
            className="max-w-full max-h-64 rounded-lg border border-[var(--border)]"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      )}
    </div>
  );
}
