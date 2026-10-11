// One account on the admin Users page. Matches AdminUserDto in the API.
// status: Active; Locked (Identity's own short lockout after 5 wrong passwords, until lockoutEndUtc); Disabled (by an admin, until enabled).
// isYou: the signed-in admin's own account. isConfiguredAdmin: the account in the Admin:Email setting. Both are protected from lock-out changes.
export interface AdminUser {
  id: string
  email: string
  emailConfirmed: boolean
  roles: string[]
  status: 'Active' | 'Locked' | 'Disabled'
  lockoutEndUtc: string | null
  requestCount: number
  isYou: boolean
  isConfiguredAdmin: boolean
}
