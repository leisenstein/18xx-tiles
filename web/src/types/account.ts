// The signed-in user, as returned by /api/account/me (matches CurrentUserDto in the API).
export interface CurrentUser {
  email: string
  roles: string[] // e.g. ['Admin']; empty for a regular user
}
