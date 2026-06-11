import { Router, Request, Response } from "express";
import { v4 as uuid } from "uuid";
import dbOps from "../db/index.js";
import {
  getOrCreateJinceia,
  createConversation,
  getConversations,
  getMessages,
  saveMessage,
} from "../services/chat.js";
import { chatWithJinceia } from "../services/llm.js";
import {
  buildMemoryContext,
  extractMemories,
  getMemories,
  getPreferences,
  getPreferenceMemories,
  getSharedTimeline,
  getLatestAudit,
  getJinceiaPerspectives,
  getCorrectionEvents,
} from "../services/memory.js";

const router = Router();

// ============================================================
// 多用户：从 x-user-id 头部获取用户身份
// ============================================================

function getUserId(req: Request): string | null {
  const id = req.headers["x-user-id"];
  if (typeof id === "string" && id.trim()) return id.trim();
  return null;
}

function requireUser(req: Request, res: Response): string | null {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "请先注册或提供 x-user-id 头部" });
    return null;
  }
  // 确保用户存在于数据库
  const exists = dbOps.queryOne("SELECT id FROM users WHERE id = ?", [userId]);
  if (!exists) {
    res.status(401).json({ error: "用户不存在，请先注册" });
    return null;
  }
  return userId;
}

// ============================================================
// POST /api/v1/users/register — 注册新用户
// ============================================================

router.post("/users/register", (req: Request, res: Response) => {
  const { nickname } = req.body;

  if (!nickname || typeof nickname !== "string" || !nickname.trim()) {
    res.status(400).json({ error: "昵称不能为空" });
    return;
  }

  const id = uuid();
  const trimmedNickname = nickname.trim().slice(0, 20);

  dbOps.execute("INSERT INTO users (id, nickname) VALUES (?, ?)", [id, trimmedNickname]);

  console.log(`  👤 新用户注册: ${trimmedNickname} (${id.slice(0, 8)})`);

  res.json({
    user_id: id,
    nickname: trimmedNickname,
  });
});

// ============================================================
// GET /api/v1/me — 获取当前用户信息
// ============================================================

router.get("/me", (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  const user = dbOps.queryOne("SELECT id, nickname, avatar_url FROM users WHERE id = ?", [userId]);
  res.json({ user });
});

// ============================================================
// GET /api/v1/characters — 获取角色列表（含完整人设 + 用户自定义）
// ============================================================

router.get("/characters", (req: Request, res: Response) => {
  const jinceia = getOrCreateJinceia();
  const userId = getUserId(req);

  let customName = null;
  let customAvatar = null;

  if (userId) {
    const custom = dbOps.queryOne(
      "SELECT custom_name, custom_avatar FROM character_customizations WHERE user_id = ? AND character_id = ?",
      [userId, jinceia.id]
    );
    if (custom) {
      customName = custom.custom_name || null;
      customAvatar = custom.custom_avatar || null;
    }
  }

  res.json({
    characters: [
      {
        id: jinceia.id,
        name: customName || jinceia.name,
        default_name: jinceia.name,
        custom_name: customName,
        gender: "female",
        personality: jinceia.personality,
        tags: jinceia.tags.split(",").map((t: string) => t.trim()),
        backstory: jinceia.backstory,
        avatar_url: customAvatar || null,
      },
    ],
  });
});

// ============================================================
// GET /api/v1/characters/:id/customization — 获取用户对某角色的自定义
// ============================================================

router.get("/characters/:id/customization", (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  const custom = dbOps.queryOne(
    "SELECT custom_name, custom_avatar FROM character_customizations WHERE user_id = ? AND character_id = ?",
    [userId, req.params.id]
  );

  res.json({
    custom_name: custom?.custom_name || null,
    custom_avatar: custom?.custom_avatar || null,
  });
});

// ============================================================
// PUT /api/v1/characters/:id/customization — 更新角色自定义
// ============================================================

router.put("/characters/:id/customization", (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  const { custom_name } = req.body;

  if (custom_name !== undefined && (typeof custom_name !== "string" || !custom_name.trim())) {
    res.status(400).json({ error: "名字不能为空" });
    return;
  }

  const existing = dbOps.queryOne(
    "SELECT user_id FROM character_customizations WHERE user_id = ? AND character_id = ?",
    [userId, req.params.id]
  );

  if (existing) {
    dbOps.execute(
      "UPDATE character_customizations SET custom_name = ?, updated_at = datetime('now') WHERE user_id = ? AND character_id = ?",
      [custom_name?.trim() || null, userId, req.params.id]
    );
  } else {
    dbOps.execute(
      "INSERT INTO character_customizations (user_id, character_id, custom_name) VALUES (?, ?, ?)",
      [userId, req.params.id, custom_name?.trim() || null]
    );
  }

  console.log(`  ✏️  角色改名: ${custom_name} (用户: ${userId.slice(0, 8)})`);
  res.json({ custom_name: custom_name?.trim() || null });
});

