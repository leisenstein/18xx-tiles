import type { CurrentUser } from '@/types/account'
import { ApiError, getJson, postJson } from './client'

// API calls for accounts. /api/auth/* are ASP.NET Core Identity's built-in endpoints; /api/account/* are ours (AccountController).

// The signed-in user, or null when nobody is signed in (the API answers 401).
export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    return await getJson<CurrentUser>('/api/account/me')
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null
    throw err
  }
}

// Sign in. useCookies=true asks Identity to set the sign-in cookie (instead of returning a token).
// Throws ApiError 401 with problem.detail 'Failed' (wrong email or password), 'NotAllowed' (email not confirmed), or 'LockedOut'.
export const signIn = (email: string, password: string) => postJson('/api/auth/login?useCookies=true', { email, password })

// Create an account. Identity then emails a confirmation link. Throws ApiError 400 with problem.errors when the input is not accepted.
export const register = (email: string, password: string) => postJson('/api/auth/register', { email, password })

// Send the confirmation email again. Always succeeds, so it does not reveal whether an account exists.
export const resendConfirmation = (email: string) => postJson('/api/auth/resendConfirmationEmail', { email })

// Ask for a password-reset email (it links to /reset-password). Always succeeds, so it does not reveal whether an account exists.
export const forgotPassword = (email: string) => postJson('/api/auth/forgotPassword', { email })

// Set a new password with the code from the reset email. Throws ApiError 400 for an invalid or used code, or a password that breaks the rules.
export const resetPassword = (email: string, resetCode: string, newPassword: string) => postJson('/api/auth/resetPassword', { email, resetCode, newPassword })

// Sign out: the API deletes the sign-in cookie.
export const signOut = () => postJson('/api/account/logout')
