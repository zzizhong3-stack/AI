// ===== 角色 =====
export interface Character {
  id: string;
  name: string;
  default_name?: string;
  custom_name?: string | null;
  gender: "male" | "female";
  personality: string;
  tags: string[];
  avatar_url?: string | null;
  backstory?: string;
  chat_count?: number;
}

// ===== 对话 =====
export interface Conversation {
  id: string;
  user_id: string;
  character_id: string;
  title: string;
  last_message?: string;
  message_count: number;
  character_name: string;
  character_avatar?: string;
  updated_at: string;
}

// ===== 消息 =====
export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  tokens_used: number;
  created_at: string;
}

// ===== 用户 =====
export interface User {
  id: string;
  nickname: string;
  avatar_url?: string;
}

// ===== SSE 事件 =====
export interface SSEDeltaEvent {
  content: string;
}

export interface SSEDoneEvent {
  message_id: string;
  tokens_used: number;
}

export interface SSEErrorEvent {
  code: string;
  message: string;
}
