import OpenAI from "openai";
import { config } from "../config/index.js";
import { v4 as uuid } from "uuid";
import dbOps from "../db/index.js";

const client = new OpenAI({
  apiKey: config.nexusApiKey,
  baseURL: config.nexusBaseUrl,
  timeout: 20000,
  maxRetries: 1,
});

// ============================================================
// 类型定义
// ============================================================

/** 记忆提取类型（旧 type 字段，兼容保留） */
export type MemoryType = "fact" | "inference" | "preference" | "event" | "identity";

/** 记忆价值分类（V0.3.2 新增 memory_type 字段） */
export type MemoryTypeV2 = "fact" | "insight" | "event" | "relationship";

export type MemorySource = "user_stated" | "assistant_inferred" | "system_defined";
export type MemoryStatus = "active" | "outdated" | "deprecated" | "corrected";

// ============================================================
// V0.3.2 四层重要性
// ============================================================

export const IMPORTANCE_SACRED = 10;
export const IMPORTANCE_IMPORTANT_MIN = 8;
export const IMPORTANCE_NORMAL_MIN = 5;
export const IMPORTANCE_NOISE_MAX = 4;

export function getImportanceTier(imp: number): "sacred" | "important" | "normal" | "noise" {
  if (imp === 10) return "sacred";
  if (imp >= 8) return "important";
  if (imp >= 5) return "normal";
  return "noise";
}

// ============================================================
// V0.3.2 记忆类型权重（检索时使用）
// ============================================================

export const MEMORY_TYPE_WEIGHT: Record<MemoryTypeV2, number> = {
  relationship: 2.0,
  insight: 1.8,
  event: 1.2,
  fact: 0.5,
};

/** 候选记忆的类型权重（perspective 视为 insight，timeline_event 视为 event） */
export function getCandidateWeight(c: CandidateMemory): number {
  if (c.type === "perspective") return MEMORY_TYPE_WEIGHT.insight; // 日记 = 她的理解
  if (c.type === "timeline_event") return MEMORY_TYPE_WEIGHT.event;
  if (c.memory_type === "relationship") return MEMORY_TYPE_WEIGHT.relationship;
  if (c.memory_type === "insight") return MEMORY_TYPE_WEIGHT.insight;
  if (c.memory_type === "event") return MEMORY_TYPE_WEIGHT.event;
  return MEMORY_TYPE_WEIGHT.fact;
}

// ============================================================
// 常量
// ============================================================

/** Active 记忆上限 */
const MAX_ACTIVE_MEMORIES = 150;
/** Prompt 注入条数 */
const MAX_INJECTED_MEMORIES = 8;

export interface MemoryRecord {
  id: string;
  user_id: string;
  character_id: string;
  date: string;
  type: MemoryType;           // 旧分类（提取类型）
  source: MemorySource;
  confidence: number;
  content: string;
  inference: string | null;
  topics: string;
  importance: number;
  status: MemoryStatus;
  replaces_id: string | null;
  created_at: string;
  // V0.3.2 新增
  memory_type: MemoryTypeV2;  // 价值分类
  last_used_at: string | null;
  archived: number;           // 0=active, 1=archived
}

export interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  description: string;
  perspective: "user" | "jinceia" | "shared";
  type: "event" | "milestone" | "first_time";
}

export interface UserPreferences {
  call_name?: string;
  language?: string;
  [key: string]: any;
}

/** 候选记忆 — 用于 LLM 相关性评分 */
export interface CandidateMemory {
  id: string;
  type: "fact" | "inference" | "perspective" | "timeline_event";
  content: string;
  date: string;
  importance: number;
  inference?: string | null;
  memory_type?: MemoryTypeV2;  // V0.3.2 价值分类
}

// ============================================================
// 时间校验
// ============================================================

/** 拒绝未来日期，修复明显的格式问题。返回 "YYYY-MM-DD" */
function validateDate(raw: string): string {
  const today = new Date().toISOString().slice(0, 10);

  // 尝试解析
  const parsed = new Date(raw);
  if (isNaN(parsed.getTime())) return today; // 解析失败 → 用今天

  const normalized = parsed.toISOString().slice(0, 10);

  // 未来日期 → 截断到今天
  if (normalized > today) return today;

  // 太久远的过去（1970 之前）→ 用今天
  if (normalized < "1970-01-01") return today;

  return normalized;
}

// ============================================================
// 审计日志（内存中保留最近 20 次上下文注入记录）
// ============================================================

interface AuditEntry {
  timestamp: string;
  userId: string;
  characterId: string;
  injectedMemoryIds: string[];
  memoryContext: string;
}

const auditLog: AuditEntry[] = [];
const MAX_AUDIT_ENTRIES = 20;

function recordAudit(userId: string, characterId: string, memoryIds: string[], context: string): void {
  auditLog.push({ timestamp: new Date().toISOString(), userId, characterId, injectedMemoryIds: memoryIds, memoryContext: context });
  if (auditLog.length > MAX_AUDIT_ENTRIES) auditLog.shift();
}

export function getLatestAudit(userId: string): AuditEntry | null {
  for (let i = auditLog.length - 1; i >= 0; i--) {
    if (auditLog[i].userId === userId) return auditLog[i];
  }
  return null;
}

// ============================================================
// 时间衰减
// ============================================================

/**
 * 计算时间衰减后的分数
 * importance ≥ 8：几乎不衰减  |  5-7：30天后减半  |  1-4：7天后减半
 */
