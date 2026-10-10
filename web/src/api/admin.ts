import { getJson } from './client'

// API calls for admins only. The API answers 401 when not signed in and 403 without the Admin role (AdminController).

// Proves the signed-in user is an admin (placeholder until the Phase 4 review queue).
export const pingAdmin = () => getJson<{ status: string }>('/api/admin/ping')
