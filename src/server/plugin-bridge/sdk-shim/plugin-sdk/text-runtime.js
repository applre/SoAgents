// OpenClaw plugin-sdk/text-runtime shim for MyAgents Plugin Bridge
// Provides stripMarkdown() and text utilities.

/**
 * Strip Markdown formatting from text, leaving plain content.
 * Matches the real OpenClaw implementation:
 * - Removes bold, italic, strikethrough, headers, blockquotes, hr, inline code
 * - Collapses excessive newlines
 */
export function stripMarkdown(text) {
  if (!text || typeof text !== 'string') return '';
  let result = text;
  // Remove headers (# ... at start of line)
  result = result.replace(/^#{1,6}\s+/gm, '');
  // Remove bold (**text** or __text__)
  result = result.replace(/\*\*(.+?)\*\*/g, '$1');
  result = result.replace(/__(.+?)__/g, '$1');
  // Remove italic (*text* or _text_) — careful not to match ** or __ already removed
  result = result.replace(/\*([^\s*](?:.*?[^\s*])?)\*/g, '$1');
  result = result.replace(/(?<!\w)_([^\s_](?:.*?[^\s_])?)_(?!\w)/g, '$1');
  // Remove strikethrough (~~text~~)
  result = result.replace(/~~(.+?)~~/g, '$1');
  // Remove blockquotes (> at start of line)
  result = result.replace(/^>\s?/gm, '');
  // Remove horizontal rules (--- or *** or ___ on their own line)
  result = result.replace(/^[-*_]{3,}\s*$/gm, '');
  // Remove inline code (`code`)
  result = result.replace(/`([^`]+)`/g, '$1');
  // Collapse 3+ consecutive newlines to 2
  result = result.replace(/\n{3,}/g, '\n\n');
  return result.trim();
}