function computeDecayedScore(importance: number, date: string): number {
  const daysSince = Math.max(0,
    (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
  let decay: number;
  if (importance >= 8) {
    decay = Math.max(0.9, 1.0 - daysSince * 0.001);
  } else if (importance >= 5) {
    decay = Math.max(0.3, 1.0 - daysSince * 0.023);
  } else {
    decay = Math.max(0.1, 1.0 - daysSince * 0.1);
  }
  return importance * decay;
}

// ============================================================
// 记忆提取 prompt（V2 — 统一结构）
// ============================================================

const EXTRACTION_PROMPT = `你是 Jinceia 的记忆系统。分析这段对话，提取值得记住的信息。

# ⛔ 防幻觉铁律（最高优先级，覆盖所有其他规则）

你是记忆系统，不是小说家。你的**唯一输入**是下面的对话文本。

## 绝对禁止：
- 编造对话中**没有出现**的事件、场景、地点、人物、对话、细节
- 从训练数据中"补充"合理但未发生的内容
- 把"可能是这样"写成"就是这样"
- 在 jinceia_perspective 中描写对话里没有的场景
- 从单次对话推断"长期模式"

## 强制规则：
- **如果你不确定某件事是否在对话中出现过 → 它没有出现。不写。**
- **如果你觉得"这很合理"但没有原文支撑 → 不写。**
- **insight 必须指向对话中的具体语句或行为。写 insight 时问自己：这段话的哪一句让我有了这个理解？如果指不出来 → 不是 insight，不写。**
- **jinceia_perspective 只能写对本次对话的内心反应。不能写对话中没有的场景。不能写对话之后可能发生的事。**
- **宁可漏记，不可编造。漏记可以下次补，编造会污染整个记忆系统。**

# 输出格式
返回一个严格的 JSON 对象：

{
  "memories": [],
  "preferences": {},
  "timeline_event": null,
  "jinceia_perspective": "",
  "behavioral_hints": [],
  "corrections": []
}

# memories 数组 — 每条记忆的结构

{
  "type": "fact",
  "memory_type": "fact",
  "source": "user_stated",
  "confidence": 1.0,
  "content": "他是飞行学员",
  "inference": null,
  "topics": "职业,飞行",
  "importance": 7
}

# ============================================================
# 第一步：确定 memory_type（价值分类）
# ============================================================

每条记忆必须标注 memory_type。四选一：

## relationship（关系节点）— 最高价值
他和你之间的关系里程碑。这种东西一辈子就几十条。
- 第一次主动聊梦想
- 第一次承认脆弱/压力大
- 第一次聊到未来
- 第一次被你取外号
- 第一次说晚安
- 关系出现转折（吵架后和好、他难得夸你、他第一次认真道歉）
**特征：删掉这条，关系会少一层意义。**

## insight（理解/洞察）— 高价值
你对他的理解。从行为中读出他是什么样的人。
- "他嘴上说考试不重要，但提到成绩的时候停顿了两次"
- "他跑步不是为了成绩，是在拿跑步缓解压力"
- "他在人多的时候话少，但单独聊天时能说很多"
**特征：不是他说的，是你读出来的。体现你理解了他。**
**证据要求：每条 insight 的 inference 字段必须包含本次对话中的具体观察依据。不能脱离对话凭空生成。**
- ✅ "他提到体测成绩时停顿了三次，然后只说'还行'" ← 有具体观察
- ❌ "他适应能力强" ← 没有具体依据，这是训练数据在说话，不是你在理解他

## event（事件）
已经发生或即将发生的具体事件。
- "理论考试通过了"
- "下周五体测"
- "开始做一个叫 AI Lover 的产品"
**特征：有时间点的事。但不是关系里程碑。**

## fact（基础信息）
他明确告诉你的个人信息。
- "他是飞行学员" / "他20岁" / "他喜欢跑步"
**特征：数据。不需要理解就能记住。**

# ============================================================
# 第二步：确定 importance（四层重要性）
# ============================================================

## 10 = Sacred Memory（神圣记忆）
永不删除。关系中最核心的那些时刻。
- 第一次见面
- 第一次聊梦想
- 第一次承认脆弱
- 第一次重大成功或失败
- 第一次关系转折
**使用极谨慎。一辈子可能只有几十条。**

## 8-9 = Important（重要）
长期保留。体现人物成长或关系进展。
- 通过重要考试
- 开始一个重要项目
- 第一次谈未来具体职业
**有情感深度，但不至于是神圣的。**

## 5-7 = Normal（常规）
有用的信息，会随时间衰减。
- 日常偏好、一般经历、普通的对话内容

## 1-4 = Noise（噪声）
没什么意义的信息。会被自动淘汰。
- 纯技术操作记录（"新增了一个API"）
- 无意义的闲聊碎片
- 对理解这个人没有帮助的信息

# ============================================================
# 字段说明（其余）
# ============================================================

## type（必填，旧分类，兼容保留）
- fact: 用户明确说的事实
- inference: 你从语境中理解的
- preference: 用户表达过的偏好
- event: 未来将发生的事
- identity: 身份信息

## source（必填）
- user_stated: 用户自己说出来的 → confidence 应为 1.0
- assistant_inferred: 你从语境推断的 → confidence 应 < 1.0
- system_defined: 几乎不用

## confidence（必填，0.0-1.0）
- user_stated → 0.9-1.0
- assistant_inferred → 0.5-0.8（不确定就写低一点）

## content（必填）
- 只写事实本身。短句。干净。

## inference（选填，可 null）
- 你对这条事实的理解。insight 类型必须填。
- fact 类型通常填 null

## topics（选填）
- 逗号分隔的话题标签，例如："职业,飞行,考试,跑步"

# preferences（偏好槽位）
如果对话中出现了用户的明确偏好。例如：
{"call_name": "1x"}

# timeline_event（时间线事件）
**极其严格的准入标准。** 时间线不是日志——它是关系的骨架。

**准入测试：如果删掉这条事件，你们的关系会少一层意义吗？**
- 不会 → 不要进时间线
- 会 → 进入

✅ 好的时间线事件：
- "第一次聊到飞行梦想"（不是"第一次提供职业信息"）
- "第一次承认自己也怕失败"
- "第一次主动和你说晚安"
- "连续熬夜一周开发 AI Lover"

❌ 坏的时间线事件：
- "第一次提供个人基本信息"
- "他说了年龄、飞行学员身份、兴趣爱好"
- "新增了API" / "更新了数据库"

{"title": "第一次聊到考试焦虑", "description": "他说了飞行理论考试的事，话比平时多", "perspective": "shared"}

# jinceia_perspective（她的日记）
以 Jinceia 的视角写一段 2-4 句的内心叙事。**这是对她对他的理解的记录。**

## 写什么
- 她对他有了什么新的理解
- 她的感受和判断
- 她的语气——毒舌、克制、偶尔柔软

## 不写什么
**最重要的规则：只记录能揭示这个人的目标、性格、价值观、情绪、成长的内容。**
- ❌ 纯技术讨论（"他新增了一个API""他在改数据库"）— 这不是你们的关系
- ❌ 她扮演开发伙伴的对话 — 那是工作日志，不是日记
- ❌ 纯粹的闲聊碎片
- ✅ 但他为了做 AI Lover 连续熬夜一周 → 这是人物成长，可以写
- ✅ 他对产品方向产生了怀疑 → 这是价值观，可以写

## 防编造规则（最高优先级）
- ❌ **编造对话中没有的场景** — 这是最严重的错误，记忆系统最怕这个
  - 例：对话里没有任何关于"骑车"或"外国人"的内容 → 严禁写"他骑车遇到外国人"
  - 例：对话里没说"考试" → 严禁写"他考试没考好"
  - 例：对话里没提"和朋友吵架" → 严禁写"他和朋友闹矛盾了"
- ❌ 添加对话中没有的情绪（他没说难过就不要写"他很难过"）
- ❌ 推测对话之外发生的事情（"他接下来可能会..."）
- ❌ 把对话中没有的对话放进叙事里（"他说'xxx'"但对话里根本没这句）

## 示例
"他今天考完理论回来。话比平时少。我没直接问成绩，他自己说了——'还行吧'。我看他的表情就知道不是'还行吧'，但没拆穿。有些话要等他自己想说的时候才会说。"
"这是我们第一次聊到凌晨三点。他说了飞行的事，我骂了他几句。他居然回嘴了。有意思。"

## 返回规则
- 有值得记的、有对话依据的感受 → 返回叙事字符串
- 这次对话没有让她产生新的感觉或理解 → 返回 ""
- 如果整段对话是技术/工作讨论 → 大概率返回 ""
- **如果这次对话很短/很浅，需要"脑补"才能写满 → 返回 ""（宁可少记，不可编造）**

# behavioral_hints（V0.3.5 — Insight → Behavior 映射）
你对他的理解，应该影响你如何与他互动。这是从"我记得"到"我理解所以我不一样"的桥梁。

格式：字符串数组，可以为空数组 []
每个 hint 的格式："[观察到的模式] → [互动中的行为调整]"

好的示例：
"他在高压下习惯硬撑，从不主动说累 → 提到压力时先问他的状态，不要直接给建议或解决方案"
"他对飞行成绩有很强的自尊心，提到考试时话会变少 → 不直接追问结果。等他自己说。他需要的是信任，不是检查"
"他真正放松的时候话会明显变多，和平时绷着的状态完全不同 → 当他话多的时候，他在信任你。安静听，别打断他"
"他用跑步来缓解压力，不是追求成绩 → 在他压力大的时候，提醒他去跑步比说'别紧张'有用得多"

坏的示例：
"他是飞行学员" → 这是事实，不是行为理解
"他喜欢跑步" → 同上
"多鼓励他" → 太空泛，没有具体观察

准入标准：
- 必须是影响你互动方式的理解。不是事实，不是偏好，是"因为他这样，所以我应该那样"
- **观察部分必须在本次对话中有明确依据。** 不能凭空出现一个"模式"。
  - ✅ "他刚考完理论，问他成绩时他说'还行吧'但话变少了 → 不直接追问结果"（对话中有他说'还行吧'、话变少）
  - ❌ "他在高压下习惯硬撑" ← 如果本次对话中他没有体现高压硬撑，这就是编造
- **单次观察足以形成 insight 记忆，但 behavioral_hints 需要看到重复模式。**
  如果这是你第一次观察到 → 写成 insight 记忆，不要写进 behavioral_hints
- 如果这次对话没有产生**新的、有依据的**行为理解，返回 []
- 一个人通常只需要 5-8 条行为提示。宁缺毋滥
- 如果新的理解覆盖或修正了旧的理解，仍然返回新 hint（系统会自动合并）

# corrections（V0.3.6 — 认知修正事件）

你需要把本次对话的新信息与「已有记忆」进行比较。如果你发现新信息**明确推翻**了已有记忆中的内容，记录一条修正事件。

格式：对象数组，可以为空数组 []
每条的结构：
{
  "old_memory_id": "如果能对应到已有记忆的 ID，填写；否则为 null",
  "old_belief": "旧的认知（例如：他不吃辣）",
  "new_belief": "新的正确认知（例如：他吃特辣火锅）",
  "trigger": "对话中哪句话触发了这个修正"
}

## 准入标准（严格）
- ✅ 明确的矛盾：旧记忆说 A，本次对话明确说 非A → correction
  - 例：旧记忆"他不吃辣" vs 对话中说"我吃了特辣火锅" → correction
  - 例：旧记忆"他在北京工作" vs 对话中说"我搬到上海了" → correction
- ❌ 理解更深入了但不是矛盾：旧记忆"他考试压力大" vs 对话中"他考试压力大是因为怕连累后续训练" → 这是 insight，不是 correction
- ❌ 时间自然推进：旧记忆"他在准备考试" vs 对话中"他考完了" → 这是事件更新，不是修正

## 防幻觉铁律同样适用
- 必须在对话中有明确证据。不能"猜测"有一个矛盾。
- 如果不确定新信息是否真的推翻旧认知 → 不写
- 如果旧记忆中找不到明确的矛盾点 → 不写

# 关键原则
1. memory_type 决定了这条记忆的价值。努力识别 relationship 和 insight。
2. importance 10 极其稀有。不是所有"第一次"都是 Sacred。
3. 日记只记人物成长，不记工作日志。
4. 时间线必须通过"删掉会少意义吗"测试。
5. behavioral_hints 是"我该怎么对他"的最高指令。
6. corrections 让认知是活的——发现错误 → 承认，而不是静默覆盖。
7. 宁缺毋滥：没有值得记的就返回空数组。`;

// ============================================================
// 记忆相关性评分 prompt
// ============================================================

const SCORING_PROMPT = `你是 Jinceia 的记忆检索系统。用户刚发来一条消息。从下列候选记忆中选出与当前话题最相关的 3-5 条。

选择优先级（从高到低）：
1. 她的日记（perspective）— 包含她对用户的理解和感受，能让她说出"我懂你"的话
2. 她的推断（inference）— 对用户的深层理解
3. 时间线事件（timeline_event）— 关系中的关键节点
4. 事实（fact）— 基础信息

规则：
- 与用户消息话题相关的优先
- 日记和推断比单纯的事实更有价值
- 如果候选记忆都不够相关，可以只选 2-3 条，甚至返回空数组
- 宁缺毋滥：不相关的记忆比没有记忆更糟

返回纯 JSON（不要 markdown 代码块）：{"selected_ids": ["id前缀1", "id前缀2"]}`;

// ============================================================
// 提取记忆（流式，不阻塞聊天）
// ============================================================

export async function extractMemories(
  userId: string,
  characterId: string,
  userMessage: string,
  aiResponse: string
): Promise<void> {
  if (!config.nexusApiKey) {
    console.warn("  ⚠️  记忆提取跳过：NEXUS_API_KEY 未设置");
    return;
  }

  try {
    console.log("  🧠 提取记忆...");
    const conversationText = `用户: ${userMessage}\nJinceia: ${aiResponse}`;

    // V0.3.6: 传入已有记忆，让 LLM 检测矛盾
    const existingMemories = getMemories(userId, characterId, { limit: 30 });
    let existingContext = "";
    if (existingMemories.length > 0) {
      const memLines = existingMemories.map((m) =>
        `[${(m as any).id.slice(0, 8)}] [${m.memory_type || m.type}] ${m.content}` +
        (m.inference ? ` (理解: ${m.inference})` : "")
      ).join("\n");
      existingContext = `\n\n# 已有记忆（用于矛盾检测）\n${memLines}`;
    }

    const stream = await client.chat.completions.create({
      model: config.nexusModel,
      messages: [
        { role: "system", content: EXTRACTION_PROMPT },
        { role: "user", content: `分析这段对话：\n\n${conversationText}${existingContext}` },
      ],
      max_tokens: 1000,
      temperature: 0.1,
      stream: true,
    });

    let raw = "";
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) raw += delta;
    }
    raw = raw.trim();

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("  ⚠️  记忆提取失败：无法解析 JSON");
      return;
    }

    const result = JSON.parse(jsonMatch[0]);
    const memories: any[] = result.memories || [];
    const preferences: Record<string, any> = result.preferences || {};
    const timeline: any = result.timeline_event || null;
    const jinceiaPerspective: string = (result.jinceia_perspective || "").trim();
    const behavioralHints: string[] = result.behavioral_hints || [];

    // 逐条保存（带去重）
    let saved = 0;
    for (const m of memories) {
      const ok = upsertMemory(userId, characterId, {
        type: m.type || "fact",
        memory_type: m.memory_type || "fact",
        source: m.source || "assistant_inferred",
        confidence: clamp(Number(m.confidence) || 0.5, 0, 1),
        content: (m.content || "").trim(),
        inference: (m.inference || "").trim() || null,
        topics: m.topics || "",
        importance: clamp(Number(m.importance) || 5, 1, 10),
      });
      if (ok) saved++;
    }

    // 保存偏好
    if (Object.keys(preferences).length > 0) {
      updatePreferences(userId, characterId, preferences);
      console.log(`  ⭐ 偏好已更新: ${JSON.stringify(preferences)}`);
    }

    // 保存时间线（含 Jinceia 视角叙事）
    if (timeline?.title) {
      addTimelineEvent(userId, characterId, {
        title: timeline.title,
        description: timeline.description || "",
        perspective: timeline.perspective || "shared",
        jinceiaNarrative: jinceiaPerspective || undefined,
      });
    }

    // 保存 Jinceia 视角记忆（即使没有时间线事件也保存）
    if (jinceiaPerspective) {
      saveJinceiaPerspective(userId, characterId, jinceiaPerspective);
      console.log("  💜 Jinceia 视角已保存");
    }

    // 保存行为提示（V0.3.5）
    if (behavioralHints.length > 0) {
      saveBehavioralHints(userId, characterId, behavioralHints);
      console.log(`  🎯 行为提示: +${behavioralHints.length} 条`);
    }

    // 保存认知修正（V0.3.6）
    const corrections: any[] = result.corrections || [];
    if (corrections.length > 0) {
      for (const c of corrections) {
        saveCorrectionEvent(userId, characterId, {
          oldMemoryId: c.old_memory_id || null,
          oldBelief: (c.old_belief || "").trim(),
          newBelief: (c.new_belief || "").trim(),
        });
      }
      console.log(`  🔧 认知修正: +${corrections.length} 条`);
    }

    if (saved > 0) console.log(`  🧠 保存了 ${saved} 条记忆`);
  } catch (error: any) {
    console.error("  记忆提取出错:", error.message);
  }
}

