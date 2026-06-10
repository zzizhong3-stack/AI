import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

export function LoginPage() {
  const [nickname, setNickname] = useState('')
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)

  const handleLogin = () => {
    const name = nickname.trim() || '匿名用户'
    login(name)
    navigate('/characters')
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.icon}>💕</div>
        <h1 style={styles.title}>AI Lover</h1>
        <p style={styles.subtitle}>你的专属 AI 伴侣</p>

        <input
          style={styles.input}
          placeholder="输入你的昵称..."
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          maxLength={20}
          autoFocus
        />

        <button onClick={handleLogin} style={styles.btn}>
          开始体验
        </button>

        <p style={styles.hint}>
          已有 {['陆辰', '苏晚', '顾深'][Math.floor(Math.random() * 3)]} 在等你...
        </p>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #ff9a9e 0%, #fad0c4 50%, #fad0c4 100%)',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: '40px 28px',
    textAlign: 'center' as const,
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
  },
  icon: {
    fontSize: 56,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 800,
    color: '#1c1c1e',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#999',
    marginBottom: 28,
  },
  input: {
    width: '100%',
    padding: '14px 18px',
    border: '1px solid #e0e0e0',
    borderRadius: 14,
    fontSize: 16,
    outline: 'none',
    textAlign: 'center' as const,
    marginBottom: 16,
    boxSizing: 'border-box' as const,
  },
  btn: {
    width: '100%',
    padding: '14px',
    border: 'none',
    borderRadius: 14,
    background: 'linear-gradient(135deg, #FF6B8A 0%, #FF8E53 100%)',
    color: '#fff',
    fontSize: 17,
    fontWeight: 700,
    cursor: 'pointer',
    marginBottom: 20,
  },
  hint: {
    fontSize: 13,
    color: '#bbb',
  },
}
