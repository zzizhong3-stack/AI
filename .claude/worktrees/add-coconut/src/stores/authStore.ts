import { create } from 'zustand'

interface AuthState {
  user_id: string
  nickname: string
  is_logged_in: boolean
  login: (nickname: string) => void
  logout: () => void
}

function generateId(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)
}

export const useAuthStore = create<AuthState>((set) => ({
  user_id: localStorage.getItem('ai_lover_user_id') || '',
  nickname: localStorage.getItem('ai_lover_nickname') || '',
  is_logged_in: !!localStorage.getItem('ai_lover_user_id'),

  login: (nickname: string) => {
    const id = generateId()
    localStorage.setItem('ai_lover_user_id', id)
    localStorage.setItem('ai_lover_nickname', nickname)
    set({ user_id: id, nickname, is_logged_in: true })
  },

  logout: () => {
    localStorage.removeItem('ai_lover_user_id')
    localStorage.removeItem('ai_lover_nickname')
    set({ user_id: '', nickname: '', is_logged_in: false })
  },
}))
