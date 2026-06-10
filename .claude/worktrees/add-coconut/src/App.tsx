import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { CharacterPage } from './pages/CharacterPage'
import { ChatPage } from './pages/ChatPage'
import { RelationshipPage } from './pages/RelationshipPage'

export default function App() {
  return (
    <BrowserRouter>
      <div style={styles.app}>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/characters" element={<CharacterPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/relationship" element={<RelationshipPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    maxWidth: 430,
    margin: '0 auto',
    minHeight: '100vh',
    backgroundColor: '#fafafa',
    boxShadow: '0 0 40px rgba(0,0,0,0.1)',
    position: 'relative',
    overflow: 'hidden',
  },
}
