// Shared fetch helper for the API. Throws on any non-2xx response so callers can show an error.
// Every API call goes through this one function, so error handling lives in one place.
// <T> is the type of data expected back, e.g. getJson<GameSummary[]>('/api/games').

// Error for a non-2xx response. status lets a page tell "not found" (404) from other failures.
export class ApiError extends Error {
  readonly status: number

  constructor(path: string, status: number, statusText: string) {
    super(`GET ${path} failed: ${status} ${statusText}`)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw new ApiError(path, response.status, response.statusText)
  }

  return (await response.json()) as T
}
