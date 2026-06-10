import { useNavigate, useLocation } from 'react-router-dom'

const TABS = [
  { path: '/characters', label: '角色', icon: '💑' },
  { path: '/chat', label: '聊天', icon: '💬' },
  { path: '/relationship', label: '关系', icon: '💞' },
]

export function NavBar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <nav style={styles.nav}>
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.path)
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            style={{
              ...styles.tab,
              ...(active ? styles.activeTab : {}),
            }}
          >
            <span style={styles.icon}>{tab.icon}</span>
            <span style={styles.label}>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

const styles: Record<string, React.CSSProperties> = {
  nav: {
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 64,
    borderTop: '1px solid #f0f0f0',
    backgroundColor: '#fff',
    paddingBottom: 'env(safe-area-inset-bottom)',
  },
  tab: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    padding: '8px 24px',
    color: '#999',
    fontSize: 14,
    transition: 'color 0.2s',
  },
  activeTab: {
    color: '#FF6B8A',
    fontWeight: 600,
  },
  icon: {
    fontSize: 22,
  },
  label: {
    fontSize: 12,
  },
}
