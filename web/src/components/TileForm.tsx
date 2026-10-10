import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { checkNumber } from '@/api/changeRequests'
import DefinitionGuide from '@/components/DefinitionGuide'
import TileSvg from '@/components/TileSvg'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { UNLIMITED_TILE_COUNT } from '@/lib/constants'
import { TILE_COLORS } from '@/lib/tiles/colors'
import type { NumberCheck, TileContent, TileGameLink } from '@/types/changeRequest'
import type { GameSummary } from '@/types/game'

interface TileFormProps {
  initial: TileContent // starting values: empty for a new tile, the current tile for an edit
  tileId?: number // the tile being edited, so it does not count as "another tile with this number"
  games: GameSummary[] // every game, for the "used in" list
  submitLabel: string
  busy: boolean // true while the request is being sent
  errors: string[] // messages from the API to show above the button
  onSubmit: (tile: TileContent, reason: string) => void
}

// One row of the "used in" list while editing. Count is kept as text so the box can be empty (unknown) or half-typed.
interface GameRow {
  key: number // stable id for React's list rendering
  gameId: number
  count: string
  unlimited: boolean
  notes: string
}

const MAX_COUNT = 100 // same rule as the API's TileCounts.MaxCount
const NUMBER_CHECK_DELAY_MS = 400 // wait for a pause in typing before asking the API about the number

function toRows(links: TileGameLink[]): GameRow[] {
  return links.map((link, i) => ({
    key: i,
    gameId: link.gameId,
    count: link.count !== null && link.count !== UNLIMITED_TILE_COUNT ? String(link.count) : '',
    unlimited: link.count === UNLIMITED_TILE_COUNT,
    notes: link.notes ?? '',
  }))
}

