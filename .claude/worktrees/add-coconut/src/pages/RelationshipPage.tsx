import { useNavigate } from 'react-router-dom'
import { useCharacterStore } from '../stores/characterStore'
import { useRelationshipStore } from '../stores/relationshipStore'
import { RelationshipStageDisplay } from '../components/RelationshipStage'
import { DimensionBar } from '../components/DimensionBar'
import { NavBar } from '../components/NavBar'
import type { MoodType } from '../types'

const MOOD_LABELS: Record<MoodType, { label: string; emoji: string }> = {
  happy:    { label: '开心',  emoji: '😊' },
  calm:     { label: '平静',  emoji: '😌' },
  anxious:  { label: '焦虑',  emoji: '😰' },
  sad:      { label: '难过',  emoji: '😢' },
  angry:    { label: '生气',  emoji: '😤' },
  excited:  { label: '兴奋',  emoji: '🤩' },
  tired:    { label: '疲惫',  emoji: '😴' },
  lonely:   { label: '孤独',  emoji: '🥺' },
  loving:   { label: '爱意',  emoji: '🥰' },
  neutral:  { label: '平静',  emoji: '😶' },
}

const DIMENSION_CONFIG = [
  { key: 'intimacy' as const,  label: '亲密度', color: '#FF6B8A' },
  { key: 'trust' as const,     label: '信任度', color: '#42A5F5' },
  { key: 'understanding' as const, label: '了解度', color: '#66BB6A' },
  { key: 'chemistry' as const, label: '默契度', color: '#AB47BC' },
  { key: 'passion' as const,   label: '激情度', color: '#FFA726' },
]

export function RelationshipPage() {
  const navigate = useNavigate()
  const character = useCharacterStore((s) => s.selected_character)
  const { current_relationship, emotional_state, events } = useRelationshipStore()

  if (!current_relationship) {
    return (
      <div style={styles.page}>
        <div style={styles.empty}>
          <div style={styles.emptyIcon}>💞</div>
          <p>还没有关系数据</p>
          <button onClick={() => navigate('/characters')} style={styles.goChatBtn}>
            去选择角色
          </button>
        </div>
        <NavBar />
      </div>
    )
  }

  const mood = MOOD_LABELS[emotional_state.current_mood]

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h2 style={styles.title}>
          {character ? `你和 ${character.name}` : '关系面板'}
        </h2>
      </div>

      <div style={styles.scroll}>
        {/* 关系阶段 */}
        <RelationshipStageDisplay
          stage={current_relationship.stage}
          affection={current_relationship.affection}
        />

        {/* 情绪状态 */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>当前情绪状态</h3>
          <div style={styles.moodCard}>
            <div style={styles.moodMain}>
              <span style={styles.moodEmoji}>{mood.emoji}</span>
              <span style={styles.moodLabel}>{mood.label}</span>
              <span style={styles.moodScore}>
                {Math.round(emotional_state.mood_score * 100)}%
              </span>
            </div>
            <div style={styles.moodDetails}>
              <div style={styles.moodDetail}>
                <span>压力</span>
                <span style={styles.detailValue}>{emotional_state.stress_level}/100</span>
              </div>
              <div style={styles.moodDetail}>
                <span>焦虑</span>
                <span style={styles.detailValue}>{emotional_state.anxiety_level}/100</span>
              </div>
              <div style={styles.moodDetail}>
                <span>互动积极性</span>
                <span style={styles.detailValue}>{Math.round(emotional_state.engagement * 100)}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* 五维雷达 */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>关系维度</h3>
          <div style={styles.dimensionsCard}>
            {DIMENSION_CONFIG.map((d) => (
              <DimensionBar
                key={d.key}
                label={d.label}
                value={current_relationship.dimensions[d.key]}
                color={d.color}
              />
            ))}
          </div>
        </div>

        {/* 里程碑事件 */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>
            关系里程碑 ({events.length})
          </h3>
          <div style={styles.eventsList}>
            {events.length === 0 && (
              <p style={styles.noEvents}>继续聊天来解锁里程碑事件...</p>
            )}
            {events.map((evt) => (
              <div key={evt.id} style={styles.eventItem}>
                <div style={styles.eventTitle}>{evt.title}</div>
                <div style={styles.eventDesc}>{evt.description}</div>
                <div style={styles.eventTime}>
                  {new Date(evt.occurred_at).toLocaleDateString('zh-CN')}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 统计 */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>互动统计</h3>
          <div style={styles.statsGrid}>
            <div style={styles.statItem}>
              <div style={styles.statValue}>{current_relationship.chat_total}</div>
              <div style={styles.statLabel}>总消息数</div>
            </div>
            <div style={styles.statItem}>
              <div style={styles.statValue}>{current_relationship.chat_days}</div>
              <div style={styles.statLabel}>聊天天数</div>
            </div>
            <div style={styles.statItem}>
              <div style={styles.statValue}>{events.length}</div>
              <div style={styles.statLabel}>里程碑事件</div>
            </div>
          </div>
        </div>
      </div>

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
    padding: '16px',
    textAlign: 'center' as const,
    backgroundColor: '#fff',
    borderBottom: '1px solid #f0f0f0',
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    color: '#1c1c1e',
  },
  scroll: {
    flex: 1,
    overflowY: 'auto' as const,
    paddingBottom: 16,
  },
  section: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: '#999',
    padding: '12px 20px 8px',
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  moodCard: {
    margin: '0 16px',
    padding: '16px',
    backgroundColor: '#fff',
    borderRadius: 16,
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  },
  moodMain: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  moodEmoji: { fontSize: 28 },
  moodLabel: { fontSize: 18, fontWeight: 700, flex: 1 },
  moodScore: { fontSize: 14, color: '#999' },
  moodDetails: {
    display: 'flex',
    gap: 12,
    borderTop: '1px solid #f5f5f5',
    paddingTop: 12,
  },
  moodDetail: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    fontSize: 12,
    color: '#999',
    gap: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: 700,
    color: '#444',
  },
  dimensionsCard: {
    margin: '0 16px',
    padding: '16px',
    backgroundColor: '#fff',
    borderRadius: 16,
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  },
  eventsList: {
    margin: '0 16px',
  },
  noEvents: {
    textAlign: 'center' as const,
    color: '#ccc',
    fontSize: 13,
    padding: 20,
  },
  eventItem: {
    padding: '12px 16px',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 8,
    boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: 600,
    marginBottom: 2,
  },
  eventDesc: {
    fontSize: 13,
    color: '#888',
    marginBottom: 4,
  },
  eventTime: {
    fontSize: 11,
    color: '#bbb',
  },
  statsGrid: {
    display: 'flex',
    gap: 12,
    margin: '0 16px',
  },
  statItem: {
    flex: 1,
    padding: '16px',
    backgroundColor: '#fff',
    borderRadius: 12,
    textAlign: 'center' as const,
    boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 800,
    color: '#FF6B8A',
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  empty: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    color: '#999',
  },
  emptyIcon: { fontSize: 48 },
  goChatBtn: {
    padding: '10px 24px',
    border: 'none',
    borderRadius: 20,
    background: 'linear-gradient(135deg, #FF6B8A, #FF8E53)',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
}
