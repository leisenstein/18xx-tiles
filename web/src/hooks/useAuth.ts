import { useContext } from 'react'
import { AuthContext, type AuthState } from '@/lib/authContext'

// Who is signed in, plus refresh() and signOut(). Works in any component inside <AuthProvider>.
export function useAuth(): AuthState {
  const auth = useContext(AuthContext)
  if (!auth) {
    throw new Error('useAuth must be used inside <AuthProvider>.')
  }
  return auth
}