// Form for proposing a new tile or changes to one (Submit and Edit pages): number, color, definition with a live drawing, the games that use it with
// box counts, and a reason. The API checks everything again; this form only catches obvious mistakes early.
// When the number is already used by other tiles (or pending requests), it lists them and lets you name your tile as a variant: "#57 (Kansas City)".
export default function TileForm({ initial, tileId, games, submitLabel, busy, errors, onSubmit }: TileFormProps) {
  const [number, setNumber] = useState(initial.number)
  const [color, setColor] = useState(initial.color || 'yellow')
  const [definition, setDefinition] = useState(initial.definitionCode)
  const [rows, setRows] = useState<GameRow[]>(() => toRows(initial.games ?? []))
  const [reason, setReason] = useState('')
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [nextKey, setNextKey] = useState(() => (initial.games?.length ?? 0) + 1)
  const [variantName, setVariantName] = useState(initial.variantName ?? '')
  const [check, setCheck] = useState<NumberCheck | null>(null)

  // Ask the API who else uses this number, after a short pause in typing (so it is not called on every keystroke).
  const trimmedNumber = number.trim()
  useEffect(() => {
    if (!trimmedNumber) return
    let ignore = false
    const timer = setTimeout(() => {
      checkNumber(trimmedNumber, tileId)
        .then((result) => {
          if (!ignore) setCheck(result)
        })
        .catch(() => {
          if (!ignore) setCheck(null) // the check is only a hint; the form still works without it
        })
    }, NUMBER_CHECK_DELAY_MS)
    return () => {
      ignore = true
      clearTimeout(timer)
    }
  }, [trimmedNumber, tileId])

  // Only use a check that matches what is typed now, and only when someone else uses the number.
  const currentCheck = check?.number === trimmedNumber ? check : null
  const numberInUse = currentCheck !== null && (currentCheck.tiles.length > 0 || currentCheck.pendingRequests.length > 0)
  const shownName = variantName.trim() ? `#${trimmedNumber} (${variantName.trim()})` : (currentCheck?.defaultDisplayName ?? `#${trimmedNumber}`)

  const usedIds = new Set(rows.map((r) => r.gameId))
  const updateRow = (key: number, change: Partial<GameRow>) => setRows(rows.map((r) => (r.key === key ? { ...r, ...change } : r)))

  // Add a row for the first game not yet in the list.
  const addRow = () => {
    const free = games.find((g) => !usedIds.has(g.id))
    if (!free) return
    setRows([...rows, { key: nextKey, gameId: free.id, count: '', unlimited: false, notes: '' }])
    setNextKey(nextKey + 1)
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const problems: string[] = []
    if (!number.trim()) problems.push('Enter the tile number.')
    const links: TileGameLink[] = rows.map((row) => {
      const title = games.find((g) => g.id === row.gameId)?.title ?? `game ${row.gameId}`
      let count: number | null = null
      if (row.unlimited) {
        count = UNLIMITED_TILE_COUNT
      } else if (row.count.trim()) {
        count = Number(row.count)
        if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) problems.push(`${title}: the count must be 1 to ${MAX_COUNT}, or empty if unknown.`)
      }
      return { gameId: row.gameId, count, notes: row.notes.trim() || null }
    })
    setFormErrors(problems)
    if (problems.length > 0) return
    // A variant name only matters when the number is shared; otherwise the tile is simply "#N".
    const variant = numberInUse ? variantName.trim() || null : null
    onSubmit({ number: number.trim(), color, definitionCode: definition.trim(), games: links, variantName: variant }, reason.trim())
  }

  const shownErrors = [...formErrors, ...errors]

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Fields on the left, live drawing on the right (stacked on phones). */}
      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex gap-3">
            <div className="space-y-1">
              <label htmlFor="tile-number" className="block text-sm font-medium">
                Number
              </label>
              <Input id="tile-number" required maxLength={20} className="w-32" value={number} onChange={(e) => setNumber(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label htmlFor="tile-color" className="block text-sm font-medium">
                Color
              </label>
              <NativeSelect id="tile-color" value={color} onChange={(e) => setColor(e.target.value)}>
                {TILE_COLORS.map((c) => (
                  <NativeSelectOption key={c} value={c}>
                    {c}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor="tile-definition" className="block text-sm font-medium">
              Definition
            </label>
            <Textarea
              id="tile-definition"
              rows={4}
              className="font-mono text-xs"
              placeholder="city=revenue:20;path=a:0,b:_0;path=a:_0,b:3"
              value={definition}
              onChange={(e) => setDefinition(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Uses the 18xx.games tile language: parts separated by ";", edges 0 (bottom) to 5, nodes referred to as _0, _1, ... See the guide below.
            </p>
          </div>
        </div>
        <div className="w-full max-w-56 shrink-0">
          <div className="text-sm font-medium">Preview</div>
          <TileSvg definitionCode={definition} color={color} number={number} className="w-full" />
        </div>
      </div>

      {numberInUse && currentCheck && (
        <section className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <p className="font-medium">Tile number {trimmedNumber} is already in use.</p>
          {currentCheck.tiles.length > 0 && (
            <ul className="flex flex-wrap gap-3">
              {currentCheck.tiles.map((other) => (
                <li key={other.id} className="w-24 text-center text-xs">
                  {/* Opens in a new tab so the form is not lost. */}
                  <Link to={`/tiles/${other.id}`} target="_blank" className="block hover:underline">
                    <TileSvg definitionCode={other.definitionCode} color={other.color} number={other.number} className="w-full" />
                    {other.displayName}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {currentCheck.pendingRequests.length > 0 && (
            <p>
              Also proposed in pending{' '}
              {currentCheck.pendingRequests.map((r) => `request #${r.id}${r.variantName ? ` (${r.variantName})` : ''}${r.isMine ? ', yours' : ''}`).join('; ')}.
            </p>
          )}
          <p>
            Your tile will be added as a <strong>variant</strong> of {trimmedNumber}. Change the number above if it is a different tile, or give the variant a
            name:
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              aria-label="Variant name"
              placeholder="e.g. Kansas City, or 1825"
              maxLength={40}
              className="w-64 bg-background"
              value={variantName}
              onChange={(e) => setVariantName(e.target.value)}
            />
            <span>
              Shown as <strong>{shownName}</strong>
            </span>
          </div>
        </section>
      )}

      <DefinitionGuide
        onUseExample={(code, exampleColor) => {
          setDefinition(code)
          setColor(exampleColor)
        }}
      />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Used in</legend>
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No games yet.</p>}
        {rows.map((row) => (
          <div key={row.key} className="flex flex-wrap items-center gap-2">
            <NativeSelect aria-label="Game" value={row.gameId} onChange={(e) => updateRow(row.key, { gameId: Number(e.target.value) })}>
              {games
                .filter((g) => g.id === row.gameId || !usedIds.has(g.id))
                .map((g) => (
                  <NativeSelectOption key={g.id} value={g.id}>
                    {g.title}
                  </NativeSelectOption>
                ))}
            </NativeSelect>
            <Input
              aria-label="Count in box"
              placeholder="count"
              inputMode="numeric"
              className="w-20"
              disabled={row.unlimited}
              value={row.unlimited ? '' : row.count}
              onChange={(e) => updateRow(row.key, { count: e.target.value })}
            />
            <label className="flex items-center gap-1 text-sm">
              <input type="checkbox" checked={row.unlimited} onChange={(e) => updateRow(row.key, { unlimited: e.target.checked })} />
              unlimited
            </label>
            <Input
              aria-label="Notes"
              placeholder="notes (e.g. other editions)"
              maxLength={500}
              className="w-64"
              value={row.notes}
              onChange={(e) => updateRow(row.key, { notes: e.target.value })}
            />
            <Button type="button" variant="ghost" size="sm" onClick={() => setRows(rows.filter((r) => r.key !== row.key))}>
              Remove
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={usedIds.size >= games.length}>
          Add a game
        </Button>
        <p className="text-xs text-muted-foreground">Leave the count empty if you do not know how many come in the box.</p>
      </fieldset>

      <div className="space-y-1">
        <label htmlFor="tile-reason" className="block text-sm font-medium">
          Reason (shown to the reviewer)
        </label>
        <Textarea id="tile-reason" rows={2} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>

      {shownErrors.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-destructive">
          {shownErrors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? 'Sending…' : submitLabel}
      </Button>
    </form>
  )
}
