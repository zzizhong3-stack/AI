import type { Character } from '../types'

interface Props {
  character: Character
  selected?: boolean
  onClick: () => void
}

export function CharacterCard({ character, selected, onClick }: Props) {
  return (
    <div
      onClick={onClick}
      style={{
        ...styles.card,
        ...(selected ? styles.selected : {}),
      }}
    >
      <div style={styles.avatar}>
        {character.name[0]}
      </div>
      <div style={styles.info}>
        <div style={styles.nameRow}>
          <span style={styles.name}>{character.name}</span>
          <span style={styles.gender}>{character.gender === 'male' ? '♂' : '♀'}</span>
          <span style={styles.age}>{character.age}岁</span>
        </div>
        <div style={styles.occupation}>{character.occupation}</div>
        <div style={styles.tags}>
          {character.personality.traits.map((t, i) => (
            <span key={i} style={styles.tag}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    display: 'flex',
    gap: 14,
    padding: '16px',
    margin: '8px 16px',
    borderRadius: 16,
    backgroundColor: '#fff',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    cursor: 'pointer',
    transition: 'all 0.2s',
    border: '2px solid transparent',
  },
  selected: {
    border: '2px solid #FF6B8A',
    boxShadow: '0 4px 16px rgba(255,107,138,0.2)',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 22,
    fontWeight: 700,
    flexShrink: 0,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  name: {
    fontSize: 17,
    fontWeight: 700,
    color: '#1c1c1e',
  },
  gender: {
    fontSize: 14,
    color: '#666',
  },
  age: {
    fontSize: 13,
    color: '#999',
  },
  occupation: {
    fontSize: 13,
    color: '#888',
    marginBottom: 8,
  },
  tags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    fontSize: 11,
    padding: '3px 10px',
    borderRadius: 10,
    backgroundColor: '#fef0f4',
    color: '#FF6B8A',
  },
}
