import { Hexagon } from 'lucide-react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { ADMIN_ROLE } from '@/lib/constants'
import { cn } from '@/lib/utils'

// Links shown in the header, left to right.
const navItems = [
  { to: '/', label: 'Games' },
  { to: '/tiles', label: 'Tiles' },
  { to: '/tiles/common', label: 'Common Tiles' },
]

// Page frame: header with navigation, then the current page (<Outlet />).
// Drawn once for every page; only the <Outlet /> area changes when you navigate.
// - NavLink: a link that knows if its page is the current one (isActive), which makes it bold.
// - end: active only on an exact URL match, so "Tiles" is not bold on /tiles/common.
// - <Outlet />: where App.tsx places the current page (HomePage, TilesPage, ...).
// - Signed-in users also see "Submit a tile" and "My requests"; admins also see "Admin", "History", and "Imports".
// - Right side: the signed-in user's email and "Sign out", or "Sign in" and "Register".
export default function Layout() {
  const { user, loading, signOut } = useAuth()
  const navigate = useNavigate()
  const items = [
    ...navItems,
    ...(user
      ? [
          { to: '/submit', label: 'Submit a tile' },
          { to: '/account/requests', label: 'My requests' },
        ]
      : []),
    ...(user?.roles.includes(ADMIN_ROLE)
      ? [
          { to: '/admin/queue', label: 'Admin' },
          { to: '/admin/history', label: 'History' },
          { to: '/admin/imports', label: 'Imports' },
        ]
      : []),
  ]

  const onSignOut = async () => {
    await signOut()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2 font-semibold">
            <Hexagon className="size-5" />
            18xx Tiles
          </NavLink>
          <nav className="flex gap-4 text-sm">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) => cn('text-muted-foreground hover:text-foreground', isActive && 'font-medium text-foreground')}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          {/* ml-auto pushes this group to the right. Nothing shows until the first sign-in check finishes, to avoid a flicker. */}
          <div className="ml-auto flex items-center gap-3 text-sm">
            {!loading &&
              (user ? (
                <>
                  <span className="text-muted-foreground">{user.email}</span>
                  <Button variant="outline" size="sm" onClick={onSignOut}>
                    Sign out
                  </Button>
                </>
              ) : (
                <>
                  <Link to="/login" className="text-muted-foreground hover:text-foreground">
                    Sign in
                  </Link>
                  <Button asChild size="sm">
                    <Link to="/register">Register</Link>
                  </Button>
                </>
              ))}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
