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

// A game's title, designer, and publisher (one side of an edit).
export interface GameDetails {
  title: string
  designer: string | null
  publisher: string | null
}

// One change to a game on the History page. kind: tiles = a saved tile list; created = New game; edited = details changed (details); deleted = the
// game was deleted (changes lists the tile links it had, as removed).
export interface GameChange {
  id: number
  gameId: number
  gameTitle: string
  gameDeleted: boolean // deleted since: its title is not linked
  kind: 'tiles' | 'created' | 'edited' | 'deleted'
  details: { before: GameDetails; after: GameDetails } | null
  changedByEmail: string | null
  changedUtc: string
  reason: string | null
  changes: GameTileChange[]
}
