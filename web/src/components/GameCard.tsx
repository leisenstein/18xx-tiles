import { Boxes, ChevronRight, Hexagon, Infinity as InfinityIcon } from 'lucide-react'
import { Link } from 'react-router'
import { creditsText } from '@/lib/tileCount'
import { tileFills } from '@/lib/tiles/colors'
import type { GameSummary } from '@/types/game'

// The color strip's order: the upgrade phases (two-color tiles between the phases they join), then the game-specific colors. Colors not listed go last.
const STRIP_ORDER = ['yellow', 'green', 'greenbrown', 'brown', 'brownsepia', 'sepia', 'browngray', 'gray', 'red', 'orange', 'blue', 'purple', 'white', 'none']
const LABELS: Record<string, string> = { greenbrown: 'green-brown', brownsepia: 'brown-sepia', browngray: 'brown-gray', none: 'no color' }
const rank = (color: string) => (STRIP_ORDER.includes(color) ? STRIP_ORDER.indexOf(color) : STRIP_ORDER.length)

// A segment's background: its color, or a hard half-and-half split for two-color tiles (drawn the same way as the tiles themselves).
function background(color: string) {
  const fills = tileFills(color)
  return fills.length === 1 ? fills[0] : `linear-gradient(90deg, ${fills[0]} 50%, ${fills[1]} 50%)`
}

// One game on the Games page (DESIGN.md section 9.1): title, designer and publisher, a strip showing its mix of tile colors, and its counts.
// The whole card links to the game's tiles.
export default function GameCard({ game }: { game: GameSummary }) {
  const parts = Object.entries(game.colorCounts)
    .filter(([, count]) => count > 0)
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([color, count]) => ({ color, label: LABELS[color] ?? color, count }))
  const mix = parts.map((p) => `${p.count} ${p.label}`).join(', ')
  const credits = creditsText(game)

  return (
    <Link
      to={`/tiles?game=${game.id}`}
      className="group flex h-full flex-col gap-3 rounded-xl border bg-card p-4 transition hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-semibold">{game.title}</div>
          <div className="truncate text-xs text-muted-foreground">{credits || 'Designer and publisher not listed'}</div>
        </div>
        <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
      </div>

      {/* Tile color mix: one segment per color, as wide as its share of the game's tile designs. White tiles get a thin outline so they show. */}
      <div className="flex h-2 overflow-hidden rounded-full bg-muted" title={mix} role="img" aria-label={`Tile colors: ${mix}`}>
        {parts.map((p) => (
          <span
            key={p.color}
            style={{
              flexGrow: p.count,
              background: background(p.color),
              boxShadow: p.color === 'white' || p.color === 'none' ? 'inset 0 0 0 1px #C9C3B6' : undefined,
            }}
          />
        ))}
      </div>

      <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1" title="Different tiles (designs) the game uses">
          <Hexagon className="size-3.5" aria-hidden="true" />
          {game.tileCount} {game.tileCount === 1 ? 'design' : 'designs'}
        </span>
        {game.physicalTileCount > 0 && (
          <span className="flex items-center gap-1" title="Tiles in the box">
            <Boxes className="size-3.5" aria-hidden="true" />
            {game.physicalTileCount} in box
          </span>
        )}
        {game.unlimitedTileCount > 0 && (
          <span className="flex items-center gap-1" title="Designs with an unlimited supply">
            <InfinityIcon className="size-3.5" aria-hidden="true" />
            {game.unlimitedTileCount} unlimited
          </span>
        )}
        {game.unknownCountTileCount > 0 && <span title="Designs with no count recorded">{game.unknownCountTileCount} count unknown</span>}
      </div>
    </Link>
  )
}
