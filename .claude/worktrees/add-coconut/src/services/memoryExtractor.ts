/**
 * 记忆提取器 (MVP 版本)
 * 基于规则从对话中提取关键信息，分类存储
 */
import type { Memory, MemoryCategory, Relationship } from '../types'

function generateId(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)
}

// ─── 提取规则 ───
interface ExtractionRule {
  pattern: RegExp
  category: MemoryCategory
  importance: number
  keyTemplate: string
}

const EXTRACTION_RULES: ExtractionRule[] = [
  // 用户资料
  { pattern: /我叫.{1,10}/, category: 'user_profile', importance: 8, keyTemplate: '用户姓名' },
  { pattern: /我[今]?年\d{1,2}[岁]/, category: 'user_profile', importance: 7, keyTemplate: '用户年龄' },
  { pattern: /我[是在做当].{2,10}(工作|的|师|员|生)/, category: 'user_profile', importance: 8, keyTemplate: '用户职业' },
  { pattern: /我在.{2,10}(城市|地方|市|省)/, category: 'user_profile', importance: 6, keyTemplate: '用户所在地' },
  { pattern: /我[的]?生日.{0,10}\d{1,2}[月\-]\d{1,2}/, category: 'user_profile', importance: 8, keyTemplate: '用户生日' },

  // 偏好
  { pattern: /我喜欢.{2,20}/, category: 'preference', importance: 6, keyTemplate: '用户喜欢的事物' },
  { pattern: /我讨厌.{2,20}/, category: 'preference', importance: 6, keyTemplate: '用户讨厌的事物' },
  { pattern: /我不喜欢.{2,20}/, category: 'preference', importance: 6, keyTemplate: '用户不喜欢的事物' },
  { pattern: /(最爱|特别爱|超级喜欢).{2,20}/, category: 'preference', importance: 7, keyTemplate: '用户特别喜欢的事物' },
  { pattern: /我[不]?吃.{2,10}/, category: 'preference', importance: 5, keyTemplate: '用户饮食偏好' },

  // 人生事件
  { pattern: /(今天|昨天|刚刚|最近).{1,8}(升职|入职|辞职|毕业|分手|恋爱|在一起|订婚|结婚|搬家)/, category: 'life_event', importance: 9, keyTemplate: '重要人生事件' },
  { pattern: /我(考|通过|失败|挂).{2,10}(试|了)/, category: 'life_event', importance: 7, keyTemplate: '考试相关事件' },
  { pattern: /我(生病|住院|手术|发烧|感冒|不舒服|去看医生)/, category: 'life_event', importance: 7, keyTemplate: '健康相关事件' },

  // 情感记忆
  { pattern: /我[好很真].{2,6}(难过|伤心|开心|紧张|焦虑|压力|孤独|寂寞)/, category: 'emotional', importance: 7, keyTemplate: '情感状态' },
  { pattern: /我.{0,5}(想哭|流泪|崩溃|受不了)/, category: 'emotional', importance: 8, keyTemplate: '强烈情绪表达' },
]

/**
 * 从用户消息中提取记忆
 */
export function extractMemories(
  userMessage: string,
  relationshipId: string
): Memory[] {
  const memories: Memory[] = []

  for (const rule of EXTRACTION_RULES) {
    if (rule.pattern.test(userMessage)) {
      const match = userMessage.match(rule.pattern)
      if (match) {
        memories.push({
          id: generateId(),
          relationship_id: relationshipId,
          category: rule.category,
          key: rule.keyTemplate,
          content: match[0],
          importance: rule.importance,
          source_msg_ids: [],
          created_at: new Date().toISOString(),
        })
      }
    }
  }

  return memories
}

/**
 * 合并 + 去重记忆
 * MVP 版本：简单的 key 匹配去重
 */
export function mergeMemories(existing: Memory[], newMemories: Memory[]): Memory[] {
  const result = [...existing]
  const existingKeys = new Set(existing.map((m) => `${m.category}:${m.key}`))

  for (const mem of newMemories) {
    const dedupKey = `${mem.category}:${mem.key}`
    if (!existingKeys.has(dedupKey)) {
      result.push(mem)
      existingKeys.add(dedupKey)
    } else {
      // 更新已存在的记忆内容
      const idx = result.findIndex((m) => `${m.category}:${m.key}` === dedupKey)
      if (idx >= 0) {
        result[idx] = {
          ...result[idx],
          content: mem.content, // 更新为新内容
        }
      }
    }
  }

  return result
}

/**
 * 从 localStorage 加载记忆
 */
export function loadMemories(): Memory[] {
  try {
    const raw = localStorage.getItem('ai_lover_memories')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/**
 * 保存记忆到 localStorage
 */
export function saveMemories(memories: Memory[]): void {
  localStorage.setItem('ai_lover_memories', JSON.stringify(memories))
}
