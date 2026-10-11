// Shared fetch helpers for the API. Every API call goes through request(), so error handling lives in one place.
// The browser sends the sign-in cookie automatically, because the app and the API share one origin (DESIGN.md section 11a).

// Error details the API sends with 400 and 401 responses ("problem details", RFC 9457).
// errors: validation messages by field, e.g. { PasswordTooShort: ['Passwords must be at least 10 characters.'] }.
// detail: a short reason, e.g. 'NotAllowed' when signing in before confirming the email.
export interface ProblemDetails {
  title?: string
  detail?: string
  status?: number
  errors?: Record<string, string[]>
}

// Error for a non-2xx response. status lets a page tell "not found" (404) or "not signed in" (401) from other failures.
export class ApiError extends Error {
  readonly status: number
  readonly problem: ProblemDetails | null

  constructor(method: string, path: string, status: number, statusText: string, problem: ProblemDetails | null) {
    super(`${method} ${path} failed: ${status} ${statusText}`)
    this.name = 'ApiError'
    this.status = status
    this.problem = problem
  }
}

// Where the API is. Empty (the default) = the website's own site, so calls use relative addresses such as /api/games: that works in development
// (Vite forwards /api to the API) and in Docker or on Railway (the API serves the website). VITE_API_BASE_URL in web/.env sets another address,
// for example https://api.example.com; the sign-in cookie is then sent along ('include'), which the API must allow (Cors:AllowedOrigins).
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '')
const CREDENTIALS: RequestCredentials = API_BASE ? 'include' : 'same-origin'

// The full address for an API path: '/api/games' stays as is, or becomes 'https://api.example.com/api/games' when a base is set.
export const apiUrl = (path: string) => API_BASE + path

async function request<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const response = await fetch(apiUrl(path), {
    method,
    credentials: CREDENTIALS,
    headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) {
    // Keep the problem details when the API sent them; other error bodies are ignored.
    const isJson = response.headers.get('Content-Type')?.includes('json') ?? false
    const problem = isJson ? ((await response.json()) as ProblemDetails) : null
    throw new ApiError(method, path, response.status, response.statusText, problem)
  }
  // Some successful responses have no body (204 No Content, and login/register's empty 200).
  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}

// GET a text response as is (for example Markdown). Errors throw ApiError like the JSON helpers.
export async function getText(path: string): Promise<string> {
  const response = await fetch(apiUrl(path), { headers: { Accept: 'text/markdown, text/plain' }, credentials: CREDENTIALS })
  if (!response.ok) {
    const isJson = response.headers.get('Content-Type')?.includes('json') ?? false
    const problem = isJson ? ((await response.json()) as ProblemDetails) : null
    throw new ApiError('GET', path, response.status, response.statusText, problem)
  }
  return response.text()
}

// GET and parse JSON. <T> is the type of data expected back, e.g. getJson<GameSummary[]>('/api/games').
export function getJson<T>(path: string): Promise<T> {
  return request<T>('GET', path)
}

// POST an optional JSON body. <T> defaults to void for responses without a body.
export function postJson<T = void>(path: string, body?: unknown): Promise<T> {
  return request<T>('POST', path, body)
}

// PUT a JSON body: replace something as a whole (for example a game's tile list).
export function putJson<T = void>(path: string, body: unknown): Promise<T> {
  return request<T>('PUT', path, body)
}

// DELETE: remove something (for example an account, or a role from an account).
export function deleteJson<T = void>(path: string): Promise<T> {
  return request<T>('DELETE', path)
}
