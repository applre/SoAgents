export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string }
  | { type: 'skill'; name: string }
  | { type: 'image'; name: string; base64: string }
  | {
      type: 'tool_use';
      name: string;
      id: string;
      input?: string;       // JSON string，逐步累积
      result?: string;      // 执行结果
      status: 'running' | 'done' | 'error';
      isError?: boolean;
    };

/** 图片附件（前端 → 后端传输格式） */
export interface ChatImage {
  name: string;
  mimeType: string; // 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp'
  data: string;     // 纯 base64（不含 data: 前缀）
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  blocks: ContentBlock[];
  createdAt: number;
}
