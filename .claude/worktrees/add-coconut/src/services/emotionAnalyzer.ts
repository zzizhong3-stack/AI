/**
 * 情绪状态分析器
 * 基于关键词规则，轻量级分析用户消息中的情绪
 */
import type { MoodType, MoodTrend, EmotionalState } from '../types'

// 情绪关键词词典
const MOOD_KEYWORDS: Record<MoodType, string[]> = {
  happy: ['哈哈', '开心', '高兴', '好棒', '太好了', '嘻嘻', '快乐', '嘿嘿', '棒', 'nice', '✌️', '😊', '😄', '🥳', '👍'],
  calm: ['还行', '一般', '普通', '就那样', '无所谓', '嗯', 'OK'],
  anxious: ['焦虑', '担心', '紧张', '好烦', '怎么办', '完了', '来不及', '害怕', '心慌', '😰', '😨'],
  sad: ['难过', '悲伤', '哭了', '好想哭', '委屈', '失落', '伤心', '想哭', '😢', '😭', '💔'],
  angry: ['生气', '气死', '烦死了', '滚', '无语', '气', '怒了', '😡', '🤬'],
  excited: ['激动', '兴奋', '啊啊啊', '太棒了', '好期待', '忍不住', '！', '🤩', '🔥'],
  tired: ['累', '困', '好累', '乏', '疲惫', '不想动', '躺平', '睡了', '😴', '🥱'],
  lonely: ['孤独', '一个人', '寂寞', '没人', '想找人', '好空虚', '空虚'],
  loving: ['爱你', '想你了', '喜欢你', '爱', '么么', '抱抱', '亲', '❤️', '🥰', '😘'],
  neutral: [],
}

// 压力信号
const STRESS_SIGNALS = [
  { words: ['加班', '赶工', 'ddl', 'deadline', '忙死', '忙不过来了'], score: 15 },
  { words: ['工作', '老板', '上司', '辞职', '离职'], score: 5 },
  { words: ['压力', '崩溃', '顶不住', '受不了了'], score: 20 },
  { words: ['失眠', '睡不着', '噩梦'], score: 10 },
  { words: ['考试', '挂科', '复习', '备考'], score: 10 },
]

// 焦虑信号
const ANXIETY_SIGNALS = [
  { words: ['担心', '害怕', '焦虑', '紧张'], score: 15 },
  { words: ['怎么办', '完了', '来不及', '出事'], score: 10 },
  { words: ['忍不住', '控制不住', '总是想'], score: 10 },
  { words: ['别人怎么看我', '会不会觉得'], score: 12 },
]

// 积极信号
const POSITIVE_SIGNALS = [
  { words: ['哈哈', '开心', '好棒', '太好了', '嘻嘻'], score: -10 },
  { words: ['爱你', '喜欢你', '抱抱', '么么哒'], score: -8 },
  { words: ['期待', '想见你', '谢谢'], score: -5 },
]

function detectMood(text: string): { mood: MoodType; intensity: number } {
  const scores: Partial<Record<MoodType, number>> = {}

  for (const [mood, keywords] of Object.entries(MOOD_KEYWORDS)) {
    const type = mood as MoodType
    if (type === 'neutral') continue
    scores[type] = 0
    for (const kw of keywords) {
      if (text.includes(kw)) {
        scores[type]! += 1
      }
    }
  }

  // 找到得分最高的情绪
  let bestMood: MoodType = 'neutral'
  let bestScore = 0
  for (const [mood, score] of Object.entries(scores)) {
    if (score! > bestScore) {
      bestMood = mood as MoodType
      bestScore = score!
    }
  }

  // 计算强度 (0~1)
  const intensity = bestScore === 0 ? 0 : Math.min(1, bestScore / 3)

  // 检查感叹号密度
  const exclaimCount = (text.match(/[！!]/g) || []).length
  const adjustedIntensity = Math.min(1, intensity + exclaimCount * 0.05)

  return { mood: bestMood, intensity: adjustedIntensity }
}

function calcSignalScore(text: string, signals: Array<{ words: string[]; score: number }>): number {
  let total = 0
  for (const signal of signals) {
    for (const word of signal.words) {
      if (text.includes(word)) {
        total += signal.score
      }
    }
  }
  return total
}

function calcMoodScore(mood: MoodType): number {
  const moodScores: Record<MoodType, number> = {
    happy: 0.8,
    excited: 0.9,
    loving: 0.85,
    calm: 0.55,
    neutral: 0.5,
    tired: 0.35,
    anxious: 0.25,
    sad: 0.2,
    lonely: 0.2,
    angry: 0.15,
  }
  return moodScores[mood] ?? 0.5
}

export function analyzeEmotion(
  message: string,
  prevState: EmotionalState
): EmotionalState {
  const { mood, intensity } = detectMood(message)

  // 计算压力/焦虑
  const stressDelta = calcSignalScore(message, STRESS_SIGNALS)
  const anxietyDelta = calcSignalScore(message, ANXIETY_SIGNALS)
  const positiveDelta = calcSignalScore(message, POSITIVE_SIGNALS)

  const newStress = Math.max(0, Math.min(100, prevState.stress_level + stressDelta + positiveDelta))
  const newAnxiety = Math.max(0, Math.min(100, prevState.anxiety_level + anxietyDelta))
  const newMoodScore = calcMoodScore(mood)

  // 情绪趋势
  let trend: MoodTrend = 'stable'
  if (newMoodScore > prevState.mood_score + 0.1) {
    trend = 'improving'
  } else if (newMoodScore < prevState.mood_score - 0.1) {
    trend = 'declining'
  } else {
    trend = prevState.mood_trend
  }

  // 互动积极性
  const msgLen = message.length
  let engagement = prevState.engagement
  if (msgLen > 30) engagement = Math.min(1, engagement + 0.1)
  else if (msgLen < 5) engagement = Math.max(0, engagement - 0.05)

  return {
    current_mood: mood,
    mood_score: newMoodScore,
    mood_intensity: intensity,
    mood_trend: trend,
    stress_level: newStress,
    anxiety_level: newAnxiety,
    engagement,
    last_assessed_at: new Date().toISOString(),
  }
}