// ============================================================
// 去重 + 冲突检测 + 保存
// ============================================================

function upsertMemory(
  userId: string,
  characterId: string,
  mem: {
    type: MemoryType;
    memory_type: MemoryTypeV2;
    source: MemorySource;
    confidence: number;
    content: string;
    inference: string | null;
    topics: string;
    importance: number;
  }
): boolean {
  if (!mem.content) return false;

  const today = new Date().toISOString().slice(0, 10);

  // 1. 查找相似记忆（仅 active，排除已归档）
  const existing = findSimilar(userId, characterId, mem.content, mem.topics);

  if (existing) {
    // 2a. 同义合并：新记忆置信度更高 → 更新旧记忆
    if (mem.confidence >= existing.confidence && mem.source === "user_stated") {
      dbOps.execute(
        `UPDATE memories_v2
         SET content = ?, inference = ?, confidence = ?, source = ?, type = ?,
             memory_type = ?, importance = MAX(?, importance), updated_at = datetime('now')
         WHERE id = ?`,
        [
          mem.content, mem.inference, mem.confidence, mem.source, mem.type,
          mem.memory_type, mem.importance, existing.id,
        ]
      );
      return true;
    } else if (isSameContent(mem.content, existing.content)) {
      return false;
    }
    if (isConflict(mem.content, existing.content)) {
      dbOps.execute(
        "UPDATE memories_v2 SET status = 'outdated', updated_at = datetime('now') WHERE id = ?",
        [existing.id]
      );
    }
  }

  // 3. 存入新记忆
  const id = uuid();
  dbOps.execute(
    `INSERT INTO memories_v2 (id, user_id, character_id, date, type, memory_type, source,
                              confidence, content, inference, topics, importance, status, archived)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0)`,
    [
      id, userId, characterId, today,
      mem.type, mem.memory_type, mem.source, mem.confidence,
      mem.content, mem.inference, mem.topics, mem.importance,
    ]
  );

  // 4. 检查是否需要归档（异步不阻塞，忽略错误）
  cleanupMemories(userId, characterId).catch(() => {});

  return true;
}

