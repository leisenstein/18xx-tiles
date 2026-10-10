import type { PagedResult } from '@/types/paged'
import type { TileSummary } from '@/types/tile'
import { getJson } from './client'

// API calls for tiles. Pages call these instead of using fetch directly.

// Filters for the tile list. Any filter left undefined is not applied.
export interface TileQuery {
  game?: number
  color?: string
  kind?: 'city' | 'town'
  q?: string // text to find in the tile number
  page?: number
  pageSize?: number
}

// Filtered, paged tile list (GET /api/tiles?game=&color=&kind=&q=&page=&pageSize=).
export function getTiles(query: TileQuery) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    // Leave out empty filters so the URL only lists what is used.
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  return getJson<PagedResult<TileSummary>>(`/api/tiles?${params}`)
}
