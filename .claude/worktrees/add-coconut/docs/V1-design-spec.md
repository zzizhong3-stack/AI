# AI Lover V1 设计文档

> 人机恋手机 App — AI 男友/女友陪伴应用
> 版本: V1 MVP | 日期: 2026-06-10

---

## 一、产品定位

人机恋 AI 伴侣 App，核心不是聊天工具，而是**关系成长**。

- **免费层**: 预设 AI 人设，文字聊天
- **会员层**: 自定义人设、更多功能（V2+）

---

## 二、技术栈

| 层面 | V1 方案 | 备注 |
|------|---------|------|
| 前端 | React + Vite + TypeScript | MVP 用 Web 快速验证 |
| 状态管理 | Zustand | 后续可迁移 Redux |
| AI 引擎 | DeepSeek API | OpenAI 兼容格式 |
| 本地存储 | localStorage | MVP 阶段 |
| 路由 | React Router v6 | - |
| 后端 | 无（直连 DeepSeek） | MVP 阶段 |

---

## 三、项目结构

```
ai-lover/
├── src/
│   ├── components/
│   │   ├── ChatBubble.tsx
│   │   ├── ChatInput.tsx
│   │   ├── CharacterCard.tsx
│   │   ├── DimensionBar.tsx
│   │   ├── NavBar.tsx
│   │   └── RelationshipStage.tsx
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── CharacterPage.tsx
│   │   ├── ChatPage.tsx
│   │   └── RelationshipPage.tsx
│   ├── services/
│   │   ├── deepseek.ts          # DeepSeek API 调用
│   │   ├── promptBuilder.ts     # 五层 Prompt 构建
│   │   ├── emotionAnalyzer.ts   # 情绪状态分析
│   │   ├── relationshipEngine.ts # 关系维度计算
│   │   └── memoryExtractor.ts   # 记忆提取
│   ├── stores/
│   │   ├── authStore.ts
│   │   ├── chatStore.ts
│   │   ├── characterStore.ts
│   │   └── relationshipStore.ts
│   ├── types/
│   │   └── index.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── .env.example
```

---

## 四、数据库模型（完整设计）

### users
```sql
id UUID PK, phone VARCHAR UNIQUE, nickname VARCHAR, avatar_url TEXT,
gender ENUM, birthday DATE, membership ENUM, member_until TIMESTAMP, created_at
```

### characters
```sql
id UUID PK, name VARCHAR, type ENUM('preset','custom'), owner_id FK,
gender ENUM, avatar_url TEXT, voice_id VARCHAR, personality JSONB,
backstory TEXT, system_prompt TEXT, speaking_style JSONB, tags TEXT[],
is_public BOOLEAN, chat_count INT, created_at
```

### conversations
```sql
id UUID PK, user_id FK, character_id FK, title VARCHAR,
last_message TEXT, message_count INT, created_at, updated_at
```

### messages
```sql
id UUID PK, conversation_id FK, role ENUM('user','assistant'),
content TEXT, content_type ENUM('text','voice','image'),
audio_url TEXT, tokens_used INT, created_at
```

### relationships
```sql
id UUID PK, user_id FK, character_id FK,
stage ENUM('stranger','acquaintance','familiar','crush','lover','intimate','soulmate'),
intimacy INT, trust INT, understanding INT, chemistry INT, passion INT,
affection INT, chat_total INT, chat_days INT, voice_minutes INT,
last_chat_at, created_at, updated_at
UNIQUE(user_id, character_id)
```

### user_emotional_state
```sql
id UUID PK, relationship_id FK,
current_mood ENUM('happy','calm','anxious','sad','angry','excited','tired','lonely','loving','neutral'),
mood_score FLOAT, mood_intensity FLOAT, mood_trend ENUM('improving','stable','declining'),
stress_level INT, anxiety_level INT,
attachment_style ENUM('secure','anxious','avoidant','unknown'),
engagement FLOAT, last_assessed_at, confidence FLOAT, source_msg_id FK, updated_at
```

### relationship_events
```sql
id UUID PK, relationship_id FK,
event_type ENUM('first_chat','name_exchange','first_night_chat','secret_shared',
'first_compliment','first_voice','first_i_love_you','confession','first_fight',
'make_up','anniversary','deep_share','nickname_created','first_miss_you','soul_talk'),
title VARCHAR, description TEXT, occurred_at, created_at
```

### interaction_events
```sql
id UUID PK, relationship_id FK,
type ENUM('morning_greeting','night_greeting','weather_reminder','surprise_gift',
'date_invitation','memory_recall','mood_detect','jealousy','love_letter'),
content TEXT, status ENUM('pending','delivered','read','responded'),
triggered_by ENUM('schedule','stage_unlock','mood','random'),
delivered_at, created_at
```

