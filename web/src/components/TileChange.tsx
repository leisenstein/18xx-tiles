import { ArrowRight } from 'lucide-react'
import TileSvg from '@/components/TileSvg'
import { countText } from '@/lib/tileCount'
import type { ChangeRequest, TileContent } from '@/types/changeRequest'

// How many games to name under a drawing before summarizing the rest ("and 107 more"); some tiles are used by over 100 games.
const MAX_GAMES_SHOWN = 3

// The games line under a drawing: "1830 (3 in box), 1825 (count unknown), and 2 more".
function gamesText(content: TileContent): string {
  if (content.games === null) return 'games unchanged'
  if (content.games.length === 0) return 'no games'
  const named = content.games.slice(0, MAX_GAMES_SHOWN).map((g) => `${g.title ?? `game ${g.gameId}`} (${countText(g.count)})`)
  const rest = content.games.length - named.length
  return rest > 0 ? `${named.join(', ')}, and ${rest} more` : named.join(', ')
}

function Drawing({ content, label }: { content: TileContent; label: string }) {
  return (
    <figure className="w-36 space-y-1">
      <TileSvg definitionCode={content.definitionCode} color={content.color} number={content.number} className="w-full" />
      <figcaption className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{label}</span> #{content.number}, {content.color}. {gamesText(content)}
      </figcaption>
    </figure>
  )
}

// Before and after drawings for a change request (DESIGN.md section 9.1, admin queue and history): Add shows the new tile, Delete the tile removed,
// Edit the tile before and after. For approved changes the saved "before" snapshot is used (audit trail); otherwise the tile as it is now.
export default function TileChange({ request }: { request: ChangeRequest }) {
  const { type, status, current, before, proposed } = request
  const old = before ?? current
  const applied = status === 'Approved' && before !== null
  const oldLabel = type === 'Delete' ? (applied ? 'Deleted:' : 'Delete:') : applied ? 'Before:' : 'Now:'
  const newLabel = type === 'Add' ? 'New:' : applied ? 'After:' : 'Proposed:'
  return (
    <div className="flex flex-wrap items-start gap-3">
      {type !== 'Add' && old && <Drawing content={old} label={oldLabel} />}
      {type === 'Edit' && <ArrowRight className="mt-12 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />}
      {type !== 'Delete' && proposed && <Drawing content={proposed} label={newLabel} />}
      {type !== 'Add' && !old && <p className="text-sm text-muted-foreground">The tile no longer exists.</p>}
    </div>
  )
}
