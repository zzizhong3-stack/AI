import type { RelationshipStage as Stage } from '../types'

const STAGE_INFO: Record<Stage, { label: string; icon: string; color: string }> = {
  stranger:    { label: '陌生人', icon: '👋', color: '#B0BEC5' },
  acquaintance:{ label: '认识',   icon: '🤝', color: '#90CAF9' },
  familiar:    { label: '熟悉',   icon: '💚', color: '#A5D6A7' },
  crush:       { label: '暧昧',   icon: '💗', color: '#F48FB1' },
  lover:       { label: '恋人',   icon: '💕', color: '#FF6B8A' },
  intimate:    { label: '亲密伴侣', icon: '💞', color: '#CE93D8' },
  soulmate:    { label: '灵魂伴侣', icon: '✨', color: '#FFD54F' },
}

interface Props {
  stage: Stage
  affection: number
}

export function RelationshipStageDisplay({ stage, affection }: Props) {
  const info = STAGE_INFO[stage]
  const stageIndex = Object.keys(STAGE_INFO).indexOf(stage)
  const totalStages = Object.keys(STAGE_INFO).length

  return (
    <div style={styles.container}>
      <div style={{ ...styles.iconContainer, backgroundColor: info.color + '22' }}>
        <span style={styles.icon}>{info.icon}</span>
      </div>
      <div style={styles.info}>
        <div style={{ ...styles.stageLabel, color: info.color }}>
          {info.label}
        </div>
        <div style={styles.affection}>
          好感度 {Math.round(affection)}/100
        </div>
      </div>
      <div style={styles.progress}>
        <div style={styles.stageDots}>
          {Object.entries(STAGE_INFO).map(([key, val], i) => (
            <div
              key={key}
              style={{
                ...styles.dot,
                backgroundColor: i <= stageIndex ? info.color : '#e0e0e0',
                transform: i === stageIndex ? 'scale(1.3)' : 'scale(1)',
              }}
              title={val.label}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '16px',
    backgroundColor: '#fff',
    borderRadius: 16,
    margin: '12px 16px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 26,
  },
  info: {
    flex: 1,
  },
  stageLabel: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 4,
  },
  affection: {
    fontSize: 13,
    color: '#999',
  },
  progress: {
    flexShrink: 0,
  },
  stageDots: {
    display: 'flex',
    gap: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    transition: 'all 0.4s ease',
  },
}
