import { ApiError } from '@/api/client'

// Plain-language messages for a failed API call, for showing in a form:
// 400: every validation message (problem.errors); 409: the explanation (problem.detail); 429: slow down; anything else: the error text.
export function apiErrorMessages(err: unknown): string[] {
  if (err instanceof ApiError) {
    if (err.status === 429) return ['Too many requests. Wait a while and try again.']
    const messages = Object.values(err.problem?.errors ?? {}).flat()
    if (messages.length > 0) return messages
    if (err.problem?.detail) return [err.problem.detail]
    if (err.status === 401) return ['Sign in first.']
    if (err.status === 403) return ['You are not allowed to do that.']
  }
  return [err instanceof Error ? err.message : String(err)]
}
