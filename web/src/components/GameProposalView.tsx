import { Link } from 'react-router'
import TileSvg from '@/components/TileSvg'
import { countText } from '@/lib/tileCount'
import type { ChangeRequest } from '@/types/changeRequest'

// A proposed new game (change request type AddGame) in the review queue, My requests, and History: its title, designer, and publisher, and a small
// drawing of each tile it uses with the box count. Once approved, the title links to the game's tiles.
export default function GameProposalView({ request }: { request: ChangeRequest }) {
  const game = request.proposedGame
  if (!game) return null
  const credits = [game.designer, game.publisher].filter(Boolean).join(' · ')
  return (
    <div className="space-y-2">
      <div>
        <div className="font-medium">
          {request.gameId !== null ? (
            <Link to={`/tiles?game=${request.gameId}`} className="underline">
              {request.gameTitle ?? game.title}
            </Link>
          ) : (
            game.title
          )}
        </div>
        {credits && <div className="text-xs text-muted-foreground">{credits}</div>}
        <div className="text-xs text-muted-foreground">
          {game.tiles.length} {game.tiles.length === 1 ? 'tile' : 'tiles'}
        </div>
      </div>
      <ul className="flex max-w-xl flex-wrap gap-2">
        {game.tiles.map((t) => (
          <li key={t.tileId} className="w-16 text-center text-xs" title={t.notes ?? undefined}>
            <TileSvg definitionCode={t.definitionCode} color={t.color} number={t.number} className="w-full" />
            <div className="truncate font-medium">{t.displayName}</div>
            <div className="text-muted-foreground">{countText(t.count)}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}
