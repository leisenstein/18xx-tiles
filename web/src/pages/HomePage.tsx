import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { getGames } from '@/api/games'
import type { GameSummary } from '@/types/game'

// Home page: every game with its tile count. Each game links to its tiles
// (/tiles?game={id}). Also links to the Common Tiles page (DESIGN.md 9.3).
export default function HomePage() {
  // null means "still loading".
  const [games, setGames] = useState<GameSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Load the games once, when the page first appears ([] = run once).
  useEffect(() => {
    // If the user leaves the page before the response arrives, ignore it
    // instead of updating a page that is no longer shown.
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

  if (error) {
    return <p className="text-destructive">Could not load games. {error}</p>
  }
  if (!games) {
    return <p className="text-muted-foreground">Loading games…</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold">Games</h1>
        <p className="text-sm text-muted-foreground">
          {games.length} games ·{' '}
          <Link to="/tiles/common" className="underline hover:text-foreground">
            Tiles common to many games
          </Link>
        </p>
      </div>

      {/* One card per game: 1 column on phones, 2 on tablets, 3 on wide screens. */}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {games.map((game) => (
          <li key={game.id}>
            <Link
              to={`/tiles?game=${game.id}`}
              className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted"
            >
              <span className="font-medium">{game.title}</span>
              <span className="text-sm text-muted-foreground">
                {game.tileCount} tiles
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
