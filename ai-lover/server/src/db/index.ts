import initSqlJs, { Database as SqlJsDatabase } from "sql.js";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config/index.js";

let db: SqlJsDatabase;

// 确保 data 目录存在
const dataDir = path.dirname(config.dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

/**
 * 初始化数据库（异步，启动时调用一次）
 */
export async function initDatabase(): Promise<void> {
  const SQL = await initSqlJs();

  // 如果已有数据库文件，加载它；否则创建新的
  if (fs.existsSync(config.dbPath)) {
    const buffer = fs.readFileSync(config.dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // ============================================
  // 基础表（不变）
  // ============================================

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      nickname TEXT,
      avatar_url TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS characters (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('preset', 'custom')),
      owner_id TEXT,
      gender TEXT CHECK(gender IN ('male', 'female')),
      avatar_url TEXT,
      personality TEXT,
      backstory TEXT,
      system_prompt TEXT NOT NULL,
      tags TEXT,
      is_public INTEGER DEFAULT 1,
      chat_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      character_id TEXT NOT NULL,
      title TEXT,
      last_message TEXT,
      message_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      tokens_used INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // ============================================
  // V0.2 统一记忆表（替代旧的 narrative/emotional 三表分存）
  // ============================================

  // 旧表迁移：如果旧表存在，先删掉（V0.2 早期版本的表，无生产数据）
  db.run("DROP TABLE IF EXISTS narrative_memories");
  db.run("DROP TABLE IF EXISTS emotional_memories");
  db.run("DROP TABLE IF EXISTS memories");
  db.run("DROP TABLE IF EXISTS shared_timeline");
  db.run("DROP TABLE IF EXISTS user_profile");

  // 统一记忆表
  db.run(`
    CREATE TABLE IF NOT EXISTS memories_v2 (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      character_id TEXT NOT NULL,

      -- 时间：YYYY-MM-DD，有校验
      date TEXT NOT NULL,

      -- 类型：fact（事实）/ inference（推断）/ preference（偏好）/ event（事件）/ identity（身份）
      type TEXT NOT NULL CHECK(type IN ('fact', 'inference', 'preference', 'event', 'identity')),

      -- 来源：user_stated（用户明确说的）/ assistant_inferred（AI推断的）/ system_defined（系统设定）
      source TEXT NOT NULL CHECK(source IN ('user_stated', 'assistant_inferred', 'system_defined')),

      -- 置信度 0.0-1.0。user_stated = 1.0，assistant_inferred < 1.0
      confidence REAL NOT NULL DEFAULT 0.5,

      -- 事实本体：短，干净，只存事实
      content TEXT NOT NULL,

      -- 推断/解释：AI 的理解，与 content 分开
      inference TEXT,

      -- 检索用：逗号分隔的话题标签
      topics TEXT DEFAULT '',

      -- 重要性 0-10
      importance INTEGER DEFAULT 5,

      -- 状态：active / outdated / deprecated / corrected
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'outdated', 'deprecated', 'corrected')),

      -- 版本控制：如果这条记忆替代了旧记忆，记录旧记忆的 id
      replaces_id TEXT,

      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // 用户偏好（高优先级槽位，如称呼、语言偏好等）
  db.run(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id TEXT PRIMARY KEY,
      character_id TEXT NOT NULL,
      preferences_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // 共同时间线（双向叙事）
  db.run(`
    CREATE TABLE IF NOT EXISTS shared_timeline (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      character_id TEXT NOT NULL,
      date TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      jinceia_narrative TEXT,
      perspective TEXT CHECK(perspective IN ('user', 'jinceia', 'shared')) DEFAULT 'shared',
      type TEXT DEFAULT 'event' CHECK(type IN ('event', 'milestone', 'first_time')),
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Jinceia 视角记忆（她的内心叙事，独立于用户记忆）
  db.run(`
    CREATE TABLE IF NOT EXISTS jinceia_perspectives (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      character_id TEXT NOT NULL,
      date TEXT NOT NULL,
      narrative TEXT NOT NULL,
      mood TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // V0.3.5 行为提示表（Insight → Behavior 映射）
  db.run(`
    CREATE TABLE IF NOT EXISTS behavioral_hints (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      character_id TEXT NOT NULL,
      hint TEXT NOT NULL,
      source_insight_ids TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'outdated', 'superseded')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // V0.3.6 认知修正事件表
  db.run(`
    CREATE TABLE IF NOT EXISTS correction_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      character_id TEXT NOT NULL,
      old_memory_id TEXT,
      old_belief TEXT NOT NULL,
      new_belief TEXT NOT NULL,
      new_memory_id TEXT,
      surfaced INTEGER DEFAULT 0,
      surfaced_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // V0.4.0 角色自定义表（每个用户可自定义角色的名字和头像）
  db.run(`
    CREATE TABLE IF NOT EXISTS character_customizations (
      user_id TEXT NOT NULL,
      character_id TEXT NOT NULL,
      custom_name TEXT,
      custom_avatar TEXT,
      updated_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, character_id)
    )
  `);

  // ============================================
  // V0.3.2 迁移：新增 memory_type / last_used_at / archived
  // ============================================
  migrateV032(db);

  // ============================================
  // 性能索引（避免全表扫描）— 必须在迁移之后创建
  // ============================================
  db.run("CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at)");
  db.run("CREATE INDEX IF NOT EXISTS idx_memories_user_char ON memories_v2(user_id, character_id, status, archived)");
  db.run("CREATE INDEX IF NOT EXISTS idx_timeline_user_char ON shared_timeline(user_id, character_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_perspectives_user_char ON jinceia_perspectives(user_id, character_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_hints_user_char ON behavioral_hints(user_id, character_id, status)");
  db.run("CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, updated_at)");

  saveToDisk();

  console.log("  📦 数据库已就绪（V0.3.6 认知修正）");
}

/**
 * 持久化到磁盘
 */
export function saveToDisk(): void {
  const data = db.export();
  const buffer = Buffer.from(data.buffer);
  fs.writeFileSync(config.dbPath, buffer);
}

// ============================================================
// V0.3.2 迁移
// ============================================================

/** 安全添加列：如果列已存在则跳过 */
function addColumnIfNotExists(table: string, column: string, definition: string): void {
  const exists = db.prepare(`PRAGMA table_info('${table}')`);
  while (exists.step()) {
    const row = exists.getAsObject();
    if ((row as any).name === column) {
      exists.free();
      return; // 已存在，跳过
    }
  }
  exists.free();
  db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  console.log(`  🔧 迁移: ${table}.${column} 已添加`);
}

function migrateV032(database: SqlJsDatabase): void {
  // 1. memories_v2 新增字段
  addColumnIfNotExists(
    "memories_v2",
    "memory_type",
    "TEXT NOT NULL DEFAULT 'fact' CHECK(memory_type IN ('fact', 'insight', 'event', 'relationship'))"
  );
  addColumnIfNotExists("memories_v2", "last_used_at", "TEXT");
  addColumnIfNotExists("memories_v2", "archived", "INTEGER NOT NULL DEFAULT 0");

  // 2. 推断现有数据的 memory_type（基于旧 type 字段映射）
  //    fact/identity → fact
  //    inference → insight
  //    event → event
  //    没有 relationship 类型的数据需要后续 LLM 重新分类
  try {
    database.run(`
      UPDATE memories_v2 SET memory_type = 'insight'
      WHERE type = 'inference' AND memory_type = 'fact'
    `);
    database.run(`
      UPDATE memories_v2 SET memory_type = 'event'
      WHERE type = 'event' AND memory_type = 'fact'
    `);
  } catch {
    // 忽略迁移错误
  }

  saveToDisk();
}

/**
 * 执行查询，返回结果行数组
 */
function queryAll(sql: string, params: any[] = []): any[] {
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }

  const results: any[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push(row);
  }
  stmt.free();
  return results;
}

/**
 * 执行查询，返回第一行
 */
function queryOne(sql: string, params: any[] = []): any | null {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * 执行写操作（INSERT/UPDATE/DELETE）
 * 改为延迟写入：每 5 秒或每 50 次写操作才持久化一次
 */
let _dirty = false;
let _writeCount = 0;
let _saveTimer: ReturnType<typeof setTimeout> | null = null;
const MAX_UNSAVED_WRITES = 50;
const SAVE_INTERVAL_MS = 5000;

function markDirty(): void {
  _dirty = true;
  _writeCount++;

  // 累积 50 次写操作 → 立即保存
  if (_writeCount >= MAX_UNSAVED_WRITES) {
    flushNow();
    return;
  }

  // 启动定时器（如果还没启动）
  if (!_saveTimer) {
    _saveTimer = setTimeout(() => {
      flushNow();
    }, SAVE_INTERVAL_MS);
  }
}

/** 立即持久化（不清除定时器） */
function flushNow(): void {
  if (_saveTimer) {
    clearTimeout(_saveTimer);
    _saveTimer = null;
  }
  if (_dirty) {
    saveToDisk();
    _dirty = false;
    _writeCount = 0;
  }
}

/** 优雅关闭时调用：强制保存未写入的数据 */
export function flushAndClose(): void {
  flushNow();
  if (db) db.close();
}

function execute(sql: string, params: any[] = []): void {
  db.run(sql, params);
  markDirty();
}

// 导出封装好的数据库操作函数
export const dbOps = {
  queryAll,
  queryOne,
  execute,
  raw: () => db,
  flush: flushNow,
};

export default dbOps;
