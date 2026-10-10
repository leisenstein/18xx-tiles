import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getCurrentUser, signOut as apiSignOut } from '@/api/auth'
import { AuthContext, type AuthState } from '@/lib/authContext'
import type { CurrentUser } from '@/types/account'

// Keeps track of who is signed in and shares it with the whole app (wraps <App /> in main.tsx).
// The browser holds the sign-in cookie; this component only asks the API who that cookie belongs to.
export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)

  // Check once when the app starts (e.g. still signed in from yesterday). Same "ignore a late answer" pattern as the pages.
  useEffect(() => {
    let ignore = false
    getCurrentUser()
      .then((me) => {
        if (!ignore) setUser(me)
      })
      .catch(() => {
        if (!ignore) setUser(null)
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [])

  // Ask the API again, e.g. right after signing in. A network error counts as "not signed in", so the site still works.
  const refresh = useCallback(async () => {
    try {
      setUser(await getCurrentUser())
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const signOut = useCallback(async () => {
    await apiSignOut()
    setUser(null)
  }, [])

  // Only create a new value when something changes, so pages do not re-render needlessly.
  const value = useMemo<AuthState>(() => ({ user, loading, refresh, signOut }), [user, loading, refresh, signOut])

  return <AuthContext value={value}>{children}</AuthContext>
}
