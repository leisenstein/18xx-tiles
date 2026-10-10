import type { ChangeRequest, ChangeRequestStatus, TileHistory } from '@/types/changeRequest'
import { getJson, postJson } from './client'

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

// Reject a Pending request. The note is required and shown to the submitter.
export const rejectChangeRequest = (id: number, note: string) => postJson<ChangeRequest>(`/api/admin/change-requests/${id}/reject`, { note })
