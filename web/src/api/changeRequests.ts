import type { ChangeRequest, ChangeRequestSubmit, NumberCheck } from '@/types/changeRequest'
import { getJson, postJson } from './client'

// API calls for proposing changes (ChangeRequestsController). Any signed-in user.

// Submit a request. A regular user's request comes back Pending; an admin's is applied at once and comes back Approved.
// Throws ApiError 400 (problem.errors lists every problem) or 409 (problem.detail: a duplicate tile).
export const submitChangeRequest = (body: ChangeRequestSubmit) => postJson<ChangeRequest>('/api/change-requests', body)

// Who else uses this tile number: live tiles and Pending requests. exceptTileId leaves out the tile being edited.
export function checkNumber(number: string, exceptTileId?: number) {
  const params = new URLSearchParams({ number })
  if (exceptTileId !== undefined) params.set('exceptTileId', String(exceptTileId))
  return getJson<NumberCheck>(`/api/change-requests/number-check?${params}`)
}

// The signed-in user's own requests, newest first.
export const getMyChangeRequests = () => getJson<ChangeRequest[]>('/api/change-requests/mine')
