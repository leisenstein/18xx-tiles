import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Hexagon, ListChecks, Pencil, Printer, SearchX } from 'lucide-react'
import { getGames } from '@/api/games'
import { getTileRevenues, getTiles } from '@/api/tiles'
import EmptyState from '@/components/EmptyState'
import FilterBar from '@/components/FilterBar'
import LoadingState from '@/components/LoadingState'
import PageHeader from '@/components/PageHeader'
import TileCard from '@/components/TileCard'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useTileFilters } from '@/hooks/useTileFilters'
import { ADMIN_ROLE, TILES_PAGE_SIZE } from '@/lib/constants'
import { boxText, creditsText } from '@/lib/tileCount'
import type { GameSummary } from '@/types/game'
import type { PagedResult } from '@/types/paged'
import type { TileSummary } from '@/types/tile'

// Tiles page: filter bar, grid of tile cards, and paging (DESIGN.md section 9.1).
// Filters live in the URL, so /tiles?game=25 opens already filtered to 1830.
export default function TilesPage() {
  const { filters, setFilter } = useTileFilters()
  const { game, color, kind, exits, revenue, minGames, q, page } = filters
  const { user } = useAuth()

  const [games, setGames] = useState<GameSummary[]>([])
  const [revenues, setRevenues] = useState<number[]>([])
  // The last result, tagged with the filters it was loaded for.
  const [data, setData] = useState<{
    key: string
    result: PagedResult<TileSummary>
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // The filters as one string; when it differs from data.key, new results are loading.
  const key = JSON.stringify([game, color, kind, exits, revenue, minGames, q, page])
  const loading = data?.key !== key

  // Games for the game filter and amounts for the revenue filter, loaded once.
  useEffect(() => {
    let ignore = false
    getGames()
      .then((list) => {
        if (!ignore) setGames(list)
      })
      .catch((err: unknown) => {
        if (!ignore) setError(err instanceof Error ? err.message : String(err))
      })
    getTileRevenues()
      .then((list) => {
        if (!ignore) setRevenues(list)
      })
      .catch((err: unknown) => {
        if (!ignore) setError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      ignore = true
    }
  }, [])

  // Tiles, reloaded whenever a filter or the page changes.
  useEffect(() => {
    let ignore = false
    getTiles({ game, color, kind, exits, revenue, minGames, q, page, pageSize: TILES_PAGE_SIZE })
      .then((result) => {
        if (ignore) return
        setData({ key, result })
        setError(null)
      })
      .catch((err: unknown) => {
        if (!ignore) setError(err instanceof Error ? err.message : String(err))
      })
    // A newer request replaces this one; ignore this one's late answer.
    return () => {
      ignore = true
    }
  }, [key, game, color, kind, exits, revenue, minGames, q, page])

  const result = data?.result
  const selectedGame = games.find((g) => g.id === game)

  // Change page and jump back to the top, since the paging buttons are at the bottom.
  const goToPage = (n: number) => {
    setFilter('page', n)
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Hexagon}
        title="Tiles"
        description="Every tile from every game. Filter by game, color, exits, revenue, how many games use it, or cities and towns, or search by number."
      />
      <FilterBar filters={filters} games={games} revenues={revenues} onChange={setFilter} />
      {/* Filtered to one game: how many tiles come in its box. */}
      {selectedGame && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-3">
          <p className="text-sm">
            <span className="font-medium">{selectedGame.title}</span>
            <span className="text-muted-foreground">
              {creditsText(selectedGame) && ` (${creditsText(selectedGame)})`}: {selectedGame.tileCount} tile designs, {boxText(selectedGame)}.
            </span>
          </p>
          {/* Actions for this game: printing for signed-in users (DESIGN.md 9.4); editing the whole tile list for admins (section 8). */}
          {user && (
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link to={`/print/circles?game=${selectedGame.id}`}>
                  <Printer aria-hidden="true" />
                  Print tray stickers
                </Link>
              </Button>
              {user.roles.includes(ADMIN_ROLE) && (
                <>
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/admin/games/${selectedGame.id}/tiles`}>
                      <ListChecks aria-hidden="true" />
                      Edit this game&apos;s tiles
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/admin/games/${selectedGame.id}/edit`}>
                      <Pencil aria-hidden="true" />
                      Edit or delete game
                    </Link>
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {error && <p className="text-destructive">Could not load tiles. {error}</p>}
      {!result && !error && <LoadingState label="Loading tiles…" />}

      {result && (
        // Dim the old results while new ones load, instead of blanking the page.
        <div className={loading ? 'opacity-50' : undefined}>
          <p className="mb-3 text-sm text-muted-foreground">
            {result.totalCount} {result.totalCount === 1 ? 'tile' : 'tiles'}
          </p>

          {result.items.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="No tiles match these filters"
              description="Try another color or type, or a different number."
              action={
                <Button asChild variant="outline" size="sm">
                  <Link to={game ? `/tiles?game=${game}` : '/tiles'}>Clear filters</Link>
                </Button>
              }
            />
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {result.items.map((tile) => (
                <li key={tile.id}>
                  <TileCard tile={tile} showCountInGame={game !== undefined} />
                </li>
              ))}
            </ul>
          )}

          {result.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3 text-sm">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
                Previous
              </Button>
              <span>
                Page {result.page} of {result.totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= result.totalPages} onClick={() => goToPage(page + 1)}>
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
