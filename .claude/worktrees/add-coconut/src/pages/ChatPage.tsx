import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useCharacterStore } from '../stores/characterStore'
import { useChatStore, generateId } from '../stores/chatStore'
import { useRelationshipStore } from '../stores/relationshipStore'
import { streamChat } from '../services/deepseek'
import { buildMessages } from '../services/promptBuilder'
import { analyzeEmotion } from '../services/emotionAnalyzer'
import { processMessage } from '../services/relationshipEngine'
import { extractMemories, loadMemories, mergeMemories, saveMemories } from '../services/memoryExtractor'
import { ChatBubble } from '../components/ChatBubble'
import { ChatInput } from '../components/ChatInput'
import { NavBar } from '../components/NavBar'
import type { Message, Memory, Conversation } from '../types'

export function ChatPage() {
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.user_id)
  const character = useCharacterStore((s) => s.selected_character)
  const {
    messages, addMessage, is_streaming, setIsStreaming,
    streaming_content, appendStreamingContent, clearStreamingContent,
  } = useChatStore()
  const {
    current_relationship, emotional_state, events,
    initRelationship, loadFromStorage, updateDimensions,
    setEmotionalState, addEvent, setStageUpNotification,
    stage_up_notification,
  } = useRelationshipStore()

  const [memories, setMemories] = useState<Memory[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  // 初始化
  useEffect(() => {
    if (!character) {
      navigate('/characters')
      return
    }
    loadFromStorage(userId, character.id)
    setMemories(loadMemories())
  }, [character])

  // 自动滚动
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streaming_content])

  // 阶段升级通知自动消失
  useEffect(() => {
    if (stage_up_notification) {
      const t = setTimeout(() => setStageUpNotification(null), 4000)
      return () => clearTimeout(t)
    }
  }, [stage_up_notification])

  const handleSend = async (text: string) => {
    if (!character) return
    if (!current_relationship) {
      initRelationship(userId, character.id)
    }

    setError(null)

    // 1. 存储用户消息
    const userMsg: Message = {
      id: generateId(),
      conversation_id: 'local',
      role: 'user',
      content: text,
      content_type: 'text',
      created_at: new Date().toISOString(),
    }
    addMessage(userMsg)

    // 2. 情绪分析
    const newEmotion = analyzeEmotion(text, emotional_state)
    setEmotionalState(newEmotion)

    // 3. 关系引擎计算
    const isLateNight = new Date().getHours() >= 22 || new Date().getHours() < 6
    const processResult = processMessage(
      text,
      current_relationship!,
      newEmotion,
      events,
      isLateNight
    )

    // 应用维度变化（合并增减）
    const mergedChanges = { ...processResult.dimensionChanges }
    for (const [k, v] of Object.entries(processResult.decay)) {
      const key = k as keyof typeof mergedChanges
      mergedChanges[key] += v
    }
    updateDimensions(mergedChanges)

    // 记录新事件
    for (const evt of processResult.newEvents) {
      addEvent(evt)
    }

    // 检查阶段升级
    if (processResult.newStage) {
      setStageUpNotification({
        from: current_relationship!.stage,
        to: processResult.newStage,
      })
      // 直接在 store 里更新 stage（通过重新加载）
      useRelationshipStore.getState().setRelationship({
        ...useRelationshipStore.getState().current_relationship!,
        stage: processResult.newStage,
        updated_at: new Date().toISOString(),
      })
    }

    // 4. Memory 候选提取
    const newMemories = extractMemories(text, current_relationship!.id)
    if (newMemories.length > 0) {
      const merged = mergeMemories(memories, newMemories)
      setMemories(merged)
      saveMemories(merged)
    }

    // 5. 构建 Prompt + 调用 DeepSeek
    const updatedRel = useRelationshipStore.getState().current_relationship!
    const updatedEmotion = useRelationshipStore.getState().emotional_state

    const allMessages = [...useChatStore.getState().messages]
    const apiMessages = buildMessages({
      character,
      relationship: updatedRel,
      emotionalState: updatedEmotion,
      memories,
      recentMessages: allMessages,
      userMessage: text,
    })

    setIsStreaming(true)
    clearStreamingContent()

    await streamChat(
      apiMessages,
      {
        onDelta: (chunk) => {
          appendStreamingContent(chunk)
        },
        onDone: (fullContent, tokensUsed) => {
          const aiMsg: Message = {
            id: generateId(),
            conversation_id: 'local',
            role: 'assistant',
            content: fullContent,
            content_type: 'text',
            tokens_used: tokensUsed,
            created_at: new Date().toISOString(),
          }
          addMessage(aiMsg)
          setIsStreaming(false)
          clearStreamingContent()

          // 更新聊天统计
          const rel = useRelationshipStore.getState().current_relationship!
          useRelationshipStore.getState().setRelationship({
            ...rel,
            chat_total: rel.chat_total + 1,
            chat_days: rel.chat_days + (rel.last_chat_at
              ? new Date(rel.last_chat_at).toDateString() !== new Date().toDateString() ? 1 : 0
              : 1),
            last_chat_at: new Date().toISOString(),
            first_chat_at: rel.first_chat_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
        },
        onError: (err) => {
          setError(err)
          setIsStreaming(false)
          clearStreamingContent()
        },
      },
      { temperature: 0.8, max_tokens: 512 }
    )
  }

  if (!character) return null

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <button onClick={() => navigate('/characters')} style={styles.backBtn}>
          ← 切换
        </button>
        <div style={styles.headerInfo}>
          <div style={styles.charName}>{character.name}</div>
          <div style={styles.charStatus}>
            {is_streaming ? '正在输入...' : '在线'}
          </div>
        </div>
      </div>

      {/* 阶段升级通知 */}
      {stage_up_notification && (
        <div style={styles.notification}>
          <span style={styles.notifIcon}>🎉</span>
          <span>
            关系升级！{stage_up_notification.from} → {stage_up_notification.to}
          </span>
        </div>
      )}

      {/* 错误 */}
      {error && (
        <div style={styles.error} onClick={() => setError(null)}>
          ⚠️ {error}（点击关闭）
        </div>
      )}

      {/* 消息列表 */}
      <div ref={scrollRef} style={styles.messageList}>
        {messages.length === 0 && !is_streaming && (
          <div style={styles.empty}>
            <div style={styles.emptyIcon}>💕</div>
            <div style={styles.emptyText}>
              这是你和 {character.name} 的第一次对话
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <ChatBubble
            key={msg.id}
            message={msg}
            characterName={character.name}
          />
        ))}

        {/* 流式内容 */}
        {is_streaming && streaming_content && (
          <ChatBubble
            message={{
              id: 'streaming',
              conversation_id: 'local',
              role: 'assistant',
              content: streaming_content,
              content_type: 'text',
              created_at: new Date().toISOString(),
            }}
            characterName={character.name}
          />
        )}

        {/* 思考中 */}
        {is_streaming && !streaming_content && (
          <div style={styles.thinking}>
            <span style={styles.thinkingDots}>···</span>
          </div>
        )}
      </div>

      {/* 输入框 */}
      <ChatInput onSend={handleSend} disabled={is_streaming} />

      <NavBar />
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#fafafa',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px',
    backgroundColor: '#fff',
    borderBottom: '1px solid #f0f0f0',
  },
  backBtn: {
    border: 'none',
    background: 'none',
    fontSize: 14,
    color: '#FF6B8A',
    cursor: 'pointer',
    padding: '4px 8px',
  },
  headerInfo: {
    flex: 1,
  },
  charName: {
    fontSize: 17,
    fontWeight: 700,
    color: '#1c1c1e',
  },
  charStatus: {
    fontSize: 12,
    color: '#4caf50',
  },
  notification: {
    padding: '10px 16px',
    backgroundColor: '#FFF3E0',
    textAlign: 'center' as const,
    fontSize: 14,
    fontWeight: 600,
    color: '#E65100',
    animation: 'fadeIn 0.3s',
  },
  notifIcon: {
    marginRight: 6,
  },
  error: {
    padding: '10px 16px',
    backgroundColor: '#FFEBEE',
    textAlign: 'center' as const,
    fontSize: 13,
    color: '#C62828',
    cursor: 'pointer',
  },
  messageList: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '12px 0',
  },
  empty: {
    textAlign: 'center' as const,
    paddingTop: 100,
    color: '#ccc',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
  },
  thinking: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 24px',
  },
  thinkingDots: {
    fontSize: 24,
    color: '#bbb',
    animation: 'blink 1.4s infinite',
  },
}
