import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { getCommonTiles } from '@/api/tiles'
import TileCard from '@/components/TileCard'
import { Input } from '@/components/ui/input'
import type { TileSummary } from '@/types/tile'

// Allowed range and default for "used by at least N games" (same as the API, DESIGN.md 9.3).
const MIN_GAMES_LOWEST = 2
const MIN_GAMES_HIGHEST = 200
const MIN_GAMES_DEFAULT = 10

// Common Tiles page (/tiles/common?minGames=10): tiles shared by many games,
// grouped by color. N is kept in the URL so a view can be linked.
export default function CommonTilesPage() {
  const [params, setParams] = useSearchParams()

  // The text in the box (kept separately so a half-typed value can be shown and checked).
  const urlValue = params.get('minGames') ?? String(MIN_GAMES_DEFAULT)
  const [text, setText] = useState(urlValue)
  const minGames = Number(text)
  const valid =
    Number.isInteger(minGames) &&
    minGames >= MIN_GAMES_LOWEST &&
    minGames <= MIN_GAMES_HIGHEST

  // The last result, tagged with the N it was loaded for.
  const [data, setData] = useState<{
    minGames: number
    tiles: TileSummary[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Load whenever N is valid and changes. Invalid input is never sent to the API.
  useEffect(() => {
    if (!valid) return
    let ignore = false
    getCommonTiles(minGames)
      .then((tiles) => {
        if (ignore) return
        setData({ minGames, tiles })
        setError(null)
      })
      .catch((err: unknown) => {
        if (!ignore) setError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      ignore = true
    }
  }, [minGames, valid])

  // Typing updates the box right away and the URL only when the value is valid.
  const onChange = (value: string) => {
    setText(value)
    const n = Number(value)
    if (
      Number.isInteger(n) &&
      n >= MIN_GAMES_LOWEST &&
      n <= MIN_GAMES_HIGHEST
    ) {
      setParams({ minGames: String(n) }, { replace: true })
    }
  }

  // Group the (already sorted) tiles by color, keeping the API's color order.
  const groups: { color: string; tiles: TileSummary[] }[] = []
  for (const tile of data?.tiles ?? []) {
    const last = groups.at(-1)
    if (last?.color === tile.color) last.tiles.push(tile)
    else groups.push({ color: tile.color, tiles: [tile] })
  }
  const loading = valid && data?.minGames !== minGames

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Common Tiles</h1>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label htmlFor="min-games">Used by at least</label>
        <Input
          id="min-games"
          type="number"
          min={MIN_GAMES_LOWEST}
          max={MIN_GAMES_HIGHEST}
          step={1}
          className="w-20"
          value={text}
          aria-invalid={!valid}
          onChange={(e) => onChange(e.target.value)}
        />
        <span>games</span>
      </div>
      {!valid && (
        <p className="text-sm text-destructive">
          Enter a whole number from {MIN_GAMES_LOWEST} to {MIN_GAMES_HIGHEST}.
        </p>
      )}

      <p className="text-sm text-muted-foreground">
        Game counts include variants and scenarios as separate titles (for
        example the 1822 family), so the number of distinct published games may
        be lower.
      </p>

      {error && (
        <p className="text-destructive">Could not load tiles. {error}</p>
      )}
      {!data && !error && valid && (
        <p className="text-muted-foreground">Loading tiles…</p>
      )}

      {data && (
        <div className={loading ? 'space-y-6 opacity-50' : 'space-y-6'}>
          <p className="text-sm text-muted-foreground">
            {data.tiles.length} {data.tiles.length === 1 ? 'tile' : 'tiles'}
          </p>
          {data.tiles.length === 0 && (
            <p className="text-muted-foreground">
              No tiles are used by that many games.
            </p>
          )}
          {groups.map((group) => (
            <section key={group.color} className="space-y-2">
              <h2 className="text-lg font-semibold capitalize">
                {group.color}{' '}
                <span className="text-sm font-normal text-muted-foreground">
                  ({group.tiles.length})
                </span>
              </h2>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {group.tiles.map((tile) => (
                  <li key={tile.id}>
                    <TileCard tile={tile} showCountInGame={false} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
