import type { Message } from '../types'

interface Props {
  message: Message
  characterName: string
  characterAvatar?: string
}

export function ChatBubble({ message, characterName }: Props) {
  const isUser = message.role === 'user'

  return (
    <div
      style={{
        ...styles.container,
        justifyContent: isUser ? 'flex-end' : 'flex-start',
      }}
    >
      {!isUser && (
        <div style={styles.avatar}>
          {characterName[0]}
        </div>
      )}

      <div
        style={{
          ...styles.bubble,
          ...(isUser ? styles.userBubble : styles.aiBubble),
        }}
      >
        <div style={styles.content}>{message.content}</div>
        <div style={styles.time}>
          {new Date(message.created_at).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>

      {isUser && (
        <div style={{ ...styles.avatar, background: '#FF6B8A' }}>
          我
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '4px 16px',
    marginBottom: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 600,
    flexShrink: 0,
  },
  bubble: {
    maxWidth: '70%',
    padding: '10px 14px',
    borderRadius: 18,
    lineHeight: 1.5,
    fontSize: 15,
  },
  userBubble: {
    background: 'linear-gradient(135deg, #FF6B8A 0%, #FF8E53 100%)',
    color: '#fff',
    borderBottomRightRadius: 6,
  },
  aiBubble: {
    background: '#f2f2f7',
    color: '#1c1c1e',
    borderBottomLeftRadius: 6,
  },
  content: {
    wordBreak: 'break-word',
    whiteSpace: 'pre-wrap',
  },
  time: {
    fontSize: 11,
    color: 'inherit',
    opacity: 0.6,
    marginTop: 4,
    textAlign: 'right',
  },
}
