import { useState } from 'react'
import {
  BookOpen,
  ClipboardCheck,
  Download,
  Hexagon,
  History,
  Inbox,
  Layers,
  LayoutGrid,
  LogOut,
  Menu,
  SquarePlus,
  type LucideIcon,
  Users,
  X,
} from 'lucide-react'
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
// onNavigate closes the phone menu after a link is chosen.
function NavItemLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={!item.section}
      onClick={onNavigate}
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
// - Wide screens (md and up): the logo (the full height of the header) and "18xx Tiles"; the links with icons, wrapping onto a second row when needed;
//   then the signed-in user's initial, email, and Sign out, or Sign in and Register.
// - Phones: a slim bar with a small logo, "18xx Tiles", and a menu button. The button opens a panel under the bar with the same links, one per line,
//   and the account buttons; choosing a link closes it. This keeps the sticky header short, so it does not cover the page while scrolling.
// - The header stays at the top while scrolling (sticky).
export default function Layout() {
  const { user, loading, signOut } = useAuth()
  const navigate = useNavigate()
  const isAdmin = user?.roles.includes(ADMIN_ROLE) ?? false
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)

  const onSignOut = async () => {
    closeMenu()
    await signOut()
    navigate('/')
  }

  // Every link the current visitor can use, as lines (phone menu) or as a wrapping row (wide screens).
  const links = (vertical: boolean) => (
    <nav className={cn('text-sm', vertical ? 'grid gap-1' : 'flex flex-wrap items-center gap-1')}>
      {browseItems.map((item) => (
        <NavItemLink key={item.to} item={item} onNavigate={closeMenu} />
      ))}
      {user && userItems.map((item) => <NavItemLink key={item.to} item={item} onNavigate={closeMenu} />)}
      {isAdmin && (
        <>
          <span className={cn('bg-border', vertical ? 'my-1 h-px w-full' : 'mx-1 h-5 w-px')} aria-hidden="true" />
          {adminItems.map((item) => (
            <NavItemLink key={item.to} item={item} onNavigate={closeMenu} />
          ))}
        </>
      )}
    </nav>
  )

  // My account and Sign out, or Sign in and Register. Nothing shows until the first sign-in check finishes, to avoid a flicker. The email shows on
  // large screens and in the phone menu (showEmail); in between, only the initial.
  const account = (showEmail: boolean) =>
    !loading &&
    (user ? (
      <>
        {/* The initial and email open My account (change password). */}
        <Link to="/account" onClick={closeMenu} className="flex min-w-0 items-center gap-2 rounded-md hover:text-foreground" title="My account">
          <span
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-semibold text-amber-900 uppercase"
            aria-hidden="true"
          >
            {user.email.charAt(0)}
          </span>
          <span className={cn('truncate text-muted-foreground hover:text-foreground hover:underline', !showEmail && 'hidden lg:inline')}>{user.email}</span>
          {!showEmail && <span className="sr-only lg:hidden">My account</span>}
        </Link>
        <Button variant="ghost" size="sm" onClick={onSignOut}>
          <LogOut aria-hidden="true" />
          Sign out
        </Button>
      </>
    ) : (
      <>
        <Button asChild variant="ghost" size="sm">
          <Link to="/login" onClick={closeMenu}>
            Sign in
          </Link>
        </Button>
        <Button asChild size="sm">
          <Link to="/register" onClick={closeMenu}>
            Register
          </Link>
        </Button>
      </>
    ))

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="flex h-1" aria-hidden="true">
          {TILE_FILLS_MAIN.map((fill) => (
            <span key={fill} className="flex-1" style={{ backgroundColor: fill }} />
          ))}
        </div>
        <div className="mx-auto flex max-w-6xl items-center gap-x-6 px-4 py-1">
          <NavLink to="/" onClick={closeMenu} className="flex shrink-0 items-center gap-2">
            <Logo className="size-10 md:size-22" />
            <span className="text-lg font-bold tracking-tight md:text-xl">
              18xx <span className="font-medium text-muted-foreground">Tiles</span>
            </span>
          </NavLink>
          {/* Wide screens: links and the account area to the right of the logo, wrapping onto a second row when needed. */}
          <div className="hidden min-w-0 flex-1 flex-wrap items-center gap-x-6 gap-y-2 py-2 md:flex">
            {links(false)}
            {/* ml-auto pushes this group to the right. */}
            <div className="ml-auto flex items-center gap-2 text-sm">{account(false)}</div>
          </div>
          {/* Phones: the menu button. */}
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto md:hidden"
            aria-expanded={menuOpen}
            aria-controls="phone-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </Button>
        </div>
        {/* Phones: the open menu, under the bar. Scrolls on its own if it is taller than the screen. */}
        {menuOpen && (
          <div id="phone-menu" className="max-h-[calc(100dvh-4rem)] space-y-3 overflow-y-auto border-t px-4 py-3 md:hidden">
            {links(true)}
            <div className="flex items-center justify-between gap-2 border-t pt-3 text-sm">{account(true)}</div>
          </div>
        )}
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
