import { useEffect, useState } from 'react'
import { getTiles } from '@/api/tiles'
import TileSvg from '@/components/TileSvg'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { TileSummary } from '@/types/tile'

const SEARCH_DELAY_MS = 300

interface TilePickerProps {
  exclude: Set<number> // tiles already in the list, left out of the results
  onAdd: (tile: TileSummary) => void
}

// "Add a tile" search box for a game's tile list (Edit game tiles, Propose a game): type a number, and matching tiles appear with a drawing and an Add
// button. Searches a moment after typing stops, and clears the box after a tile is added.
export default function TilePicker({ exclude, onAdd }: TilePickerProps) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<{ q: string; tiles: TileSummary[] } | null>(null)

  const q = search.trim()
  useEffect(() => {
    if (!q) return
    let ignore = false
    const timer = setTimeout(() => {
      getTiles({ q, pageSize: 20 })
        .then((page) => {
          if (!ignore) setResults({ q, tiles: page.items })
        })
        .catch(() => {
          if (!ignore) setResults({ q, tiles: [] })
        })
    }, SEARCH_DELAY_MS)
    return () => {
      ignore = true
      clearTimeout(timer)
    }
  }, [q])

  const shown = results?.q === q ? results.tiles.filter((t) => !exclude.has(t.id)) : []

  return (
    <div className="max-w-md space-y-2">
      <Input placeholder="Add a tile: type its number, e.g. 57" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Find a tile to add" />
      {q && results?.q === q && (
        <ul className="divide-y rounded-lg border">
          {shown.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">No tiles to add for "{q}".</li>}
          {shown.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-3 py-1.5 text-sm">
              <TileSvg definitionCode={t.definitionCode} color={t.color} number={t.number} className="w-10 shrink-0" />
              <span className="flex-1">
                {t.displayName} <span className="text-muted-foreground">· {t.color}</span>
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onAdd(t)
                  setSearch('')
                }}
              >
                Add
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
