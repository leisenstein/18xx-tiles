import type { GameTile, GameTileInput } from '@/types/gameTiles'
import type { TileSummary } from '@/types/tile'

// Change requests (DESIGN.md section 7). These match the API's TileContentDto, TileGameLinkDto, GameProposalDto, ChangeRequestDto, and
// ChangeRequestSubmitDto. Add, Edit, and Delete are about one tile; AddGame proposes a new game with its tile list.

export type ChangeRequestType = 'Add' | 'Edit' | 'Delete' | 'AddGame'
export type ChangeRequestStatus = 'Pending' | 'Approved' | 'Rejected'

// One game that uses a tile. count: null = unknown, 999 = unlimited. title is filled in by the API when reading.
export interface TileGameLink {
  gameId: number
  count: number | null
  notes: string | null
  title?: string | null
}

// A tile's content: what a request proposes, or what the tile looks like now. For an Edit, games: null keeps the current links.
export interface TileContent {
  number: string
  color: string
  definitionCode: string
  games: TileGameLink[] | null
  // Optional name for a variant, shown as "#57 (Kansas City)" when other tiles use the number. Empty: the API picks "#57" or "#57 (variant k)".
  variantName?: string | null
  displayName?: string | null // filled in for history snapshots, e.g. "#57 (Kansas City)"
}

// A proposed new game (AddGame) and the existing tiles it uses, with box counts. When read back, each tile has its drawing data.
export interface GameProposal {
  title: string
  designer: string | null
  publisher: string | null
  tiles: GameTile[]
}

// What a game proposal sends: only each tile's id, count, and notes.
export interface GameProposalSubmit {
  title: string
  designer: string | null
  publisher: string | null
  tiles: GameTileInput[]
}

export interface ChangeRequest {
  id: number
  type: ChangeRequestType
  status: ChangeRequestStatus
  tileId: number | null // for an Add, set once approved
  tileDisplayName: string | null
  current: TileContent | null // the tile now (Edit, Delete)
  proposed: TileContent | null // the proposal (Add, Edit)
  before: TileContent | null // for an approved Edit or Delete: the tile just before the change (audit trail)
  proposedGame: GameProposal | null // AddGame only
  gameId: number | null // AddGame: the game it created, once approved
  gameTitle: string | null // that game's title now
  reason: string | null
  submittedByEmail: string | null
  submittedUtc: string
  reviewedByEmail: string | null
  reviewedUtc: string | null
  reviewNote: string | null
}

// A Pending request that proposes the same tile number (part of NumberCheck). isMine: submitted by you.
export interface PendingNumberUse {
  id: number
  type: ChangeRequestType
  variantName: string | null
  isMine: boolean
}

// Who else uses a tile number (GET /api/change-requests/number-check). defaultDisplayName: the name without a variant name, e.g. "#57 (variant 2)".
export interface NumberCheck {
  number: string
  tiles: TileSummary[]
  pendingRequests: PendingNumberUse[]
  defaultDisplayName: string
}

// A tile's history (GET /api/admin/tiles/{id}/history, admins only). Matches TileHistoryDto.
export interface TileHistory {
  tileId: number
  displayName: string
  source: string // generic, game-version, game-specific (imported), or user
  isDeleted: boolean
  createdUtc: string
  createdByEmail: string | null // user tiles only
  updatedUtc: string | null
  updatedByEmail: string | null
  requests: ChangeRequest[] // oldest first
}

// Body for submitting. There is no status: the API sets it from the caller's role.
export interface ChangeRequestSubmit {
  type: ChangeRequestType
  tileId?: number | null
  tile?: TileContent | null
  game?: GameProposalSubmit | null
  reason?: string | null
}
