import type { ChangeRequest, ChangeRequestStatus, TileHistory } from '@/types/changeRequest'
import type { HistoryEntry } from '@/types/history'
import type { ImportRun } from '@/types/importRun'
import type { PagedResult } from '@/types/paged'
import type { GameTileInput, GameTiles } from '@/types/gameTiles'
import type { AdminUser } from '@/types/adminUser'
import { deleteJson, getJson, getText, postJson, putJson } from './client'

// API calls for admins only. The API answers 401 when not signed in and 403 without the Admin role (AdminController).

// Proves the signed-in user is an admin.
export const pingAdmin = () => getJson<{ status: string }>('/api/admin/ping')

// The review queue: requests with this status (Pending oldest first; others newest first).
export const getChangeRequests = (status: ChangeRequestStatus) => getJson<ChangeRequest[]>(`/api/admin/change-requests?status=${status}`)

// Apply a Pending request. Throws ApiError 409 (problem.detail explains) if it is no longer Pending, its tile is gone, or it would duplicate a tile.
export const approveChangeRequest = (id: number, note?: string) =>
  postJson<ChangeRequest>(`/api/admin/change-requests/${id}/approve`, note ? { note } : undefined)

// A tile's history: who added it, its last change, and every change request about it (oldest first).
export const getTileHistory = (tileId: number) => getJson<TileHistory>(`/api/admin/tiles/${tileId}/history`)

// Every change request across all tiles and every data import, newest first, one page at a time. Empty filters are left out of the URL.
// type 'Import' returns only imports; a status returns only change requests (imports have no status).
export interface HistoryQuery {
  type: string
  status: string
  q: string
  page: number
  pageSize: number
}
export const getHistory = (query: HistoryQuery) => {
  const params = new URLSearchParams()
  for (const [name, value] of Object.entries(query)) if (value !== '') params.set(name, String(value))
  return getJson<PagedResult<HistoryEntry>>(`/api/admin/history?${params}`)
}

// A game and every live tile it uses, with counts and notes (Edit game tiles page).
export const getGameTiles = (gameId: number) => getJson<GameTiles>(`/api/admin/games/${gameId}/tiles`)

// Replace a game's tile list (tiles left out are removed); returns the saved list. Throws ApiError 409 if nothing changed, 400 for invalid input.
export const saveGameTiles = (gameId: number, tiles: GameTileInput[], reason: string | null) =>
  putJson<GameTiles>(`/api/admin/games/${gameId}/tiles`, { tiles, reason })

// An admin document as Markdown: 'runbook' or 'database' (docs/RUNBOOK.md, docs/DATABASE.md).
export const getDoc = (name: string) => getText(`/api/admin/docs/${name}`)

// Every import of the tobymao/18xx seed files, newest first, with notes about upstream changes that were not applied.
export const getImports = () => getJson<ImportRun[]>('/api/admin/imports')

// Reject a Pending request. The note is required and shown to the submitter.
export const rejectChangeRequest = (id: number, note: string) => postJson<ChangeRequest>(`/api/admin/change-requests/${id}/reject`, { note })

// ---- Users page (UsersController). Changes to an account return it as it is now; 409 explains a refusal (your own account, the configured admin, or
// the last admin). ----

// Every account, or those whose email contains q, sorted by email.
export const getUsers = (q: string) => getJson<AdminUser[]>(`/api/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`)

// The roles that exist (today only "Admin").
export const getRoles = () => getJson<string[]>('/api/admin/roles')

const userPath = (id: string) => `/api/admin/users/${encodeURIComponent(id)}`

export const addUserRole = (id: string, role: string) => putJson<AdminUser>(`${userPath(id)}/roles/${encodeURIComponent(role)}`, undefined)
export const removeUserRole = (id: string, role: string) => deleteJson<AdminUser>(`${userPath(id)}/roles/${encodeURIComponent(role)}`)
export const disableUser = (id: string) => postJson<AdminUser>(`${userPath(id)}/disable`)
export const enableUser = (id: string) => postJson<AdminUser>(`${userPath(id)}/enable`)
export const confirmUserEmail = (id: string) => postJson<AdminUser>(`${userPath(id)}/confirm-email`)

// Emails the person a password-reset link (the admin never sees or sets the password).
export const sendUserPasswordReset = (id: string) => postJson(`${userPath(id)}/password-reset`)

// Deletes the account. Its tile requests and history stay.
export const deleteUser = (id: string) => deleteJson(userPath(id))