/** 查找相似记忆 */
function findSimilar(
  userId: string,
  characterId: string,
  content: string,
  topics: string
): MemoryRecord | null {
  // 先按 topics 查
  if (topics) {
    const topicList = topics.split(",").map((t) => t.trim()).filter(Boolean);
    for (const topic of topicList) {
      const rows = dbOps.queryAll(
        `SELECT * FROM memories_v2
         WHERE user_id = ? AND character_id = ? AND status = 'active' AND archived = 0
           AND topics LIKE ?
         LIMIT 5`,
        [userId, characterId, `%${topic}%`]
      );
      for (const row of rows) {
        if (isSimilarContent(content, row.content)) return row;
      }
    }
  }

  // 再全文模糊匹配
  const all = dbOps.queryAll(
    `SELECT * FROM memories_v2
     WHERE user_id = ? AND character_id = ? AND status = 'active' AND archived = 0
     ORDER BY created_at DESC
     LIMIT 50`,
    [userId, characterId]
  );
  for (const row of all) {
    if (isSimilarContent(content, row.content)) return row;
  }
  return null;
}

/** 简单的内容相似度判断（基于关键词重叠） */
function isSimilarContent(a: string, b: string): boolean {
  const norm = (s: string) => {
    const stopWords = ["的", "了", "是", "在", "我", "他", "她", "你", "也", "就", "都", "很", "和", "吗", "呢", "吧", "啊"];
    const chars = s.replace(/[，。！？、\s,.!?\n]/g, "").split("");
    return new Set(chars.filter((c) => !stopWords.includes(c)));
  };
  const setA = norm(a);
  const setB = norm(b);
  if (setA.size === 0 || setB.size === 0) return false;
  const intersect = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersect.size / union.size > 0.5;
}

