import { useState } from 'react'
import { Link } from 'react-router'
import RotateButton from '@/components/RotateButton'
import TileSvg from '@/components/TileSvg'
import { countText } from '@/lib/tileCount'
import type { TileSummary } from '@/types/tile'

interface TileCardProps {
  tile: TileSummary
  // True when the list is filtered by one game, so the box count means something.
  showCountInGame: boolean
}

// One tile in the grid: drawing, name, color, and game count. Links to the tile detail page. The rotate button in the corner turns the drawing 60
// degrees per click (view only); it sits beside the link, not inside it, so clicking it does not open the tile.
export default function TileCard({ tile, showCountInGame }: TileCardProps) {
  const [rotation, setRotation] = useState(0)
  return (
    <div className="relative">
      <Link to={`/tiles/${tile.id}`} className="block rounded-lg border p-2 text-center hover:bg-muted">
        <TileSvg definitionCode={tile.definitionCode} color={tile.color} number={tile.number} rotation={rotation} className="mx-auto w-full max-w-40" />
        <div className="mt-1 text-sm font-medium">{tile.displayName}</div>
        <div className="text-xs text-muted-foreground">
          {tile.color} · {tile.gameCount} {tile.gameCount === 1 ? 'game' : 'games'}
          {showCountInGame && ` · ${countText(tile.countInGame)}`}
        </div>
      </Link>
      <RotateButton onClick={() => setRotation(rotation + 1)} className="absolute top-1.5 right-1.5" />
    </div>
  )
}
