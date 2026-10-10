// Shared fetch helper for the API. Throws on any non-2xx response so callers can show an error.
// Every API call goes through this one function, so error handling lives in one place.
// <T> is the type of data expected back, e.g. getJson<GameSummary[]>('/api/games').

export async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(
      `GET ${path} failed: ${response.status} ${response.statusText}`,
    )
  }

  return (await response.json()) as T
}
