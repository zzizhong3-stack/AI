import { useNavigate } from 'react-router-dom'
import { useCharacterStore } from '../stores/characterStore'
import { useAuthStore } from '../stores/authStore'
import { useRelationshipStore } from '../stores/relationshipStore'
import { CharacterCard } from '../components/CharacterCard'
import { NavBar } from '../components/NavBar'
import type { Character } from '../types'

export function CharacterPage() {
  const navigate = useNavigate()
  const characters = useCharacterStore((s) => s.characters)
  const selectedCharacter = useCharacterStore((s) => s.selected_character)
  const selectCharacter = useCharacterStore((s) => s.selectCharacter)
  const userId = useAuthStore((s) => s.user_id)
  const loadFromStorage = useRelationshipStore((s) => s.loadFromStorage)

  const handleSelect = (char: Character) => {
    selectCharacter(char)
    // 加载或初始化该角色的关系数据
    loadFromStorage(userId, char.id)
    navigate('/chat')
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h2 style={styles.title}>选择你的 AI 伴侣</h2>
        <p style={styles.subtitle}>每次只能选一位聊天，但可以随时切换</p>
      </div>

      <div style={styles.list}>
        {characters.map((char) => (
          <CharacterCard
            key={char.id}
            character={char}
            selected={selectedCharacter?.id === char.id}
            onClick={() => handleSelect(char)}
          />
        ))}

        <div style={styles.comingSoon}>
          <div style={styles.comingSoonIcon}>🔮</div>
          <div style={styles.comingSoonText}>
            <strong>自定义人设</strong>
            <span style={styles.badge}>会员专属</span>
          </div>
          <p style={styles.comingSoonDesc}>V2 开放，自由创造你的专属恋人</p>
        </div>
      </div>

      <NavBar />
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#fafafa',
  },
  header: {
    padding: '20px 16px 8px',
    textAlign: 'center' as const,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: '#1c1c1e',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#aaa',
  },
  list: {
    flex: 1,
    overflowY: 'auto' as const,
    paddingBottom: 16,
  },
  comingSoon: {
    margin: '16px',
    padding: '20px',
    borderRadius: 16,
    border: '2px dashed #e0e0e0',
    textAlign: 'center' as const,
    backgroundColor: '#fff',
  },
  comingSoonIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  comingSoonText: {
    fontSize: 15,
    marginBottom: 4,
  },
  badge: {
    display: 'inline-block',
    marginLeft: 8,
    padding: '2px 10px',
    borderRadius: 10,
    backgroundColor: '#FFD700',
    color: '#fff',
    fontSize: 11,
    fontWeight: 700,
  },
  comingSoonDesc: {
    fontSize: 12,
    color: '#bbb',
    marginTop: 4,
  },
}
