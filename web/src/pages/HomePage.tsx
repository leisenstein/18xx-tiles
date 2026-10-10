import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Layers, LayoutGrid, Search, SearchX } from 'lucide-react'
import { getGames } from '@/api/games'
import EmptyState from '@/components/EmptyState'
import GameCard from '@/components/GameCard'
import LoadingState from '@/components/LoadingState'
import PageHeader from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { GameSummary } from '@/types/game'

// Home page (DESIGN.md section 9.1): every game as a card (GameCard) linking to its tiles (/tiles?game={id}), a search box that filters the cards by
// title, designer, or publisher, and a link to the Common Tiles page (section 9.3).
export default function HomePage() {
  // null means "still loading".
  const [games, setGames] = useState<GameSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Load the games once, when the page first appears ([] = run once).
  useEffect(() => {
    // If the user leaves the page before the response arrives, ignore it instead of updating a page that is no longer shown.
    let ignore = false
    getGames()
      .then((data) => {
        if (!ignore) setGames(data)
      })
      .catch((err: unknown) => {
        if (!ignore) setError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      ignore = true
    }
  }, [])

  const q = search.trim().toLowerCase()
  const shown = (games ?? []).filter((g) => !q || [g.title, g.designer, g.publisher].some((text) => text?.toLowerCase().includes(q)))

  return (
    <div className="space-y-6">
      <PageHeader
        icon={LayoutGrid}
        title="Games"
        description={games ? `${games.length} games from 18xx.games. Pick one to see its tiles.` : 'Games from 18xx.games.'}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/tiles/common">
              <Layers aria-hidden="true" />
              Tiles common to many games
            </Link>
          </Button>
        }
      />

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          className="pl-9"
          placeholder="Find a game, designer, or publisher"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Find a game"
        />
      </div>

      {error && <p className="text-destructive">Could not load games. {error}</p>}
      {!games && !error && <LoadingState label="Loading games…" />}
      {games && shown.length === 0 && (
        <EmptyState
          icon={SearchX}
          title={`No games match "${search.trim()}"`}
          description="Try part of the title, or a designer's or publisher's name."
          action={
            <Button variant="outline" size="sm" onClick={() => setSearch('')}>
              Clear search
            </Button>
          }
        />
      )}

      {/* One card per game: 1 column on phones, 2 on tablets, 3 on wide screens. */}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((game) => (
          <li key={game.id}>
            <GameCard game={game} />
          </li>
        ))}
      </ul>
    </div>
  )
}
