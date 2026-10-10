// The shape of one game as returned by /api/games (matches GameSummaryDto in the API).
// Property names are camelCase because that is how the API's JSON names them.
// "string | null" means the value can be missing: the seed data has no designer or publisher yet.
export interface GameSummary {
  id: number
  title: string
  designer: string | null
  publisher: string | null
  tileCount: number // distinct tile designs the game uses
  physicalTileCount: number // tiles in the box: each design's count added up, leaving out unlimited ones
  unlimitedTileCount: number // designs with an unlimited supply (count 999)
  unknownCountTileCount: number // designs with no count recorded
}
