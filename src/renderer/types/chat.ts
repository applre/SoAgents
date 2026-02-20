export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string }
  | { type: 'skill'; name: string }
  | {
      type: 'tool_use';
      name: string;
      id: string;
      input?: string;       // JSON string，逐步累积
      result?: string;      // 执行结果
      status: 'running' | 'done' | 'error';
      isError?: boolean;
    };

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  blocks: ContentBlock[];
  createdAt: number;
}
