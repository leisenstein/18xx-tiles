import type { PagedResult } from '@/types/paged'
import type { TileDetail, TileSummary } from '@/types/tile'
import { getJson } from './client'

// API calls for tiles. Pages call these instead of using fetch directly.

// Filters for the tile list. Any filter left undefined is not applied.
export interface TileQuery {
  game?: number
  color?: string
  kind?: 'city' | 'town' | 'none'
  exits?: number // 0 to 6
  revenue?: number // tiles that can pay this amount
  minGames?: number // tiles used by at least this many games
  q?: string // text to find in the tile number
  page?: number
  pageSize?: number
}

// Filtered, paged tile list (GET /api/tiles?game=&color=&kind=&exits=&revenue=&minGames=&q=&page=&pageSize=).
export function getTiles(query: TileQuery) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    // Leave out empty filters so the URL only lists what is used.
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  return getJson<PagedResult<TileSummary>>(`/api/tiles?${params}`)
}

// Every revenue amount any tile can pay, lowest first (GET /api/tiles/revenues): the Revenue filter's choices.
export const getTileRevenues = () => getJson<number[]>('/api/tiles/revenues')

// One tile with its games and other versions (GET /api/tiles/{id}).
// Throws ApiError with status 404 if the tile does not exist.
export const getTile = (id: number) => getJson<TileDetail>(`/api/tiles/${id}`)

// Tiles used by at least minGames games (GET /api/tiles/common?minGames=).
// The API accepts 2 to 200; outside that it returns 400.
export const getCommonTiles = (minGames: number) => getJson<TileSummary[]>(`/api/tiles/common?minGames=${minGames}`)
