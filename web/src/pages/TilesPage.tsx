import { useEffect, useState } from 'react'
import { getGames } from '@/api/games'
import { getTiles } from '@/api/tiles'
import FilterBar from '@/components/FilterBar'
import TileCard from '@/components/TileCard'
import { Button } from '@/components/ui/button'
import { useTileFilters } from '@/hooks/useTileFilters'
import { TILES_PAGE_SIZE } from '@/lib/constants'
import type { GameSummary } from '@/types/game'
import type { PagedResult } from '@/types/paged'
import type { TileSummary } from '@/types/tile'

// Tiles page: filter bar, grid of tile cards, and paging (DESIGN.md section 9.1).
// Filters live in the URL, so /tiles?game=25 opens already filtered to 1830.
export default function TilesPage() {
  const { filters, setFilter } = useTileFilters()
  const { game, color, kind, q, page } = filters

  const [games, setGames] = useState<GameSummary[]>([])
  // The last result, tagged with the filters it was loaded for.
  const [data, setData] = useState<{
    key: string
    result: PagedResult<TileSummary>
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // The filters as one string; when it differs from data.key, new results are loading.
  const key = JSON.stringify([game, color, kind, q, page])
  const loading = data?.key !== key

  // Games for the game filter, loaded once.
  useEffect(() => {
    let ignore = false
    getGames()
      .then((list) => {
        if (!ignore) setGames(list)
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
    getTiles({ game, color, kind, q, page, pageSize: TILES_PAGE_SIZE })
      .then((result) => {
        if (ignore) return
        setData({ key: JSON.stringify([game, color, kind, q, page]), result })
        setError(null)
      })
      .catch((err: unknown) => {
        if (!ignore) setError(err instanceof Error ? err.message : String(err))
      })
    // A newer request replaces this one; ignore this one's late answer.
    return () => {
      ignore = true
    }
  }, [game, color, kind, q, page])

  const result = data?.result

  // Change page and jump back to the top, since the paging buttons are at the bottom.
  const goToPage = (n: number) => {
    setFilter('page', n)
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Tiles</h1>
      <FilterBar filters={filters} games={games} onChange={setFilter} />

      {error && (
        <p className="text-destructive">Could not load tiles. {error}</p>
      )}
      {!result && !error && (
        <p className="text-muted-foreground">Loading tiles…</p>
      )}

      {result && (
        // Dim the old results while new ones load, instead of blanking the page.
        <div className={loading ? 'opacity-50' : undefined}>
          <p className="mb-3 text-sm text-muted-foreground">
            {result.totalCount} {result.totalCount === 1 ? 'tile' : 'tiles'}
          </p>

          {result.items.length === 0 ? (
            <p className="text-muted-foreground">
              No tiles match these filters.
            </p>
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
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => goToPage(page - 1)}
              >
                Previous
              </Button>
              <span>
                Page {result.page} of {result.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= result.totalPages}
                onClick={() => goToPage(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