### memories
```sql
id UUID PK, relationship_id FK,
category ENUM('user_profile','preference','life_event','milestone','emotional','daily_fragment'),
key VARCHAR, content TEXT, embedding VECTOR(1536),
importance INT, confidence FLOAT, source_msgs UUID[],
version INT, status ENUM('active','outdated','merged'),
merged_to UUID, expires_at, last_recall_at, recall_count INT,
created_at, updated_at
```

### chat_summaries
```sql
id UUID PK, relationship_id FK,
level INT, time_range TSRANGE, summary TEXT,
key_moments JSONB, msg_ids UUID[],
token_count INT, compressed_count INT, ratio FLOAT, created_at
```

### subscriptions
```sql
id UUID PK, user_id FK, plan ENUM('monthly','yearly'),
status ENUM('active','cancelled','expired'),
started_at, expires_at, provider VARCHAR, provider_txn VARCHAR, created_at
```

---

## 五、Prompt 五层结构

```
Layer 1: System Prompt         ~400 tokens  ← 固定，可缓存
Layer 2: Character Card        ~300 tokens  ← 按人设，可缓存
Layer 3: Relationship Context  ~200 tokens  ← 慢变
Layer 4: Retrieved Memories    ~600 tokens  ← 语义检索
Layer 5: Compressed Context    ~1500 tokens ← 层次化摘要
                          总计 ~3000 tokens 输入
```

---

## 六、Context 压缩机制

```
Level 0: 最近 10-15 轮 → 保留原始消息
Level 1: 最近 2 小时 → 压缩为摘要
Level 2: 今天 → 压缩为一段
Level 3: 昨天 → 压缩为一段
Level 4: 更早 → 按周压缩

压缩比目标: 48:1
```

---

## 七、Memory 体系

### 六类记忆

| 类别 | 存储位置 | 生命周期 | 检索方式 |
|------|---------|---------|---------|
| UserProfile | Vector DB | 永久 | 语义检索 |
| Preference | Vector DB | 90天复查 | 语义检索 |
| LifeEvent | Vector DB | 180天 | 语义检索 |
| Milestone | Vector DB | 永久 | 语义检索 |
| DailyFragment | PostgreSQL | 3天删除 | 时间索引 |
| EmotionalState | PostgreSQL | 实时更新 | 直接加载 |

### 提取时机
- 个人信息陈述句
- 累计 10 轮对话
- 情感转折
- 用户纠正 AI

---

## 八、关系成长系统

### 七阶段
```
Stranger → Acquaintance → Familiar → Crush → Lover → Intimate → Soulmate
```

### 五维模型
- **亲密度 Intimacy**: 分享秘密、表达情感
- **信任度 Trust**: 倾诉烦恼、采纳建议
- **了解度 Understanding**: 用户透露信息
- **默契度 Chemistry**: 互动流畅度
- **激情度 Passion**: 新鲜感、惊喜

### 衰减机制
- 24h 不说话 → passion -1
- 3 天 → intimacy -2, chemistry -3
- 7 天 → trust -1, 可能降级

---

## 九、Token 成本控制

### 消息分层路由
- 60% 短闲聊 → 便宜模型 + 精简上下文 ($0.15/千次)
- 25% 普通对话 → 标准模型 + 标准上下文 ($0.90/千次)
- 10% 深度对话 → 强模型 + 完整上下文 ($3.00/千次)
- 5% 异步任务 → 不计入实时响应

### 缓存策略
- System + Character 层 → 永久缓存
- Relationship + Summary → 会话缓存 (5min TTL)
- Memories + Recent → 每次动态

### 千人日成本估算 (200条/天)
- 优化前: ~$1800/天
- 优化后: ~$123/天
- 月成本: ~$3,690

---

## 十、API 接口设计

### Auth
- POST /auth/send-code
- POST /auth/login
- POST /auth/refresh
- DELETE /auth/logout

### Character
- GET /characters
- GET /characters/:id
- POST /characters (会员)
- PUT /characters/:id
- DELETE /characters/:id

### Conversation
- GET /conversations
- POST /conversations
- GET /conversations/:id
- DELETE /conversations/:id

### Message (SSE 流式)
- GET /conversations/:id/messages
- POST /conversations/:id/messages → SSE: delta/affection/milestone/stage_up/done

### Relationship
- GET /relationships/:id
- GET /relationships/:id/timeline
- GET /relationships/:id/events

### Membership
- GET /membership/plans
- POST /membership/subscribe
- GET /membership/my

---

## 十一、消息处理全流程

```
用户发送消息
  → 存储消息到数据库
  → 情绪状态分析（更新 user_emotional_state）
  → 关系引擎计算（五维变化 + 事件检测 + 阶段评估）
  → Memory 候选提取（异步队列）
  → Prompt 构建（五层拼接）
  → DeepSeek 生成回复（流式返回）
  → 返回用户
  → 异步：记忆提取 + 摘要生成
```

---

*此文档为 V1 设计版本，MVP 实现时会做适当简化。*
*后续版本可从此文档恢复完整功能。*
