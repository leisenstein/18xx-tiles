import { BookOpen, ClipboardCheck, Download, Hexagon, History, Inbox, Layers, LayoutGrid, LogOut, SquarePlus, type LucideIcon, Users } from 'lucide-react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import Logo from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { ADMIN_ROLE } from '@/lib/constants'
import { TILE_FILLS_MAIN } from '@/lib/tiles/colors'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  section?: boolean // lit for every page under this address (Docs has /admin/docs/runbook and /admin/docs/database)
}

// Links shown in the header, left to right: browsing for everyone, contributing for signed-in users, admin tools for admins (after a divider).
const browseItems: NavItem[] = [
  { to: '/', label: 'Games', icon: LayoutGrid },
  { to: '/tiles', label: 'Tiles', icon: Hexagon },
  { to: '/tiles/common', label: 'Common Tiles', icon: Layers },
]
const userItems: NavItem[] = [
  { to: '/submit', label: 'Submit a tile', icon: SquarePlus },
  { to: '/submit/game', label: 'Submit a game', icon: LayoutGrid },
  { to: '/account/requests', label: 'My requests', icon: Inbox },
]
const adminItems: NavItem[] = [
  { to: '/admin/queue', label: 'Review', icon: ClipboardCheck },
  { to: '/admin/history', label: 'History', icon: History },
  { to: '/admin/imports', label: 'Imports', icon: Download },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/docs', label: 'Docs', icon: BookOpen, section: true },
]

// One header link: icon and label; the current page gets a soft pill. end = active only on an exact URL match, so "Tiles" is not lit on /tiles/common.
function NavItemLink({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={!item.section}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
          isActive && 'bg-muted font-medium text-foreground',
        )
      }
    >
      <Icon className="size-4" aria-hidden="true" />
      {item.label}
    </NavLink>
  )
}

// Page frame: header with navigation, then the current page (<Outlet />). Drawn once for every page; only the <Outlet /> area changes.
// - A thin strip in the four main tile colors (yellow, green, brown, gray) runs across the top: the site's one bit of decoration.
// - Left: the logo (a stack of tiles, the full height of the header) and "18xx Tiles". Middle: links with icons. Right: the signed-in user's initial, email, and Sign out; or Sign in
//   and Register.
// - The header stays at the top while scrolling (sticky).
export default function Layout() {
  const { user, loading, signOut } = useAuth()
  const navigate = useNavigate()
  const isAdmin = user?.roles.includes(ADMIN_ROLE) ?? false

  const onSignOut = async () => {
    await signOut()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="flex h-1" aria-hidden="true">
          {TILE_FILLS_MAIN.map((fill) => (
            <span key={fill} className="flex-1" style={{ backgroundColor: fill }} />
          ))}
        </div>
        {/* The logo runs the full height of the header; links and the account area sit to its right and wrap onto a second row when needed. */}
        <div className="mx-auto flex max-w-6xl items-center gap-x-6 px-4 py-1">
          <NavLink to="/" className="flex shrink-0 items-center gap-2">
            <Logo className="size-22" />
            <span className="text-xl font-bold tracking-tight">
              18xx <span className="font-medium text-muted-foreground">Tiles</span>
            </span>
          </NavLink>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-6 gap-y-2 py-2">
            <nav className="flex flex-wrap items-center gap-1 text-sm">
              {browseItems.map((item) => (
                <NavItemLink key={item.to} item={item} />
              ))}
              {user && userItems.map((item) => <NavItemLink key={item.to} item={item} />)}
              {isAdmin && (
                <>
                  <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
                  {adminItems.map((item) => (
                    <NavItemLink key={item.to} item={item} />
                  ))}
                </>
              )}
            </nav>
            {/* ml-auto pushes this group to the right. Nothing shows until the first sign-in check finishes, to avoid a flicker. */}
            <div className="ml-auto flex items-center gap-2 text-sm">
              {!loading &&
                (user ? (
                  <>
                    {/* The initial and email open My account (change password). */}
                    <Link to="/account" className="flex items-center gap-2 rounded-md hover:text-foreground" title="My account">
                      <span
                        className="flex size-7 items-center justify-center rounded-full bg-amber-100 text-xs font-semibold text-amber-900 uppercase"
                        aria-hidden="true"
                      >
                        {user.email.charAt(0)}
                      </span>
                      <span className="hidden text-muted-foreground hover:text-foreground hover:underline lg:inline">{user.email}</span>
                      <span className="sr-only lg:hidden">My account</span>
                    </Link>
                    <Button variant="ghost" size="sm" onClick={onSignOut}>
                      <LogOut aria-hidden="true" />
                      Sign out
                    </Button>
                  </>
                ) : (
                  <>
                    <Button asChild variant="ghost" size="sm">
                      <Link to="/login">Sign in</Link>
                    </Button>
                    <Button asChild size="sm">
                      <Link to="/register">Register</Link>
                    </Button>
                  </>
                ))}
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
      {/* A link to the credits on every page (DESIGN.md open item 1); the data sources, licenses, and disclaimers are on /about. */}
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl justify-end px-4 py-4 text-xs text-muted-foreground">
          <Link to="/about" className="underline hover:text-foreground">
            About and credits
          </Link>
        </div>
      </footer>
    </div>
  )
}