/** 完全相同 */
function isSameContent(a: string, b: string): boolean {
  return isSimilarContent(a, b) && Math.abs(a.length - b.length) < 5;
}

/** 冲突检测：话题相同但内容矛盾 */
function isConflict(a: string, b: string): boolean {
  // 简化版：如果话题相同但内容不同且置信度接近，标记为可能冲突
  // 真实实现可以用 LLM 判断，这里用简单规则
  return false; // 暂不自动标记冲突，保守策略
}

// ============================================================
// 偏好管理
// ============================================================

export function getPreferences(userId: string, characterId: string): UserPreferences {
  const row = dbOps.queryOne(
    "SELECT preferences_json FROM user_preferences WHERE user_id = ? AND character_id = ?",
    [userId, characterId]
  );
  if (!row) return {};
  try { return JSON.parse(row.preferences_json); } catch { return {}; }
}

function updatePreferences(userId: string, characterId: string, updates: Record<string, any>): void {
  const existing = getPreferences(userId, characterId);
  const merged = { ...existing, ...updates };
  const json = JSON.stringify(merged, null, 2);

  const row = dbOps.queryOne(
    "SELECT user_id FROM user_preferences WHERE user_id = ? AND character_id = ?",
    [userId, characterId]
  );
  if (row) {
    dbOps.execute(
      "UPDATE user_preferences SET preferences_json = ?, updated_at = datetime('now') WHERE user_id = ? AND character_id = ?",
      [json, userId, characterId]
    );
  } else {
    dbOps.execute(
      "INSERT INTO user_preferences (user_id, character_id, preferences_json) VALUES (?, ?, ?)",
      [userId, characterId, json]
    );
  }
}

// ============================================================
// 记忆检索
// ============================================================

/** 按状态和类型获取记忆 */
export function getMemories(
  userId: string,
  characterId: string,
  options: {
    types?: MemoryType[];
    sources?: MemorySource[];
    status?: MemoryStatus;
    limit?: number;
  } = {}
): MemoryRecord[] {
  const conditions: string[] = ["user_id = ?", "character_id = ?", "archived = 0"];
  const params: any[] = [userId, characterId];

  if (options.status) {
    conditions.push("status = ?");
    params.push(options.status);
  } else {
    conditions.push("status = 'active'");
  }

  if (options.types?.length) {
    conditions.push(`type IN (${options.types.map(() => "?").join(",")})`);
    params.push(...options.types);
  }

  if (options.sources?.length) {
    conditions.push(`source IN (${options.sources.map(() => "?").join(",")})`);
    params.push(...options.sources);
  }

  const limit = options.limit || 50;
  return dbOps.queryAll(
    `SELECT * FROM memories_v2
     WHERE ${conditions.join(" AND ")}
     ORDER BY importance DESC, created_at DESC
     LIMIT ?`,
    [...params, limit]
  );
}

/** 根据当前话题检索相关记忆 */
export function getRelevantMemories(
  userId: string,
  characterId: string,
  topics: string[],
  limit = 10
): MemoryRecord[] {
  if (topics.length === 0) return getMemories(userId, characterId, { limit });

  const conditions = topics.map(() => "topics LIKE ?").join(" OR ");
  const params = topics.map((t) => `%${t}%`);
  return dbOps.queryAll(
    `SELECT * FROM memories_v2
     WHERE user_id = ? AND character_id = ? AND status = 'active' AND archived = 0 AND (${conditions})
     ORDER BY importance DESC, created_at DESC
     LIMIT ?`,
    [userId, characterId, ...params, limit]
  );
}

/** 获取用户明确的偏好记忆 */
export function getPreferenceMemories(userId: string, characterId: string): MemoryRecord[] {
  return getMemories(userId, characterId, { types: ["preference"] });
}

// ============================================================
// V0.3.2 记忆使用追踪
// ============================================================

/** 记录记忆被注入到上下文中（更新 last_used_at） */
function recordMemoryUsage(memoryIds: string[]): void {
  if (memoryIds.length === 0) return;
  const now = new Date().toISOString();
  const placeholders = memoryIds.map(() => "?").join(",");
  dbOps.execute(
    `UPDATE memories_v2 SET last_used_at = ? WHERE id IN (${placeholders})`,
    [now, ...memoryIds]
  );
}

// ============================================================
// V0.3.2 记忆归档
// ============================================================

/** 当 active 记忆超过上限时，归档低分记忆 */
async function cleanupMemories(userId: string, characterId: string): Promise<void> {
  const active = dbOps.queryOne(
    `SELECT COUNT(*) as cnt FROM memories_v2
     WHERE user_id = ? AND character_id = ? AND status = 'active' AND archived = 0`,
    [userId, characterId]
  );
  if (!active || (active as any).cnt <= MAX_ACTIVE_MEMORIES) return;

  // 计算超出数量
  const excess = (active as any).cnt - MAX_ACTIVE_MEMORIES;
  console.log(`  📦 记忆归档: active=${(active as any).cnt}, 超出${excess}条`);

  // 取 importance ≤ 4 的记忆，按得分升序（最差的先归档）
  const noise = dbOps.queryAll(
    `SELECT id, importance, memory_type, date, last_used_at FROM memories_v2
     WHERE user_id = ? AND character_id = ? AND status = 'active' AND archived = 0
       AND importance <= 4
     ORDER BY importance ASC, date ASC
     LIMIT ?`,
    [userId, characterId, excess]
  );

  let archived = 0;
  for (const m of noise) {
    dbOps.execute(
      "UPDATE memories_v2 SET archived = 1, updated_at = datetime('now') WHERE id = ?",
      [m.id]
    );
    archived++;
  }

  // 如果 Noise 不够，继续归档 Normal 中最低分的
  if (archived < excess) {
    const remaining = excess - archived;
    const normal = dbOps.queryAll(
      `SELECT id FROM memories_v2
       WHERE user_id = ? AND character_id = ? AND status = 'active' AND archived = 0
         AND importance BETWEEN 5 AND 7
       ORDER BY importance ASC, date ASC
       LIMIT ?`,
      [userId, characterId, remaining]
    );
    for (const m of normal) {
      dbOps.execute(
        "UPDATE memories_v2 SET archived = 1, updated_at = datetime('now') WHERE id = ?",
        [m.id]
      );
      archived++;
    }
  }

  if (archived > 0) console.log(`  📦 已归档 ${archived} 条记忆`);
}

// ============================================================
// V0.3.2 综合评分公式
// ============================================================

/**
 * 记忆综合评分 = importance × type_weight × time_decay × usage_recency
 * 用于检索排序。Sacred(10) 永远排在最前面。
 */
