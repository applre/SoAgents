/**
 * Lightweight MCP tool image content handler.
 *
 * Prevents oversized images from causing OOM or Claude API 400 errors.
 * Currently handles fast-reject for extremely large base64 payloads.
 * Full image decode/resize (jimp) can be added later if needed.
 */

/** Max base64 length before fast-reject (~48 MB decoded) */
const MAX_BASE64_LENGTH = 64 * 1024 * 1024;

type McpTextContent = { type: 'text'; text: string };
type McpContentBlock = { type: string; data?: string; mimeType?: string; text?: string; [key: string]: unknown };

/**
 * Check and sanitize oversized images in MCP tool result content blocks.
 * Returns a shallow-copied tool_response with stripped images, or null if unchanged.
 */
export async function resizeToolImageContent(
  toolResponse: unknown
): Promise<Record<string, unknown> | null> {
  if (
    typeof toolResponse !== 'object' ||
    toolResponse === null ||
    !Array.isArray((toolResponse as { content?: unknown }).content)
  ) {
    return null;
  }

  const originalContent = (toolResponse as { content: McpContentBlock[] }).content;
  const content = [...originalContent];
  let modified = false;

  for (let i = 0; i < content.length; i++) {
    const block = content[i];
    if (block.type !== 'image' || typeof block.data !== 'string') {
      continue;
    }

    // Fast-reject: strip extremely large payloads to prevent OOM
    if (block.data.length > MAX_BASE64_LENGTH) {
      console.warn(
        `[image-resize] Tool image block ${i} too large (${(block.data.length / 1024 / 1024).toFixed(1)} MB base64), replacing with text`
      );
      content[i] = { type: 'text', text: '[Image too large to process — stripped to prevent API error]' } as McpTextContent;
      modified = true;
    }
  }

  return modified ? { ...(toolResponse as object), content } : null;
}
