import { NavLink } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthContext'

export function NavBar() {
  const { signOut } = useAuth()

  return (
    <nav className="navbar">
      <div className="navbar-links">
        <NavLink to="/" end>
          Reading
        </NavLink>
        <NavLink to="/highlights">Highlights</NavLink>
        <NavLink to="/search">Search</NavLink>
        <NavLink to="/topics">Topics</NavLink>
        <NavLink to="/journal">Journal</NavLink>
        <NavLink to="/prayer">Prayer</NavLink>
        <NavLink to="/calendar">Calendar</NavLink>
        <NavLink to="/friends">Friends</NavLink>
      </div>
      <div className="navbar-right">
        <NavLink to="/log">Log</NavLink>
        <NavLink to="/settings">Settings</NavLink>
        <button type="button" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    </nav>
  )
}
