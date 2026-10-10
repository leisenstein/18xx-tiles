import { useEffect, useState } from 'react'
import { getJson } from '@/api/client'
import TileSvg from '@/components/TileSvg'
import type { TileSummary } from '@/types/tile'

// Development page: one tile for each drawing feature, to check TileSvg by eye.
// Open /dev/tiles and compare with reference/18xx_Generic_Tile_Reference.pdf.
// Ids are from the initial import (commit 46a592e).
const SAMPLES: { id: number; feature: string }[] = [
  { id: 1, feature: 'two towns on curves' },
  { id: 7, feature: 'curve' },
  { id: 9, feature: 'straight' },
  { id: 12, feature: 'city, 1 slot' },
  { id: 85, feature: 'OO: two cities, label' },
  { id: 64, feature: 'city, 2 slots' },
  { id: 124, feature: 'city, 3 slots' },
  { id: 313, feature: 'city, 4 slots' },
  { id: 131, feature: 'dual track' },
  { id: 15, feature: 'narrow track' },
  { id: 1641, feature: 'thin track, blue' },
  { id: 86, feature: 'junction' },
  { id: 735, feature: 'pass' },
  { id: 483, feature: 'offboard' },
  { id: 259, feature: 'frame' },
  { id: 32, feature: 'upgrade cost' },
  { id: 31, feature: 'icon' },
  { id: 661, feature: 'future label' },
  { id: 331, feature: 'phase revenue' },
  { id: 470, feature: 'two colors' },
  { id: 474, feature: 'color none' },
  { id: 524, feature: 'purple offboard' },
  { id: 576, feature: 'slots:0' },
  { id: 1035, feature: 'empty definition' },
]

export default function DevTilesPage() {
  const [tiles, setTiles] = useState<TileSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Load all sample tiles at once (one request per tile).
  useEffect(() => {
    let ignore = false
    Promise.all(SAMPLES.map((s) => getJson<TileSummary>(`/api/tiles/${s.id}`)))
      .then((data) => {
        if (!ignore) setTiles(data)
      })
      .catch((err: unknown) => {
        if (!ignore) setError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      ignore = true
    }
  }, [])

  if (error) return <p className="text-destructive">{error}</p>
  if (!tiles) return <p className="text-muted-foreground">Loading…</p>

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Tile drawing check</h1>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
        {tiles.map((tile, i) => (
          <li key={tile.id} className="space-y-1 text-center text-xs">
            <TileSvg
              definitionCode={tile.definitionCode}
              color={tile.color}
              number={tile.number}
              className="w-full"
            />
            <div className="font-medium">{tile.displayName}</div>
            <div className="text-muted-foreground">{SAMPLES[i].feature}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}