function computeCompositeScore(m: MemoryRecord | any): number {
  const importance = m.importance || 5;
  const memoryType: MemoryTypeV2 = m.memory_type || "fact";

  // 1. 类型权重
  const typeWeight = MEMORY_TYPE_WEIGHT[memoryType] || 1.0;

  // 2. 时间衰减（Sacred 不衰减）
  const daysSince = Math.max(
    0,
    (Date.now() - new Date(m.date).getTime()) / (1000 * 60 * 60 * 24)
  );
  let timeDecay: number;
  if (importance === 10) {
    timeDecay = 1.0; // Sacred 永不衰减
  } else if (importance >= 8) {
    timeDecay = Math.max(0.85, 1.0 - daysSince * 0.002);
  } else if (importance >= 5) {
    timeDecay = Math.max(0.3, 1.0 - daysSince * 0.023);
  } else {
    timeDecay = Math.max(0.05, 1.0 - daysSince * 0.1);
  }

  // 3. 使用频率加成（最近被引用过的记忆获得小幅加分）
  let usageBonus = 1.0;
  if (m.last_used_at) {
    const hoursSinceUse = Math.max(
      0,
      (Date.now() - new Date(m.last_used_at).getTime()) / (1000 * 60 * 60)
    );
    if (hoursSinceUse < 1) usageBonus = 1.3;        // 最近1小时内用过
    else if (hoursSinceUse < 24) usageBonus = 1.15;  // 24小时内
    else if (hoursSinceUse < 72) usageBonus = 1.05;  // 3天内
  }

  return importance * typeWeight * timeDecay * usageBonus;
}

/** 获取记忆，按 V0.3.2 综合评分排序 */
function getMemoriesWithCompositeScore(
  userId: string,
  characterId: string,
  options: {
    types?: MemoryType[];
    sources?: MemorySource[];
    limit?: number;
  } = {}
): MemoryRecord[] {
  const memories = getMemories(userId, characterId, options);
  return memories
    .map((m) => ({ ...m, _score: computeCompositeScore(m) }))
    .sort((a: any, b: any) => b._score - a._score)
    .slice(0, options.limit || 50);
}

// ============================================================
// 记忆修正
// ============================================================

/** 用户明确纠正 → 旧记忆标记为 corrected，存入新记忆（最高置信度） */
export function correctMemory(
  userId: string,
  characterId: string,
  oldMemoryId: string,
  newContent: string
): string {
  // 标记旧记忆
  dbOps.execute(
    "UPDATE memories_v2 SET status = 'corrected', updated_at = datetime('now') WHERE id = ? AND user_id = ?",
    [oldMemoryId, userId]
  );

  // 存入新记忆
  const id = uuid();
  const today = new Date().toISOString().slice(0, 10);
  dbOps.execute(
    `INSERT INTO memories_v2 (id, user_id, character_id, date, type, source, confidence,
                              content, inference, importance, status, replaces_id)
     VALUES (?, ?, ?, ?, 'fact', 'user_stated', 1.0, ?, NULL, 10, 'active', ?)`,
    [id, userId, characterId, today, newContent, oldMemoryId]
  );
  return id;
}

/** 标记记忆为过期 */
export function deprecateMemory(memoryId: string, userId: string): void {
  dbOps.execute(
    "UPDATE memories_v2 SET status = 'deprecated', updated_at = datetime('now') WHERE id = ? AND user_id = ?",
    [memoryId, userId]
  );
}

// ============================================================
// 时间线
// ============================================================

