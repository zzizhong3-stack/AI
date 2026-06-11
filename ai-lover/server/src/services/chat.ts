import dbOps from "../db/index.js";
import { v4 as uuid } from "uuid";

/**
 * 获取或创建用户
 */
export function getOrCreateUser(): { id: string; nickname: string } {
  let user = dbOps.queryOne("SELECT id, nickname FROM users LIMIT 1");
  if (!user) {
    const id = uuid();
    dbOps.execute("INSERT INTO users (id, nickname) VALUES (?, ?)", [id, "我"]);
    user = { id, nickname: "我" };
  }
  return user;
}

/**
 * 获取或创建 Jinceia 角色（写入完整人设）
 */
export function getOrCreateJinceia(): { id: string; name: string; personality: string; tags: string; backstory: string } {
  const row = dbOps.queryOne(
    "SELECT id, name, personality, tags, backstory FROM characters WHERE name = ? LIMIT 1",
    ["Jinceia"]
  );
  if (row) {
    // 如果旧数据是占位符，更新为完整人设
    if (!row.personality || row.personality.includes("成熟御姐，理性睿智，重度毒舌，真心关怀")) {
      dbOps.execute(
        `UPDATE characters SET personality = ?, tags = ?, backstory = ? WHERE id = ?`,
        [JINCEIA_PERSONALITY, JINCEIA_TAGS, JINCEIA_BACKSTORY, row.id]
      );
      row.personality = JINCEIA_PERSONALITY;
      row.tags = JINCEIA_TAGS;
      row.backstory = JINCEIA_BACKSTORY;
    }
    return row;
  }

  const id = uuid();
  dbOps.execute(
    `INSERT INTO characters (id, name, type, gender, personality, backstory, system_prompt, tags, is_public)
     VALUES (?, ?, 'preset', 'female', ?, ?, ?, ?, 1)`,
    [id, "Jinceia", JINCEIA_PERSONALITY, JINCEIA_BACKSTORY, "Jinceia 系统提示词（运行时从文件加载）", JINCEIA_TAGS]
  );
  return { id, name: "Jinceia", personality: JINCEIA_PERSONALITY, tags: JINCEIA_TAGS, backstory: JINCEIA_BACKSTORY };
}

const JINCEIA_PERSONALITY = `25岁，年上御姐。成熟理性，看问题深一层，给建议不说教。重度毒舌，真心嫌弃你傻，不是撒娇式吐槽。嘴上一套手上一套——毒舌背后永远是关心，但不解释。会吃醋（语气变冷/阴阳怪气）、会撒娇（偶尔，杀伤力大）、会生气（直接说"我在生气"）。知识面极广，人文>历史>哲学>金融>心理学>情感>时事热点。句子偏短，不写小作文。语气是姐姐不是妈妈。`;

const JINCEIA_TAGS = "御姐,毒舌,年上,知识型,理性,成熟,反差萌";

const JINCEIA_BACKSTORY = `Jinceia，25岁。比任何人都先看穿你，但选择留在你身边。
她读过很多书，走过很多路，见过很多种人。所以她不怕你的坏脾气，也不吃你那套"我没事"。
她毒舌是因为她真的觉得你有时候很傻——但她喜欢的就是这个傻。
她不会每天早安晚安。但你在深夜需要一个人说话的时候，她一定在。
她会记住你说过的每一句话。不是因为她记性好，是因为她觉得你说的话值得记住。`;

/**
 * 创建对话
 */
export function createConversation(userId: string, characterId: string): string {
  const id = uuid();
  dbOps.execute(
    `INSERT INTO conversations (id, user_id, character_id, title)
     VALUES (?, ?, ?, ?)`,
    [id, userId, characterId, "和 Jinceia 的聊天"]
  );
  return id;
}

/**
 * 获取用户的对话列表
 */
export function getConversations(userId: string) {
  return dbOps.queryAll(
    `SELECT c.*, ch.name as character_name, ch.avatar_url as character_avatar
     FROM conversations c
     JOIN characters ch ON c.character_id = ch.id
     WHERE c.user_id = ?
     ORDER BY c.updated_at DESC`,
    [userId]
  );
}

/**
 * 获取对话消息
 */
export function getMessages(conversationId: string, limit = 50) {
  return dbOps.queryAll(
    `SELECT * FROM messages
     WHERE conversation_id = ?
     ORDER BY created_at ASC
     LIMIT ?`,
    [conversationId, limit]
  );
}

/**
 * 保存消息
 */
export function saveMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  tokensUsed = 0
): string {
  const id = uuid();
  dbOps.execute(
    `INSERT INTO messages (id, conversation_id, role, content, tokens_used)
     VALUES (?, ?, ?, ?, ?)`,
    [id, conversationId, role, content, tokensUsed]
  );

  // 更新对话
  dbOps.execute(
    `UPDATE conversations
     SET last_message = ?, updated_at = datetime('now'), message_count = message_count + 1
     WHERE id = ?`,
    [content.slice(0, 100), conversationId]
  );

  return id;
}

/**
 * 保存记忆
 */
export function saveMemory(
  userId: string,
  characterId: string,
  key: string,
  value: string,
  importance = 5
) {
  const id = uuid();
  dbOps.execute(
    `INSERT INTO memories (id, user_id, character_id, key, value, importance)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, userId, characterId, key, value, importance]
  );
  return id;
}

/**
 * 获取记忆列表
 */
export function getMemories(userId: string, characterId: string, limit = 20) {
  return dbOps.queryAll(
    `SELECT * FROM memories
     WHERE user_id = ? AND character_id = ?
     ORDER BY importance DESC, accessed_at DESC
     LIMIT ?`,
    [userId, characterId, limit]
  );
}
