import { create } from 'zustand'
import type { Message, Conversation } from '../types'

interface ChatState {
  conversations: Conversation[]
  messages: Message[]
  current_conversation: Conversation | null
  is_streaming: boolean
  streaming_content: string

  setConversations: (convs: Conversation[]) => void
  setMessages: (msgs: Message[]) => void
  addMessage: (msg: Message) => void
  setCurrentConversation: (conv: Conversation | null) => void
  setIsStreaming: (v: boolean) => void
  appendStreamingContent: (chunk: string) => void
  clearStreamingContent: () => void
}

function generateId(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  messages: [],
  current_conversation: null,
  is_streaming: false,
  streaming_content: '',

  setConversations: (convs) => set({ conversations: convs }),

  setMessages: (msgs) => set({ messages: msgs }),

  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),

  setCurrentConversation: (conv) => set({ current_conversation: conv }),

  setIsStreaming: (v) => set({ is_streaming: v }),

  appendStreamingContent: (chunk) =>
    set((s) => ({ streaming_content: s.streaming_content + chunk })),

  clearStreamingContent: () => set({ streaming_content: '' }),
}))

export { generateId }
