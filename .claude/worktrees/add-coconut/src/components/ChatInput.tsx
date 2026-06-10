import { useState, useRef } from 'react'

interface Props {
  onSend: (message: string) => void
  disabled?: boolean
}

export function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
    // 自动调整高度
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div style={styles.container}>
      <textarea
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="说点什么..."
        disabled={disabled}
        rows={1}
        style={styles.input}
      />
      <button
        onClick={handleSend}
        disabled={disabled || !text.trim()}
        style={{
          ...styles.sendBtn,
          ...(text.trim() && !disabled ? styles.sendBtnActive : {}),
        }}
      >
        发送
      </button>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 8,
    padding: '10px 16px',
    borderTop: '1px solid #f0f0f0',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    border: '1px solid #e0e0e0',
    borderRadius: 20,
    padding: '10px 16px',
    fontSize: 15,
    lineHeight: 1.4,
    resize: 'none',
    outline: 'none',
    maxHeight: 120,
    fontFamily: 'inherit',
    backgroundColor: '#f9f9f9',
  },
  sendBtn: {
    border: 'none',
    background: '#e0e0e0',
    color: '#999',
    padding: '10px 20px',
    borderRadius: 20,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
    flexShrink: 0,
  },
  sendBtnActive: {
    background: 'linear-gradient(135deg, #FF6B8A 0%, #FF8E53 100%)',
    color: '#fff',
  },
}
