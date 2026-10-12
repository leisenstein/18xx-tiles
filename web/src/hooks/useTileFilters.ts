import { useSearchParams } from 'react-router'
import { TILE_COLORS } from '@/lib/tiles/colors'

// Tile list filters, kept in the URL (?game=25&color=yellow&kind=city&exits=2&q=57&page=2)
// so a filtered view can be bookmarked or shared (DESIGN.md section 9.1).
export interface TileFilters {
  game?: number
  color?: string
  kind?: 'city' | 'town'
  exits?: number // 0 to 6: track leaves exactly this many sides; undefined = no filter
  q?: string
  page: number
}

export type TileFilterKey = keyof TileFilters

// "25" -> 25; anything that is not a whole number above 0 -> undefined.
function positiveInt(value: string | null): number | undefined {
  const n = Number(value)
  return value !== null && Number.isInteger(n) && n > 0 ? n : undefined
}

// Reads the filters from the URL and returns a function to change one of them.
// Bad values in a hand-typed URL (e.g. ?color=pink) are ignored rather than sent to the API.
export function useTileFilters() {
  const [params, setParams] = useSearchParams()

  const color = params.get('color')
  const kind = params.get('kind')
  const exits = Number(params.get('exits') ?? 'x')
  const filters: TileFilters = {
    game: positiveInt(params.get('game')),
    color: color !== null && TILE_COLORS.includes(color) ? color : undefined,
    kind: kind === 'city' || kind === 'town' ? kind : undefined,
    exits: Number.isInteger(exits) && exits >= 0 && exits <= 6 ? exits : undefined,
    q: params.get('q') || undefined,
    page: positiveInt(params.get('page')) ?? 1,
  }

  // Set or clear one filter. Changing anything other than the page goes back to page 1.
  const setFilter = (key: TileFilterKey, value: string | number | undefined) => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        if (value === undefined || value === '') next.delete(key)
        else next.set(key, String(value))
        if (key !== 'page') next.delete('page')
        return next
      },
      // Typing in the search box replaces the history entry, so Back skips each keystroke.
      { replace: key === 'q' },
    )
  }

  return { filters, setFilter }
}
