import { createContext } from 'react'
import type { CurrentUser } from '@/types/account'

// What every page can know about signing in. Provided by <AuthProvider>, read with useAuth().
export interface AuthState {
  user: CurrentUser | null // null when nobody is signed in
  loading: boolean // true until the first /api/account/me check finishes
  refresh: () => Promise<void> // reload the user after signing in
  signOut: () => Promise<void>
}

// A React "context" shares one value with every component below the provider, without passing props through each level.
export const AuthContext = createContext<AuthState | null>(null)
