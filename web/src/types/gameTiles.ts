// A game's tile list for admins (Edit game tiles page, DESIGN.md section 8). Matches GameTilesDto, GameTileDto, GameTileInputDto, GameChangeDto, and
// GameTileChangeDto in the API. count: null = unknown, 999 = unlimited.

export interface GameTile {
  tileId: number
  number: string
  color: string
  displayName: string
  definitionCode: string
  count: number | null
  notes: string | null
}

export interface GameTiles {
  gameId: number
  title: string
  tiles: GameTile[]
}

// One tile in a saved list.
export interface GameTileInput {
  tileId: number
  count: number | null
  notes: string | null
}

// One tile's change in a saved list (History page).
export interface GameTileChange {
  kind: 'added' | 'removed' | 'changed'
  tileId: number
  displayName: string
  number: string
  color: string
  definitionCode: string
  beforeCount: number | null
  beforeNotes: string | null
  afterCount: number | null
  afterNotes: string | null
}

export interface GameChange {
  id: number
  gameId: number
  gameTitle: string
  changedByEmail: string | null
  changedUtc: string
  reason: string | null
  changes: GameTileChange[]
}
