import type { TileSummary } from '@/types/tile'

// Change requests (DESIGN.md section 7). These match the API's TileContentDto, TileGameLinkDto, ChangeRequestDto, and ChangeRequestSubmitDto.

export type ChangeRequestType = 'Add' | 'Edit' | 'Delete'
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

export interface ChangeRequest {
  id: number
  type: ChangeRequestType
  status: ChangeRequestStatus
  tileId: number | null // for an Add, set once approved
  tileDisplayName: string | null
  current: TileContent | null // the tile now (Edit, Delete)
  proposed: TileContent | null // the proposal (Add, Edit)
  before: TileContent | null // for an approved Edit or Delete: the tile just before the change (audit trail)
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
  reason?: string | null
}
