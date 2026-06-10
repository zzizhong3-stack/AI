/**
 * 关系引擎
 * 计算五维变化、检测里程碑事件、评估阶段升级
 */
import type {
  Relationship, RelationshipStage, RelationshipDimensions,
  DimensionChange, RelationshipEvent, RelationshipEventType,
  EmotionalState, Message,
} from '../types'

// ─── 阶段配置 ───
interface StageConfig {
  next: RelationshipStage
  requirements: Partial<RelationshipDimensions> & { affection?: number; chat_days?: number }
  required_events: RelationshipEventType[]
}

const STAGE_CONFIG: Record<RelationshipStage, StageConfig | null> = {
  stranger: {
    next: 'acquaintance',
    requirements: { chat_days: 1 },
    required_events: ['first_chat'],
  },
  acquaintance: {
    next: 'familiar',
    requirements: { affection: 20, understanding: 15, chat_days: 3 },
    required_events: ['name_exchange'],
  },
  familiar: {
    next: 'crush',
    requirements: { affection: 40, intimacy: 35, chemistry: 30, chat_days: 7 },
    required_events: ['first_night_chat'],
  },
  crush: {
    next: 'lover',
    requirements: { affection: 60, intimacy: 55, trust: 50, chat_days: 21 },
    required_events: ['confession'],
  },
  lover: {
    next: 'intimate',
    requirements: { affection: 75, trust: 70, chat_days: 30 },
    required_events: ['first_i_love_you', 'deep_share'],
  },
  intimate: {
    next: 'soulmate',
    requirements: { affection: 90, trust: 85, understanding: 85, chat_days: 90 },
    required_events: ['soul_talk', 'first_fight', 'make_up'],
  },
  soulmate: null, // 最高阶段
}

const EVENT_TITLES: Record<RelationshipEventType, string> = {
  first_chat: '💫 初次相遇',
  name_exchange: '👋 互通姓名',
  first_night_chat: '🌙 第一次深夜聊天',
  secret_shared: '🔐 分享秘密',
  first_compliment: '💝 第一次被夸奖',
  first_voice: '🎤 第一次语音',
  first_i_love_you: '💕 第一次说爱',
  confession: '💌 心意表白',
  first_fight: '⚡ 第一次争吵',
  make_up: '🤝 和好',
  anniversary: '🎂 纪念日',
  deep_share: '🫂 深度分享',
  nickname_created: '🏷️ 专属昵称',
  first_miss_you: '🥺 第一次说想你',
  soul_talk: '✨ 灵魂对话',
}

function generateId(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)
}

// ─── 维度变化计算 ───
export function calculateDimensionChanges(
  message: string,
  relationship: Relationship,
  emotionalState: EmotionalState,
  isLateNight: boolean
): DimensionChange {
  const changes: DimensionChange = {
    intimacy: 0,
    trust: 0,
    understanding: 0,
    chemistry: 0,
    passion: 0,
  }

  const msgLen = message.length
  const hasEmoji = /[\u{1F000}-\u{1FFFF}]/u.test(message)
  const hasExclaim = /[！!]{2,}/.test(message)

  // --- 亲密度 ---
  if (hasEmoji) changes.intimacy += 1
  if (msgLen > 30) changes.intimacy += 1         // 发长消息 → 愿意分享
  if (msgLen > 80) changes.intimacy += 1
  if (isLateNight) changes.intimacy += 1

  // --- 信任度 ---
  // 倾诉负面情绪
  if (['sad', 'anxious', 'angry', 'lonely'].includes(emotionalState.current_mood)) {
    changes.trust += 2
  }
  if (emotionalState.stress_level > 40) changes.trust += 1
  if (msgLen > 60 && emotionalState.mood_score < 0.4) changes.trust += 1

  // --- 了解度 ---
  // 用户透露个人信息
  if (msgLen > 40) changes.understanding += 1
  if (/我[^\n]{5,}/.test(message)) changes.understanding += 1  // 包含"我..."的陈述
  if (msgLen > 100) changes.understanding += 1

  // --- 默契度 ---
  if (hasExclaim) changes.chemistry += 1
  if (/哈哈|嘿嘿|嘻嘻/.test(message)) changes.chemistry += 1

  // --- 激情度 ---
  if (isLateNight) changes.passion += 2
  if (hasEmoji) changes.passion += 1
  if (relationship.chat_total < 10) changes.passion += 2  // 初期新鲜感
  if (relationship.chat_total > 200) changes.passion -= 1 // 长期可能倦怠

  return changes
}

