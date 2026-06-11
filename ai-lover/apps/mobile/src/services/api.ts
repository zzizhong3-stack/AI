import AsyncStorage from "@react-native-async-storage/async-storage";
import { Character, Conversation, Message, User } from "../types";

const BASE_URL = "http://8.130.68.47:3000/api/v1";

// ============================================================
// 用户身份管理
// ============================================================

const USER_ID_KEY = "@ai_lover_user_id";
const USER_NICKNAME_KEY = "@ai_lover_nickname";

export async function getStoredUserId(): Promise<string | null> {
  return AsyncStorage.getItem(USER_ID_KEY);
}

export async function getStoredNickname(): Promise<string | null> {
  return AsyncStorage.getItem(USER_NICKNAME_KEY);
}

/** 注册新用户，返回 user_id */
export async function registerUser(nickname: string): Promise<{ user_id: string; nickname: string }> {
  const res = await fetch(`${BASE_URL}/users/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname }),
  });
  if (!res.ok) throw new Error(`注册失败: ${res.status}`);
  const data = await res.json();
  // 存储到本地
  await AsyncStorage.setItem(USER_ID_KEY, data.user_id);
  await AsyncStorage.setItem(USER_NICKNAME_KEY, data.nickname);
  return data;
}

/** 退出登录（清除本地身份） */
export async function logout(): Promise<void> {
  await AsyncStorage.removeItem(USER_ID_KEY);
  await AsyncStorage.removeItem(USER_NICKNAME_KEY);
}

// ============================================================
// 通用请求（自动携带 x-user-id）
// ============================================================

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const userId = await getStoredUserId();
  const baseHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (userId) baseHeaders["x-user-id"] = userId;

  // 合并自定义 headers（不覆盖基础 headers）
  const customHeaders = (options?.headers as Record<string, string>) || {};
  const mergedHeaders = { ...baseHeaders, ...customHeaders };

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: mergedHeaders,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API Error ${res.status}: ${body}`);
  }
  return res.json();
}

// ============================================================
// 用户
// ============================================================

export async function getMe(): Promise<{ user: User }> {
  return request("/me");
}

export interface UserProfileData {
  preferences: Record<string, any>;
  facts: MemoryItem[];
  inferences: MemoryItem[];
  events: MemoryItem[];
  timeline: TimelineItem[];
  perspectives: PerspectiveItem[];
  corrections?: CorrectionItem[];
}

export interface PerspectiveItem {
  id: string;
  date: string;
  narrative: string;
  mood: string;
}

export interface CorrectionItem {
  id: string;
  oldBelief: string;
  newBelief: string;
  surfaced: number;
  createdAt: string;
}

export interface UsData {
  overview: {
    first_met: string | null;
    total_timeline_events: number;
    total_jinceia_perspectives: number;
    total_memories: number;
    total_conversations: number;
    call_name: string | null;
  };
  timeline: TimelineItem[];
  perspectives: PerspectiveItem[];
}

export interface MemoryItem {
  id: string;
  date: string;
  type: "fact" | "inference" | "preference" | "event" | "identity";
  source: "user_stated" | "assistant_inferred" | "system_defined";
  confidence: number;
  content: string;
  inference: string | null;
  topics: string;
  importance: number;
  status: "active" | "outdated" | "deprecated" | "corrected";
}

export interface TimelineItem {
  id: string;
  date: string;
  title: string;
  description: string;
  perspective: "user" | "jinceia" | "shared";
  type: "event" | "milestone" | "first_time";
}

export async function getMyProfile(): Promise<UserProfileData> {
  return request("/me/profile");
}

export async function getUsData(): Promise<UsData> {
  return request("/me/us");
}

// ============================================================
// 角色
// ============================================================

export async function getCharacters(): Promise<{ characters: Character[] }> {
  return request("/characters");
}

// ============================================================
// 对话
// ============================================================

export async function getConversations(): Promise<{
  conversations: Conversation[];
}> {
  return request("/conversations");
}

export async function createConversation(): Promise<{
  conversation_id: string;
}> {
  return request("/conversations", { method: "POST", body: "{}" });
}

export async function getMessages(
  conversationId: string
): Promise<{ messages: Message[] }> {
  return request(`/conversations/${conversationId}/messages`);
}

export async function deleteConversation(
  conversationId: string
): Promise<void> {
  await request(`/conversations/${conversationId}`, { method: "DELETE" });
}

// ============================================================
// 角色自定义
// ============================================================

export async function getCustomization(
  characterId: string
): Promise<{ custom_name: string | null; custom_avatar: string | null }> {
  return request(`/characters/${characterId}/customization`);
}

export async function updateCustomName(
  characterId: string,
  custom_name: string
): Promise<{ custom_name: string }> {
  return request(`/characters/${characterId}/customization`, {
    method: "PUT",
    body: JSON.stringify({ custom_name }),
  });
}

export async function uploadAvatar(
  characterId: string,
  avatar_base64: string
): Promise<{ avatar_url: string }> {
  return request(`/characters/${characterId}/avatar`, {
    method: "POST",
    body: JSON.stringify({ avatar_base64 }),
  });
}

// ============================================================
// 发送消息（SSE 流式）
// ============================================================

export async function* sendMessage(
  conversationId: string,
  content: string
): AsyncGenerator<
  | { type: "delta"; content: string }
  | { type: "done"; tokensUsed: number }
  | { type: "error"; message: string }
> {
  const userId = await getStoredUserId();

  // 60 秒超时，防止连接挂死
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  let res: Response;
  try {
    res = await fetch(
      `${BASE_URL}/conversations/${conversationId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(userId ? { "x-user-id": userId } : {}),
        },
        body: JSON.stringify({ content, content_type: "text" }),
        signal: controller.signal,
      }
    );
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      yield { type: "error", message: "请求超时，请重试" };
    } else {
      yield { type: "error", message: err.message || "网络错误" };
    }
    return;
  }

  clearTimeout(timeoutId);

  if (!res.ok) {
    yield { type: "error", message: `HTTP ${res.status}` };
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    yield { type: "error", message: "无法读取响应流" };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith("event: ")) {
        const eventType = line.slice(7);
        const dataLine = lines[i + 1];
        if (dataLine?.startsWith("data: ")) {
          try {
            const data = JSON.parse(dataLine.slice(6));
            if (eventType === "delta") {
              yield { type: "delta", content: data.content };
            } else if (eventType === "done") {
              yield { type: "done", tokensUsed: data.tokens_used };
            } else if (eventType === "error") {
              yield { type: "error", message: data.message };
            }
          } catch {}
        }
        i++;
      }
    }
  }
}
