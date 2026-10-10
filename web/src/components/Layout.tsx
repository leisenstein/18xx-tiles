import { Hexagon } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'
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
export default function Layout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2 font-semibold">
            <Hexagon className="size-5" />
            18xx Tiles
          </NavLink>
          <nav className="flex gap-4 text-sm">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) =>
                  cn(
                    'text-muted-foreground hover:text-foreground',
                    isActive && 'font-medium text-foreground',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