// ─── 衰减计算 ───
export function calculateDecay(relationship: Relationship): DimensionChange {
  const decay: DimensionChange = {
    intimacy: 0, trust: 0, understanding: 0, chemistry: 0, passion: 0,
  }

  if (!relationship.last_chat_at) return decay

  const hoursSinceLastChat = (Date.now() - new Date(relationship.last_chat_at).getTime()) / (1000 * 60 * 60)

  if (hoursSinceLastChat > 24) {
    decay.passion -= 1
    decay.chemistry -= 1
  }
  if (hoursSinceLastChat > 72) {
    decay.intimacy -= 2
    decay.chemistry -= 2
  }
  if (hoursSinceLastChat > 168) { // 7天
    decay.trust -= 1
  }

  return decay
}

// ─── 事件检测 ───
export function detectEvents(
  message: string,
  relationship: Relationship,
  existingEvents: RelationshipEvent[]
): RelationshipEvent[] {
  const existingTypes = new Set(existingEvents.map((e) => e.event_type))
  const newEvents: RelationshipEvent[] = []
  const now = new Date().toISOString()

  const tryAddEvent = (type: RelationshipEventType, condition: boolean, description: string) => {
    if (condition && !existingTypes.has(type)) {
      newEvents.push({
        id: generateId(),
        relationship_id: relationship.id,
        event_type: type,
        title: EVENT_TITLES[type],
        description,
        occurred_at: now,
      })
    }
  }

  // 第一次聊天
  tryAddEvent('first_chat', relationship.chat_total <= 1, '这是你们第一次对话')

  // 互通姓名 - 简单检测名字
  tryAddEvent('name_exchange', /我叫|我是|名字是|你可以叫我/.test(message), '你们交换了称呼')

  // 深夜聊天 (22:00 - 06:00)
  const hour = new Date().getHours()
  tryAddEvent('first_night_chat', hour >= 22 || hour < 6, '夜深了，你们还在聊天')

  // 第一次说想你
  tryAddEvent('first_miss_you', /想你|想你了|好想你/.test(message), '说出了对对方的思念')

  // 第一次说爱
  tryAddEvent('first_i_love_you', /爱你|喜欢你|好喜欢你|爱了/.test(message), '第一次表达爱意')

  // 深度分享 (长消息 + 情感内容)
  tryAddEvent('deep_share', message.length > 80 && /我[^\n]{20,}/.test(message), '分享内心深处的想法')

  return newEvents
}

// ─── 阶段升级检测 ───
export function checkStageUpgrade(
  relationship: Relationship
): RelationshipStage | null {
  const config = STAGE_CONFIG[relationship.stage]
  if (!config) return null

  const { requirements, required_events, next } = config
  const dims = relationship.dimensions

  // 检查数值条件
  if (requirements.affection !== undefined && relationship.affection < requirements.affection) return null
  if (requirements.intimacy !== undefined && dims.intimacy < requirements.intimacy) return null
  if (requirements.trust !== undefined && dims.trust < requirements.trust) return null
  if (requirements.understanding !== undefined && dims.understanding < requirements.understanding) return null
  if (requirements.chemistry !== undefined && dims.chemistry < requirements.chemistry) return null
  if (requirements.chat_days !== undefined && relationship.chat_days < requirements.chat_days) return null

  // 检查事件条件
  // MVP: 放宽事件要求，满足数值即可升级
  // 生产环境应该严格检查 required_events

  return next
}

// ─── 整合：一次消息处理全流程 ───
export interface ProcessedResult {
  dimensionChanges: DimensionChange
  decay: DimensionChange
  newEvents: RelationshipEvent[]
  newStage: RelationshipStage | null
}

export function processMessage(
  message: string,
  relationship: Relationship,
  emotionalState: EmotionalState,
  existingEvents: RelationshipEvent[],
  isLateNight: boolean = false
): ProcessedResult {
  const dimensionChanges = calculateDimensionChanges(message, relationship, emotionalState, isLateNight)
  const decay = calculateDecay(relationship)
  const newEvents = detectEvents(message, relationship, existingEvents)
  const newStage = checkStageUpgrade(relationship)

  return {
    dimensionChanges,
    decay,
    newEvents,
    newStage,
  }
}
