import { Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './features/auth/AuthContext'
import { SignIn } from './features/auth/SignIn'
import { ForgotPassword } from './features/auth/ForgotPassword'
import { ResetPassword } from './features/auth/ResetPassword'
import { NavBar } from './components/NavBar'
import { ReadingView } from './features/reading/ReadingView'
import { Journal } from './features/journal/Journal'
import { ReadingLog } from './features/log/ReadingLog'
import { HighlightsPage } from './features/highlights/HighlightsPage'
import { PrayerPage } from './features/prayer/PrayerPage'
import { ScriptureSearch } from './features/search/ScriptureSearch'
import { TopicsPage } from './features/topics/TopicsPage'
import { CalendarPage } from './features/calendar/CalendarPage'
import { SettingsPage } from './features/settings/SettingsPage'

function AppShell() {
  const { session, loading } = useAuth()

  if (loading) return null

  if (!session && !import.meta.env.DEV) {
    return (
      <Routes>
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<SignIn />} />
      </Routes>
    )
  }

  return (
    <div className="app-shell">
      <NavBar />
      <main>
        <Routes>
          <Route path="/" element={<ReadingView />} />
          <Route path="/search" element={<ScriptureSearch />} />
          <Route path="/topics" element={<TopicsPage />} />
          <Route path="/journal" element={<Journal />} />
          <Route path="/log" element={<ReadingLog />} />
          <Route path="/highlights" element={<HighlightsPage />} />
          <Route path="/prayer" element={<PrayerPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/reset-password" element={<ResetPassword />} />
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
