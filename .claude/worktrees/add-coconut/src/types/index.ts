// ─── 角色 / 人设 ───
export type CharacterType = 'preset' | 'custom'
export type CharacterGender = 'male' | 'female'

export interface CharacterPersonality {
  traits: string[]       // ['温柔', '成熟', '占有欲强']
  tone: string           // 语调描述
  catchphrase: string    // 口头禅
  speaking_style: string // 说话风格描述
}

export interface Character {
  id: string
  name: string
  type: CharacterType
  gender: CharacterGender
  avatar_url: string
  age: number
  occupation: string
  personality: CharacterPersonality
  backstory: string
  tags: string[]
  is_public: boolean
  owner_id?: string
  created_at: string
}

// ─── 关系系统 ───
export type RelationshipStage =
  | 'stranger'
  | 'acquaintance'
  | 'familiar'
  | 'crush'
  | 'lover'
  | 'intimate'
  | 'soulmate'

export interface RelationshipDimensions {
  intimacy: number       // 亲密度 0-100
  trust: number          // 信任度 0-100
  understanding: number  // 了解度 0-100
  chemistry: number      // 默契度 0-100
  passion: number        // 激情度 0-100
}

export interface Relationship {
  id: string
  user_id: string
  character_id: string
  stage: RelationshipStage
  dimensions: RelationshipDimensions
  affection: number      // 综合好感度
  chat_total: number
  chat_days: number
  first_chat_at: string | null
  last_chat_at: string | null
  created_at: string
  updated_at: string
}

export interface DimensionChange {
  intimacy: number
  trust: number
  understanding: number
  chemistry: number
  passion: number
}

// ─── 情绪状态 ───
export type MoodType =
  | 'happy' | 'calm' | 'anxious' | 'sad' | 'angry'
  | 'excited' | 'tired' | 'lonely' | 'loving' | 'neutral'

export type MoodTrend = 'improving' | 'stable' | 'declining'

export interface EmotionalState {
  current_mood: MoodType
  mood_score: number       // 0(极负面) ~ 1(极正面)
  mood_intensity: number   // 0~1
  mood_trend: MoodTrend
  stress_level: number     // 0-100
  anxiety_level: number    // 0-100
  engagement: number       // 互动积极性 0~1
  last_assessed_at: string
}

// ─── 聊天消息 ───
export type MessageRole = 'user' | 'assistant'
export type MessageContentType = 'text' | 'voice' | 'image'

export interface Message {
  id: string
  conversation_id: string
  role: MessageRole
  content: string
  content_type: MessageContentType
  tokens_used?: number
  created_at: string
}

export interface Conversation {
  id: string
  user_id: string
  character_id: string
  title: string
  last_message: string
  message_count: number
  created_at: string
  updated_at: string
}

// ─── 记忆 ───
export type MemoryCategory =
  | 'user_profile'
  | 'preference'
  | 'life_event'
  | 'milestone'
  | 'emotional'
  | 'daily_fragment'

export interface Memory {
  id: string
  relationship_id: string
  category: MemoryCategory
  key: string
  content: string
  importance: number
  source_msg_ids: string[]
  created_at: string
  expires_at?: string
}

// ─── 关系事件 ───
export type RelationshipEventType =
  | 'first_chat'
  | 'name_exchange'
  | 'first_night_chat'
  | 'secret_shared'
  | 'first_compliment'
  | 'first_voice'
  | 'first_i_love_you'
  | 'confession'
  | 'first_fight'
  | 'make_up'
  | 'anniversary'
  | 'deep_share'
  | 'nickname_created'
  | 'first_miss_you'
  | 'soul_talk'

export interface RelationshipEvent {
  id: string
  relationship_id: string
  event_type: RelationshipEventType
  title: string
  description: string
  occurred_at: string
}

// ─── SSE 事件类型 ───
export type SSEEventType = 'delta' | 'affection' | 'milestone' | 'stage_up' | 'done' | 'error'

export interface SSEDeltaEvent {
  type: 'delta'
  content: string
}

export interface SSEAffectionEvent {
  type: 'affection'
  changes: DimensionChange
  total_affection: number
}

export interface SSEMilestoneEvent {
  type: 'milestone'
  event_type: RelationshipEventType
  title: string
}

export interface SSEStageUpEvent {
  type: 'stage_up'
  from: RelationshipStage
  to: RelationshipStage
}

export interface SSEDoneEvent {
  type: 'done'
  message_id: string
  tokens_used: number
}

export type SSEEvent = SSEDeltaEvent | SSEAffectionEvent | SSEMilestoneEvent | SSEStageUpEvent | SSEDoneEvent
