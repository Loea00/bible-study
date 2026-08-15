import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePrivacyPin } from './usePrivacyPin'
import { useDataExport } from './useDataExport'
import { useProfile } from '../friends/useProfile'

export function SettingsPage() {
  const { pinConfigured, setPin } = usePrivacyPin()
  const { exportData, exporting, error: exportError } = useDataExport()
  const { profile, updateProfile } = useProfile()
  const [pin, setPinInput] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [displayName, setDisplayName] = useState('')
  const [fullName, setFullName] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? '')
      setFullName(profile.full_name ?? '')
    }
  }, [profile])

  async function handleSaveProfile() {
    setProfileError(null)
    setProfileSaved(false)
    setProfileSaving(true)
    try {
      await updateProfile(displayName, fullName)
      setProfileSaved(true)
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Could not save your profile.')
    } finally {
      setProfileSaving(false)
    }
  }

  async function handleSave() {
    setError(null)
    setSaved(false)
    if (pin.length < 4) {
      setError('Use at least 4 characters.')
      return
    }
    if (pin !== confirmPin) {
      setError("The two entries don't match.")
      return
    }
    setSaving(true)
    try {
      await setPin(pin)
      setPinInput('')
      setConfirmPin('')
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the PIN.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="settings-page">
      <h1>Settings</h1>

      <section className="settings-section">
        <h2>Account</h2>
        <p className="settings-hint">Change the password you use to sign in.</p>
        <div className="settings-form">
          <Link to="/reset-password" className="settings-link-button">
            Change password
          </Link>
        </div>
      </section>

      <section className="settings-section">
        <h2>Profile</h2>
        <p className="settings-hint">
          Your display name and real name are how friends find and recognize you — shown in search, friend requests,
          and on anything you share. Your email ({profile?.email ?? '…'}) is only ever matched on an exact search, never
          shown to other users.
        </p>
        <div className="settings-form">
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Display name"
          />
          <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Real name" />
          <button type="button" onClick={handleSaveProfile} disabled={profileSaving}>
            {profileSaving ? 'Saving…' : 'Save'}
          </button>
          {profileSaved && <p className="settings-saved">Saved.</p>}
          {profileError && <p className="error">{profileError}</p>}
        </div>
      </section>

      <section className="settings-section">
        <h2>Privacy PIN</h2>
        <p className="settings-hint">
          Journal entries, Reflections, prayer requests, and prayer journey entries marked "Private" show a
          placeholder until this PIN is entered. This protects against a casual glance at the screen or someone
          picking up the device — it isn't encryption, and content marked private is still stored and readable the
          same way everything else in this app already is (through your account login). If you forget this PIN, it
          can be reset here without losing any content.
        </p>

        {pinConfigured === true && <p className="settings-status">A privacy PIN is currently set.</p>}
        {pinConfigured === false && (
          <p className="settings-status">No privacy PIN set yet — set one below before marking anything Private.</p>
        )}

        <div className="settings-form">
          <input
            type="password"
            value={pin}
            onChange={(e) => setPinInput(e.target.value)}
            placeholder={pinConfigured ? 'New PIN' : 'Set a PIN'}
          />
          <input
            type="password"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value)}
            placeholder="Confirm PIN"
          />
          <button type="button" onClick={handleSave} disabled={saving || !pin || !confirmPin}>
            {saving ? 'Saving…' : pinConfigured ? 'Change PIN' : 'Set PIN'}
          </button>
          {saved && <p className="settings-saved">Saved.</p>}
          {error && <p className="error">{error}</p>}
        </div>
      </section>

      <section className="settings-section">
        <h2>Export your data</h2>
        <p className="settings-hint">
          Download everything you've entered — journal entries, reflections, margin notes, prayer requests and their
          full journeys, highlights, and reading sessions — as a single JSON file you keep. This is a personal backup,
          not a sync: nothing changes in your account, and there's no automatic schedule yet, so re-download whenever
          you want an up-to-date copy.
        </p>
        <div className="settings-form">
          <button type="button" onClick={exportData} disabled={exporting}>
            {exporting ? 'Preparing download…' : 'Download my data'}
          </button>
          {exportError && <p className="error">{exportError}</p>}
        </div>
      </section>
    </div>
  )
}
