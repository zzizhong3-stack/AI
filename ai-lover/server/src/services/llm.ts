import OpenAI from "openai";
import { config } from "../config/index.js";

// 加载 Jinceia 系统提示词
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const systemPrompt = fs.readFileSync(
  path.join(__dirname, "..", "prompts", "jinceia-system-prompt.md"),
  "utf-8"
);

const client = new OpenAI({
  apiKey: config.nexusApiKey,
  baseURL: config.nexusBaseUrl,
  timeout: 30000,
  maxRetries: 1,
});

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * 发送消息给 Jinceia，返回流式响应
 *
 * @param userMessage 用户消息
 * @param history 历史消息
 * @param memoryContext 记忆上下文（由 memory.ts 的 buildMemoryContext 生成）
 */
export async function* chatWithJinceia(
  userMessage: string,
  history: ChatMessage[] = [],
  memoryContext: string = ""
): AsyncGenerator<
  { type: "delta"; content: string } | { type: "done"; tokensUsed: number }
> {
  // 构建完整系统提示词 — 注入记忆上下文
  let fullSystemPrompt = systemPrompt;

  if (memoryContext) {
    fullSystemPrompt = systemPrompt.replace(
      "<!-- {{MEMORY_CONTEXT}} -->",
      memoryContext
    );
  } else {
    fullSystemPrompt = systemPrompt.replace("<!-- {{MEMORY_CONTEXT}} -->", "");
  }

  fullSystemPrompt = fullSystemPrompt.replace("<!-- {{RECENT_CHAT}} -->", "");

  // 构建消息列表（OpenAI 格式：system + history + 当前消息）
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: fullSystemPrompt },
    ...history.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
    { role: "user", content: userMessage },
  ];

  const stream = await client.chat.completions.create({
    model: config.nexusModel,
    messages,
    stream: true,
    max_tokens: 1024,
  });

  let tokensUsed = 0;

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      yield { type: "delta", content: delta };
    }
    // 最后一个 chunk 通常有 usage 信息
    if (chunk.choices[0]?.finish_reason) {
      // 估算总 token 数：system + history + user，加上响应估算
      const historyChars = history.reduce((sum, m) => sum + m.content.length, 0);
      const totalInputChars = fullSystemPrompt.length + historyChars + userMessage.length;
      // 中文约 1 字/1.5 token，英文约 4 字/1 token，取折中 2 字/1 token
      // 响应估算：输入 30% 的长度（对话类通常响应较短）
      tokensUsed = Math.ceil(totalInputChars / 2 * 1.3);
    }
  }

  yield { type: "done", tokensUsed };
}
