import { LayoutGrid } from 'lucide-react'
import { Link } from 'react-router'
import TileSvg from '@/components/TileSvg'
import { countText } from '@/lib/tileCount'
import type { GameChange, GameTileChange } from '@/types/gameTiles'

// Dates are stored in UTC; show them in the viewer's local time.
const when = (utc: string) => new Date(utc).toLocaleString()

// What happened to one tile: "added, 3 in box", "removed (was 2 in box)", "2 in box → 3 in box; notes: ...".
function describe(c: GameTileChange): string {
  if (c.kind === 'added') return `added, ${countText(c.afterCount)}` + (c.afterNotes ? ` (${c.afterNotes})` : '')
  if (c.kind === 'removed') return `removed (was ${countText(c.beforeCount)})`
  const parts: string[] = []
  if (c.beforeCount !== c.afterCount) parts.push(`${countText(c.beforeCount)} → ${countText(c.afterCount)}`)
  if ((c.beforeNotes ?? '') !== (c.afterNotes ?? '')) parts.push(`notes: ${c.beforeNotes ?? '(none)'} → ${c.afterNotes ?? '(none)'}`)
  return parts.join('; ')
}

const KIND_STYLES: Record<GameTileChange['kind'], string> = {
  added: 'text-emerald-700',
  removed: 'text-rose-700',
  changed: 'text-violet-700',
}

// One saved change to a game's tile list on the History page (DESIGN.md section 7): teal panel, who and when, the reason, and each tile changed.
export default function GameChangeEntry({ change }: { change: GameChange }) {
  return (
    <li className="space-y-2 rounded-lg border border-l-4 border-l-teal-600 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-md bg-teal-600 px-2 py-0.5 text-xs font-semibold tracking-wide text-white uppercase">
          <LayoutGrid className="size-3.5" aria-hidden="true" />
          Game
        </span>
        <Link to={`/tiles?game=${change.gameId}`} className="font-medium underline">
          {change.gameTitle}
        </Link>
        <span className="text-muted-foreground">
          tile list changed by {change.changedByEmail ?? 'an unknown user'} on {when(change.changedUtc)}
        </span>
      </div>
      {change.reason && <p>Reason: {change.reason}</p>}
      <ul className="space-y-1">
        {change.changes.map((c) => (
          <li key={c.tileId} className="flex items-center gap-2">
            <TileSvg definitionCode={c.definitionCode} color={c.color} number={c.number} className="w-8 shrink-0" />
            <Link to={`/tiles/${c.tileId}`} className="font-medium hover:underline">
              {c.displayName}
            </Link>
            <span className={KIND_STYLES[c.kind]}>{describe(c)}</span>
          </li>
        ))}
      </ul>
    </li>
  )
}
