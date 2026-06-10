import { create } from 'zustand'
import type { Relationship, RelationshipStage, RelationshipDimensions, EmotionalState, RelationshipEvent, MoodType } from '../types'

const DEFAULT_DIMENSIONS: RelationshipDimensions = {
  intimacy: 0,
  trust: 0,
  understanding: 0,
  chemistry: 0,
  passion: 0,
}

const DEFAULT_EMOTIONAL_STATE: EmotionalState = {
  current_mood: 'neutral',
  mood_score: 0.5,
  mood_intensity: 0.5,
  mood_trend: 'stable',
  stress_level: 0,
  anxiety_level: 0,
  engagement: 0.5,
  last_assessed_at: new Date().toISOString(),
}

interface RelationshipState {
  current_relationship: Relationship | null
  emotional_state: EmotionalState
  events: RelationshipEvent[]
  stage_up_notification: { from: RelationshipStage; to: RelationshipStage } | null

  initRelationship: (userId: string, characterId: string) => void
  setRelationship: (r: Relationship) => void
  updateDimensions: (changes: Partial<RelationshipDimensions>) => void
  setEmotionalState: (s: EmotionalState) => void
  addEvent: (e: RelationshipEvent) => void
  setStageUpNotification: (n: { from: RelationshipStage; to: RelationshipStage } | null) => void
  loadFromStorage: (userId: string, characterId: string) => void
  saveToStorage: () => void
}

function generateId(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)
}

const STORAGE_KEY = 'ai_lover_relationship'

export const useRelationshipStore = create<RelationshipState>((set, get) => ({
  current_relationship: null,
  emotional_state: DEFAULT_EMOTIONAL_STATE,
  events: [],
  stage_up_notification: null,

  initRelationship: (userId, characterId) => {
    const now = new Date().toISOString()
    const rel: Relationship = {
      id: generateId(),
      user_id: userId,
      character_id: characterId,
      stage: 'stranger',
      dimensions: { ...DEFAULT_DIMENSIONS },
      affection: 0,
      chat_total: 0,
      chat_days: 0,
      first_chat_at: null,
      last_chat_at: now,
      created_at: now,
      updated_at: now,
    }
    set({ current_relationship: rel, emotional_state: DEFAULT_EMOTIONAL_STATE, events: [] })
    get().saveToStorage()
  },

  setRelationship: (r) => set({ current_relationship: r }),

  updateDimensions: (changes) => {
    const rel = get().current_relationship
    if (!rel) return
    const dims = { ...rel.dimensions }
    for (const [k, v] of Object.entries(changes)) {
      const key = k as keyof RelationshipDimensions
      dims[key] = Math.max(0, Math.min(100, dims[key] + (v as number)))
    }
    // 综合好感度加权
    const affection = Math.round(
      dims.intimacy * 0.30 +
      dims.trust * 0.25 +
      dims.understanding * 0.20 +
      dims.chemistry * 0.15 +
      dims.passion * 0.10
    )
    set({
      current_relationship: {
        ...rel,
        dimensions: dims,
        affection,
        updated_at: new Date().toISOString(),
      },
    })
    get().saveToStorage()
  },

  setEmotionalState: (s) => set({ emotional_state: s }),

  addEvent: (e) => {
    set((state) => ({ events: [...state.events, e] }))
    get().saveToStorage()
  },

  setStageUpNotification: (n) => set({ stage_up_notification: n }),

  loadFromStorage: (userId, characterId) => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const data = JSON.parse(raw)
        if (data.current_relationship?.user_id === userId &&
            data.current_relationship?.character_id === characterId) {
          set({
            current_relationship: data.current_relationship,
            emotional_state: data.emotional_state || DEFAULT_EMOTIONAL_STATE,
            events: data.events || [],
          })
          return
        }
      }
    } catch { /* ignore */ }
    get().initRelationship(userId, characterId)
  },

  saveToStorage: () => {
    const { current_relationship, emotional_state, events } = get()
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      current_relationship,
      emotional_state,
      events,
    }))
  },
}))
