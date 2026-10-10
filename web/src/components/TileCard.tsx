import { Link } from 'react-router'
import TileSvg from '@/components/TileSvg'
import { UNLIMITED_TILE_COUNT } from '@/lib/constants'
import type { TileSummary } from '@/types/tile'

interface TileCardProps {
  tile: TileSummary
  // True when the list is filtered by one game, so the box count means something.
  showCountInGame: boolean
}

// How many of this tile come in the game's box.
function countText(count: number | null): string {
  if (count === null) return 'count unknown'
  if (count === UNLIMITED_TILE_COUNT) return 'unlimited'
  return `${count} in box`
}

// One tile in the grid: drawing, name, color, and game count. Links to the tile detail page.
export default function TileCard({ tile, showCountInGame }: TileCardProps) {
  return (
    <Link
      to={`/tiles/${tile.id}`}
      className="block rounded-lg border p-2 text-center hover:bg-muted"
    >
      <TileSvg
        definitionCode={tile.definitionCode}
        color={tile.color}
        number={tile.number}
        className="mx-auto w-full max-w-40"
      />
      <div className="mt-1 text-sm font-medium">{tile.displayName}</div>
      <div className="text-xs text-muted-foreground">
        {tile.color} · {tile.gameCount}{' '}
        {tile.gameCount === 1 ? 'game' : 'games'}
        {showCountInGame && ` · ${countText(tile.countInGame)}`}
      </div>
    </Link>
  )
}
