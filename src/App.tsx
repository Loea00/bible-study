import { Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './features/auth/AuthContext'
import { SignIn } from './features/auth/SignIn'
import { NavBar } from './components/NavBar'
import { ReadingView } from './features/reading/ReadingView'
import { Journal } from './features/journal/Journal'
import { ReadingLog } from './features/log/ReadingLog'
import { HighlightsPage } from './features/highlights/HighlightsPage'

function AppShell() {
  const { session, loading } = useAuth()

  if (loading) return null
  if (!session && !import.meta.env.DEV) return <SignIn />

  return (
    <div className="app-shell">
      <NavBar />
      <main>
        <Routes>
          <Route path="/" element={<ReadingView />} />
          <Route path="/journal" element={<Journal />} />
          <Route path="/log" element={<ReadingLog />} />
          <Route path="/highlights" element={<HighlightsPage />} />
        </Routes>
      </main>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}

export default App
