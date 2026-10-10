// The shape of one tile in a list, as returned by /api/tiles (matches TileSummaryDto in the API).
// Property names are camelCase because that is how the API's JSON names them.
export interface TileSummary {
  id: number
  number: string
  color: string
  displayName: string // e.g. "#10" or "#10 (1825)"
  definitionCode: string // drawn by TileSvg
  hasCity: boolean
  hasTown: boolean
  gameCount: number // how many games use this tile
  countInGame: number | null // tiles in the box, only when filtered by game; null = unknown
}

// One game that uses a tile, with the box count for that game (matches TileGameDto).
export interface TileGame {
  gameId: number
  title: string
  count: number | null // null = unknown, 999 = unlimited
  notes: string | null
}

// Everything the tile detail page needs, from /api/tiles/{id} (matches TileDetailDto).
export interface TileDetail {
  id: number
  number: string
  color: string
  displayName: string
  definitionCode: string
  hasCity: boolean
  hasTown: boolean
  source: string // generic, game-version, game-specific, user
  sourceRef: string | null
  games: TileGame[] // sorted by title
  otherVersions: TileSummary[] // other tiles with the same number
}
