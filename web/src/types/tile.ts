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
