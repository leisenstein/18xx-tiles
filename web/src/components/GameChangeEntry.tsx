import { LayoutGrid } from 'lucide-react'
import { Link } from 'react-router'
import TileSvg from '@/components/TileSvg'
import { countText } from '@/lib/tileCount'
import type { GameChange, GameDetails, GameTileChange } from '@/types/gameTiles'

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

const WHAT: Record<GameChange['kind'], string> = {
  tiles: 'tile list changed',
  created: 'game created',
  edited: 'game details changed',
  deleted: 'game deleted',
}

// The fields an edit changed: "Title: A → B", "Designer: (none) → C".
function detailChanges(before: GameDetails, after: GameDetails): string[] {
  const fields: [string, keyof GameDetails][] = [
    ['Title', 'title'],
    ['Designer', 'designer'],
    ['Publisher', 'publisher'],
  ]
  return fields
    .filter(([, key]) => (before[key] ?? '') !== (after[key] ?? ''))
    .map(([label, key]) => `${label}: ${before[key] ?? '(none)'} → ${after[key] ?? '(none)'}`)
}

// One change to a game on the History page (DESIGN.md section 7): teal panel, what happened, who and when, the reason, and the details: each tile
// added, removed, or changed; the fields an edit changed; or, for a deleted game, the tile links it had.
export default function GameChangeEntry({ change }: { change: GameChange }) {
  return (
    <li className="space-y-2 rounded-lg border border-l-4 border-l-teal-600 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-md bg-teal-600 px-2 py-0.5 text-xs font-semibold tracking-wide text-white uppercase">
          <LayoutGrid className="size-3.5" aria-hidden="true" />
          Game
        </span>
        {change.gameDeleted ? (
          <span className="font-medium">{change.gameTitle}</span>
        ) : (
          <Link to={`/tiles?game=${change.gameId}`} className="font-medium underline">
            {change.gameTitle}
          </Link>
        )}
        <span className="text-muted-foreground">
          {WHAT[change.kind]} by {change.changedByEmail ?? 'an unknown user'} on {when(change.changedUtc)}
        </span>
      </div>
      {change.reason && <p>Reason: {change.reason}</p>}
      {change.details && (
        <ul className="space-y-1 text-violet-700">
          {detailChanges(change.details.before, change.details.after).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      {change.kind === 'deleted' && change.changes.length > 0 && (
        <p className="text-muted-foreground">It had {change.changes.length} tiles; their links were removed:</p>
      )}
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