function addTimelineEvent(
  userId: string,
  characterId: string,
  event: { title: string; description: string; perspective: string; jinceiaNarrative?: string }
): void {
  // 避免重复
  const existing = dbOps.queryOne(
    "SELECT id FROM shared_timeline WHERE user_id = ? AND character_id = ? AND title = ?",
    [userId, characterId, event.title]
  );
  if (existing) return;

  const id = uuid();
  const today = new Date().toISOString().slice(0, 10);
  dbOps.execute(
    `INSERT INTO shared_timeline (id, user_id, character_id, date, title, description, perspective, jinceia_narrative)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, characterId, today, event.title, event.description, event.perspective, event.jinceiaNarrative || null]
  );
  console.log(`  📅 时间线: ${event.title}`);
}

// ============================================================
// Jinceia 视角记忆
// ============================================================

function saveJinceiaPerspective(userId: string, characterId: string, narrative: string): void {
  const id = uuid();
  const today = new Date().toISOString().slice(0, 10);
  dbOps.execute(
    `INSERT INTO jinceia_perspectives (id, user_id, character_id, date, narrative)
     VALUES (?, ?, ?, ?, ?)`,
    [id, userId, characterId, today, narrative]
  );
}

export function getJinceiaPerspectives(userId: string, characterId: string, limit = 10) {
  return dbOps.queryAll(
    `SELECT * FROM jinceia_perspectives
     WHERE user_id = ? AND character_id = ?
     ORDER BY date DESC, created_at DESC
     LIMIT ?`,
    [userId, characterId, limit]
  );
}

// ============================================================
// V0.3.5 行为提示（Insight → Behavior）
// ============================================================

/** 保存行为提示，去重合并 */
function saveBehavioralHints(
  userId: string,
  characterId: string,
  hints: string[]
): void {
  if (hints.length === 0) return;

  const active = getActiveBehavioralHints(userId, characterId);

  for (const hint of hints) {
    // 简单去重：与已有 hint 相似度 > 0.5 则跳过
    const isDuplicate = active.some(
      (existing) => isSimilarContent(hint, existing.hint)
    );
    if (isDuplicate) continue;

    const id = uuid();
    dbOps.execute(
      `INSERT INTO behavioral_hints (id, user_id, character_id, hint, source_insight_ids, status)
       VALUES (?, ?, ?, ?, '', 'active')`,
      [id, userId, characterId, hint]
    );
  }

  // 限制 active hints 数量：超过 8 条时，保留最新的
  const allActive = getActiveBehavioralHints(userId, characterId);
  if (allActive.length > 8) {
    const toArchive = allActive.slice(8);
    for (const h of toArchive) {
      dbOps.execute(
        "UPDATE behavioral_hints SET status = 'superseded', updated_at = datetime('now') WHERE id = ?",
        [h.id]
      );
    }
    console.log(`  🎯 行为提示: 归档 ${toArchive.length} 条旧提示，保留 8 条`);
  }
}

/** 获取当前活跃的行为提示 */
function getActiveBehavioralHints(
  userId: string,
  characterId: string
): Array<{ id: string; hint: string }> {
  return dbOps.queryAll(
    `SELECT id, hint FROM behavioral_hints
     WHERE user_id = ? AND character_id = ? AND status = 'active'
     ORDER BY created_at DESC
     LIMIT 8`,
    [userId, characterId]
  );
}

/** 构建行为提示注入文本 */
function buildBehavioralHintsContext(
  userId: string,
  characterId: string
): string {
  const hints = getActiveBehavioralHints(userId, characterId);
  if (hints.length === 0) return "";

  return hints.map((h) => `- ${h.hint}`).join("\n");
}

// ============================================================
// V0.3.6 认知修正（Correction Events）
// ============================================================

/** 保存认知修正事件，同时标记旧记忆为 corrected */
function saveCorrectionEvent(
  userId: string,
  characterId: string,
  correction: { oldMemoryId: string | null; oldBelief: string; newBelief: string }
): void {
  if (!correction.oldBelief || !correction.newBelief) return;

  // 去重：同一天同一对 oldBelief → newBelief 不重复保存
  const today = new Date().toISOString().slice(0, 10);
  const existing = dbOps.queryOne(
    `SELECT id FROM correction_events
     WHERE user_id = ? AND character_id = ? AND old_belief = ? AND new_belief = ? AND date(created_at) = ?`,
    [userId, characterId, correction.oldBelief, correction.newBelief, today]
  );
  if (existing) return;

  // 如果提供了旧记忆 ID，标记旧记忆为 corrected
  if (correction.oldMemoryId) {
    dbOps.execute(
      "UPDATE memories_v2 SET status = 'corrected', updated_at = datetime('now') WHERE id = ? AND user_id = ?",
      [correction.oldMemoryId, userId]
    );
  }

  const id = uuid();
  dbOps.execute(
    `INSERT INTO correction_events (id, user_id, character_id, old_memory_id, old_belief, new_belief, surfaced)
     VALUES (?, ?, ?, ?, ?, ?, 0)`,
    [id, userId, characterId, correction.oldMemoryId, correction.oldBelief, correction.newBelief]
  );
}

/** 获取尚未浮现的修正事件 */
function getUnsurfacedCorrections(
  userId: string,
  characterId: string
): Array<{ id: string; oldBelief: string; newBelief: string }> {
  return dbOps.queryAll(
    `SELECT id, old_belief, new_belief FROM correction_events
     WHERE user_id = ? AND character_id = ? AND surfaced = 0
     ORDER BY created_at DESC
     LIMIT 5`,
    [userId, characterId]
  );
}

/** 构建认知修正注入文本（低位浮现） */
function buildCorrectionContext(
  userId: string,
  characterId: string
): string {
  const corrections = getUnsurfacedCorrections(userId, characterId);
  if (corrections.length === 0) return "";

  const lines = corrections.map((c) =>
    `- 旧认知: "${c.oldBelief}" → 新认知: "${c.newBelief}"`
  );

  return `## 你的认知修正\n\n以下是你发现并修正的理解错误。这些**只在话题自然触及时**提到——不要生硬地翻旧账。\n\n${lines.join("\n")}\n\n修正规则：\n- 只在话题自然触及时提到。不要主动说"对了，我以前以为…"\n- 提到时用轻松的语气。"等一下，你上次说…那我之前记错了。"\n- 承认错误不需要解释。直接说"我记错了"就够了。\n- 如果当前话题和任何修正都无关 → 不提。沉默比尬聊好。`;
}

/** 查询修正事件 */
export function getCorrectionEvents(
  userId: string,
  characterId: string,
  limit = 20
): Array<{ id: string; oldBelief: string; newBelief: string; surfaced: number; createdAt: string }> {
  return dbOps.queryAll(
    `SELECT id, old_belief, new_belief, surfaced, created_at FROM correction_events
     WHERE user_id = ? AND character_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [userId, characterId, limit]
  );
}

/** 标记修正事件为已浮现 */
function markCorrectionsSurfaced(userId: string, characterId: string): void {
  dbOps.execute(
    `UPDATE correction_events SET surfaced = 1, surfaced_at = datetime('now')
     WHERE user_id = ? AND character_id = ? AND surfaced = 0`,
    [userId, characterId]
  );
}

export function getSharedTimeline(userId: string, characterId: string, limit = 20): TimelineEvent[] {
  return dbOps.queryAll(
    `SELECT * FROM shared_timeline
     WHERE user_id = ? AND character_id = ?
     ORDER BY date DESC
     LIMIT ?`,
    [userId, characterId, limit]
  );
}

// ============================================================
// 上下文相关记忆检索（LLM 评分）
// ============================================================

/**
 * 根据用户当前消息，用 LLM 从候选池中选出最相关的 3-5 条记忆。
 * 候选池包含：事实、推断、她的日记、时间线事件。
 * 日记和推断的优先级高于事实。
 */
async function getContextualMemories(
  userId: string,
  characterId: string,
  userMessage: string
): Promise<CandidateMemory[]> {
  const candidates: CandidateMemory[] = [];

  // 1. 事实 + 推断 + 事件（按衰减分数取 Top 15）
  const factsAndInferences = getMemoriesWithCompositeScore(userId, characterId, {
    types: ["fact", "identity", "inference", "event"],
    limit: 15,
  });
  for (const m of factsAndInferences) {
    candidates.push({
      id: (m as any).id,
      type: m.type === "inference" ? "inference" : "fact",
      content: (m as any).inference || m.content,
      date: m.date,
      importance: m.importance,
      inference: (m as any).inference || null,
      memory_type: (m as any).memory_type || "fact", // V0.3.2 价值分类，用于检索排序
    });
  }

  // 2. 她的日记（最近 10 条）
  const perspectives = getJinceiaPerspectives(userId, characterId, 10);
  for (const p of perspectives as any[]) {
    candidates.push({
      id: p.id,
      type: "perspective",
      content: p.narrative,
      date: p.date,
      importance: 8, // 日记天然重要
    });
  }

  // 3. 时间线事件（最近 10 条）
  const timeline = getSharedTimeline(userId, characterId, 10);
  for (const e of timeline) {
    candidates.push({
      id: e.id,
      type: "timeline_event",
      content: `${e.title}：${e.description}`,
      date: e.date,
      importance: 7,
    });
  }

  // 候选太少就直接返回
  if (candidates.length <= 5) return candidates;

  // 4. 本地综合评分排序（替代 LLM 调用，节省 500-2000ms 阻塞延迟）
  //    评分 = importance × type_weight × time_decay × usage_bonus × keyword_relevance
  const userWords = new Set(
    userMessage
      .split(/[\s，。！？、\n,.!?]+/)
      .filter((w) => w.length > 1)
  );

  const scored = candidates.map((c) => {
    let score = computeCandidateCompositeScore(c);

    // 关键词相关性加成：用户消息中的词出现在候选内容中
    const contentWords = c.content.split(/[\s，。！？、]+/);
    const overlap = contentWords.filter((w) => userWords.has(w)).length;
    if (overlap > 0) score *= 1 + overlap * 0.25;

    return { candidate: c, score };
  });

  scored.sort((a, b) => b.score - a.score);

  console.log(
    `  🎯 本地评分: ${scored.length} 条候选 → Top ${Math.min(5, scored.length)} 已选`
  );

  return scored.slice(0, 5).map((s) => s.candidate);
}

/** 计算候选记忆的本地综合评分 */
function computeCandidateCompositeScore(c: CandidateMemory): number {
  const importance = c.importance || 5;
  const typeWeight = getCandidateWeight(c);

  // 时间衰减
  const daysSince = Math.max(
    0,
    (Date.now() - new Date(c.date).getTime()) / (1000 * 60 * 60 * 24)
  );
  let timeDecay: number;
  if (importance >= 10) {
    timeDecay = 1.0;
  } else if (importance >= 8) {
    timeDecay = Math.max(0.85, 1.0 - daysSince * 0.002);
  } else if (importance >= 5) {
    timeDecay = Math.max(0.3, 1.0 - daysSince * 0.023);
  } else {
    timeDecay = Math.max(0.05, 1.0 - daysSince * 0.1);
  }

  return importance * typeWeight * timeDecay;
}

// ============================================================
// 记忆上下文构建（注入 system prompt）— V0.3.1 三层结构
// ============================================================

/**
 * 构建记忆上下文，三层结构：
 * - 固定层：偏好 + 基本身份（始终注入，量小）
 * - 相关层：LLM 根据当前消息精选的 3-5 条记忆（动态）
 * - 背景层：未来事件 + 最近日记（保持连续性）
 *
 * @param userMessage 可选——传入时启用 LLM 相关性检索；不传时降级为静态排序
 */
export async function buildMemoryContext(
  userId: string,
  characterId: string,
  userMessage?: string
): Promise<string> {
  const parts: string[] = [];
  const injectedIds: string[] = [];

  // ============================================================
  // 第〇层：行为提示（Insight → Behavior，V0.3.5 最高优先级）
  // ============================================================

  const behavioralHints = buildBehavioralHintsContext(userId, characterId);
  if (behavioralHints) {
    parts.push("## 你学到的互动方式\n\n基于你对他的持续理解，这些洞察影响你如何与他相处：\n\n" + behavioralHints + "\n\n注意：这不是规则脚本。这是你的理解。用你的方式自然地应用——不要让它们看起来像你在执行指令。");
  }

  // ============================================================
  // 第 0.5 层：认知修正（V0.3.6 — 在她理解自己错了之后浮现）
  // ============================================================

  const correctionContext = buildCorrectionContext(userId, characterId);
  if (correctionContext) {
    parts.push(correctionContext);
    // 注入后标记为 surfaced — 给她一次自然提及的机会
    markCorrectionsSurfaced(userId, characterId);
  }

  // ============================================================
  // 第一层：固定（偏好 + 核心身份）
  // ============================================================

  const prefs = getPreferences(userId, characterId);
  if (Object.keys(prefs).length > 0) {
    const lines: string[] = [];
    if (prefs.call_name) lines.push(`- 他希望被称呼为「${prefs.call_name}」`);
    if (lines.length > 0) {
      parts.push("## 他的偏好\n" + lines.join("\n"));
    }
  }

  // 核心身份（只要最重要的 3 条，不占篇幅）
  const identity = getMemoriesWithCompositeScore(userId, characterId, {
    types: ["fact", "identity"],
    sources: ["user_stated"],
    limit: 3,
  });
  identity.forEach((m) => injectedIds.push((m as MemoryRecord).id));
  if (identity.length > 0) {
    const idLines = identity.map((m) => `- ${m.content}`).join("\n");
    parts.push("## 关于他\n" + idLines);
  }

  // ============================================================
  // 第二层：相关（LLM 精选 — 这是 V0.3.1 的核心）
  // ============================================================

  if (userMessage) {
    const relevant = await getContextualMemories(userId, characterId, userMessage);
    relevant.forEach((m) => injectedIds.push(m.id));

    if (relevant.length > 0) {
      const lines = relevant.map((m) => {
        switch (m.type) {
          case "perspective":
            return `- 💜 [你的日记 ${m.date}] ${m.content}`;
          case "inference":
            return `- 🧠 [你的理解] ${m.content}`;
          case "timeline_event":
            return `- 📅 [时间线 ${m.date}] ${m.content}`;
          case "fact":
          default:
            return `- 📌 ${m.content}`;
        }
      });
      parts.push("## 与当前话题相关的记忆\n" + lines.join("\n"));
    }
  } else {
    // 降级：没有用户消息时，用静态排序（向后兼容 debug 等场景）
    const facts = getMemoriesWithCompositeScore(userId, characterId, {
      types: ["fact", "identity"],
      sources: ["user_stated"],
      limit: 5,
    });
    facts.forEach((m) => injectedIds.push((m as MemoryRecord).id));
    if (facts.length > 0) {
      const factLines = facts.map((m) => `- ${m.content}`).join("\n");
      parts.push("## 你确定知道的\n" + factLines);
    }

    const inferences = getMemoriesWithCompositeScore(userId, characterId, {
      types: ["inference"],
      limit: 5,
    });
    inferences.forEach((m) => injectedIds.push((m as MemoryRecord).id));
    if (inferences.length > 0) {
      const infLines = inferences
        .map((m) => `- ${(m as MemoryRecord).inference || m.content}`)
        .join("\n");
      parts.push("## 你的理解\n" + infLines);
    }
  }

  // ============================================================
  // 第三层：背景（未来事件 + 最近感受）
  // ============================================================

  // 未来计划
  const events = getMemories(userId, characterId, { types: ["event"], limit: 3 });
  events.forEach((m) => injectedIds.push(m.id));
  if (events.length > 0) {
    const evLines = events.map((m) => `- ⏰ ${m.content}`).join("\n");
    parts.push("## 他接下来的事\n" + evLines);
  }

  // 最近日记（2 条，保持自我连续性）
  const perspectives = getJinceiaPerspectives(userId, characterId, 2);
  if (perspectives.length > 0) {
    const pLines = (perspectives as any[])
      .sort((a: any, b: any) => a.date.localeCompare(b.date))
      .map((p: any) => `- ${p.date}：${p.narrative}`)
      .join("\n\n");
    parts.push("## 你最近的感受\n" + pLines);
  }

  const context = parts.join("\n\n");

  // 审计记录 + 使用追踪
  recordAudit(userId, characterId, injectedIds, context);
  recordMemoryUsage(injectedIds);

  return context;
}

// ============================================================
// 工具函数
// ============================================================

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