// ============================================================
// POST /api/v1/characters/:id/avatar — 上传自定义头像（base64）
// ============================================================

router.post("/characters/:id/avatar", (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  const { avatar_base64 } = req.body;

  if (!avatar_base64 || typeof avatar_base64 !== "string") {
    res.status(400).json({ error: "请提供 avatar_base64 字段（base64 编码的图片）" });
    return;
  }

  // 限制大小：base64 不超过 500KB（约 375KB 原始图片）
  if (avatar_base64.length > 500 * 1024) {
    res.status(400).json({ error: "图片太大，请使用小于 500KB 的图片" });
    return;
  }

  const existing = dbOps.queryOne(
    "SELECT user_id FROM character_customizations WHERE user_id = ? AND character_id = ?",
    [userId, req.params.id]
  );

  if (existing) {
    dbOps.execute(
      "UPDATE character_customizations SET custom_avatar = ?, updated_at = datetime('now') WHERE user_id = ? AND character_id = ?",
      [avatar_base64, userId, req.params.id]
    );
  } else {
    dbOps.execute(
      "INSERT INTO character_customizations (user_id, character_id, custom_avatar) VALUES (?, ?, ?)",
      [userId, req.params.id, avatar_base64]
    );
  }

  console.log(`  🖼️  头像更新 (用户: ${userId.slice(0, 8)}, 大小: ${(avatar_base64.length / 1024).toFixed(1)}KB)`);
  res.json({ avatar_url: avatar_base64 });
});

// ============================================================
// GET /api/v1/conversations — 获取对话列表
// ============================================================

router.get("/conversations", (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  const conversations = dbOps.queryAll(
    `SELECT c.*, ch.name as character_name, ch.avatar_url as character_avatar
     FROM conversations c
     JOIN characters ch ON c.character_id = ch.id
     WHERE c.user_id = ?
     ORDER BY c.updated_at DESC`,
    [userId]
  );
  res.json({ conversations });
});

// ============================================================
// POST /api/v1/conversations — 创建新对话
// ============================================================

router.post("/conversations", (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  const jinceia = getOrCreateJinceia();
  const conversationId = createConversation(userId, jinceia.id);
  res.json({ conversation_id: conversationId });
});

// ============================================================
// DELETE /api/v1/conversations/:id — 删除对话
// ============================================================

router.delete("/conversations/:id", (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  // 验证对话属于当前用户
  const conv = dbOps.queryOne(
    "SELECT id FROM conversations WHERE id = ? AND user_id = ?",
    [req.params.id, userId]
  );
  if (!conv) {
    res.status(404).json({ error: "对话不存在" });
    return;
  }

  dbOps.execute("DELETE FROM messages WHERE conversation_id = ?", [req.params.id]);
  dbOps.execute("DELETE FROM conversations WHERE id = ? AND user_id = ?", [req.params.id, userId]);
  console.log(`  🗑️  对话已删除: ${req.params.id.slice(0, 8)}`);
  res.json({ success: true });
});

// ============================================================
// GET /api/v1/conversations/:id/messages — 获取对话消息
// ============================================================

router.get("/conversations/:id/messages", (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  // 验证对话属于当前用户
  const conv = dbOps.queryOne(
    "SELECT id FROM conversations WHERE id = ? AND user_id = ?",
    [req.params.id, userId]
  );
  if (!conv) {
    res.status(404).json({ error: "对话不存在" });
    return;
  }

  const messages = getMessages(req.params.id);
  res.json({ messages });
});

// ============================================================
// POST /api/v1/conversations/:id/messages — SSE 流式聊天
// ============================================================

