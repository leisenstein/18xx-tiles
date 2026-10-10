import type { ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { useAuth } from '@/hooks/useAuth'

interface RequireRoleProps {
  role?: string // e.g. ADMIN_ROLE; leave out to allow any signed-in user
  children: ReactNode // the page to show when allowed
}

// Route guard (DESIGN.md section 9.2): shows the page only to signed-in users with the right role.
// - Not signed in: sends them to /login, with ?returnTo so they come back here afterwards.
// - Signed in without the role: shows a "not allowed" message.
// This only decides what the browser shows. The API checks permissions again on every request ([Authorize] on the controller), so hiding a page is
// never the only protection.
export default function RequireRole({ role, children }: RequireRoleProps) {
  const { user, loading } = useAuth()
  const location = useLocation()

  // Wait for the first "who is signed in?" check; otherwise a signed-in admin would briefly be sent to /login on a page reload.
  if (loading) {
    return <p className="text-muted-foreground">Checking sign-in…</p>
  }

  if (!user) {
    const returnTo = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />
  }

  if (role && !user.roles.includes(role)) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Not allowed</h1>
        <p className="text-muted-foreground">This page is only for the {role} role.</p>
        <Link to="/" className="text-sm underline">
          Go to the home page
        </Link>
      </div>
    )
  }

  return children
}