router.post("/conversations/:id/messages", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  const { content } = req.body;
  const conversationId = req.params.id;

  if (!content || typeof content !== "string") {
    res.status(400).json({ error: "消息内容不能为空" });
    return;
  }

  if (content.length > 2000) {
    res.status(400).json({ error: "消息太长，请控制在 2000 字以内" });
    return;
  }

  // 验证对话属于当前用户
  const conv = dbOps.queryOne(
    "SELECT id FROM conversations WHERE id = ? AND user_id = ?",
    [conversationId, userId]
  );
  if (!conv) {
    res.status(404).json({ error: "对话不存在" });
    return;
  }

  const jinceia = getOrCreateJinceia();

  // 保存用户消息
  saveMessage(conversationId, "user", content);

  // 获取历史消息
  const historyMessages = getMessages(conversationId, 20) as any[];
  const history = historyMessages.slice(0, -1).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // 构建记忆上下文
  const memoryContext = await buildMemoryContext(userId, jinceia.id, content);

  // SSE 响应头
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  let fullResponse = "";

  try {
    const stream = chatWithJinceia(content, history, memoryContext);

    for await (const event of stream) {
      if (event.type === "delta") {
        fullResponse += event.content;
        res.write(`event: delta\ndata: ${JSON.stringify({ content: event.content })}\n\n`);
      } else if (event.type === "done") {
        const aiMsgId = saveMessage(conversationId, "assistant", fullResponse, event.tokensUsed);

        res.write(
          `event: done\ndata: ${JSON.stringify({
            message_id: aiMsgId,
            tokens_used: event.tokensUsed,
          })}\n\n`
        );
      }
    }
  } catch (error: any) {
    console.error("LLM 调用失败:", error);
    res.write(
      `event: error\ndata: ${JSON.stringify({
        code: "ai_error",
        message: error.message || "AI 服务暂时不可用",
      })}\n\n`
    );
  }

  res.end();

  // 异步提取记忆
  if (fullResponse) {
    extractMemories(userId, jinceia.id, content, fullResponse).catch((err) =>
      console.error("记忆提取失败:", err)
    );
  }
});

// ============================================================
// GET /api/v1/me/profile — 获取 Jinceia 对用户的了解
// ============================================================

router.get("/me/profile", (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  const jinceia = getOrCreateJinceia();

  const preferences = getPreferences(userId, jinceia.id);
  const allMemories = getMemories(userId, jinceia.id, { limit: 30 });
  const facts = allMemories.filter((m) => m.type === "fact" || m.type === "identity");
  const inferences = allMemories.filter((m) => m.type === "inference");
  const events = allMemories.filter((m) => m.type === "event");
  const timeline = getSharedTimeline(userId, jinceia.id);
  const perspectives = getJinceiaPerspectives(userId, jinceia.id, 10);
  const corrections = getCorrectionEvents(userId, jinceia.id, 20);

  res.json({
    preferences,
    facts,
    inferences,
    events,
    timeline,
    perspectives,
    corrections,
  });
});

// ============================================================
// GET /api/v1/me/us — 「我们」页面
// ============================================================

router.get("/me/us", (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  const jinceia = getOrCreateJinceia();

  const timeline = getSharedTimeline(userId, jinceia.id, 30);
  const perspectives = getJinceiaPerspectives(userId, jinceia.id, 20);
  const preferences = getPreferences(userId, jinceia.id);
  const totalMemories = getMemories(userId, jinceia.id, { limit: 1000 }).length;

  const conversations = dbOps.queryAll(
    "SELECT id FROM conversations WHERE user_id = ?",
    [userId]
  );
  const totalConversations = conversations.length;

  const overview = {
    first_met: timeline.length > 0 ? timeline[timeline.length - 1].date : null,
    total_timeline_events: timeline.length,
    total_jinceia_perspectives: perspectives.length,
    total_memories: totalMemories,
    total_conversations: totalConversations,
    call_name: preferences.call_name || null,
  };

  res.json({
    overview,
    timeline: timeline.sort((a, b) => a.date.localeCompare(b.date)),
    perspectives: perspectives.sort((a: any, b: any) => a.date.localeCompare(b.date)),
  });
});

// ============================================================
// GET /debug/last-context — 调试：上次注入的记忆上下文
// ============================================================

router.get("/debug/last-context", (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  const audit = getLatestAudit(userId);

  if (!audit) {
    res.json({ message: "还没有聊天记录，先和 Jinceia 说句话吧" });
    return;
  }

  res.json({
    timestamp: audit.timestamp,
    injected_memory_count: audit.injectedMemoryIds.length,
    injected_memory_ids: audit.injectedMemoryIds,
    memory_context: audit.memoryContext,
  });
});

export default router;
