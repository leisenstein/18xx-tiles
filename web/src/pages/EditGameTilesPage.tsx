import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { getGameTiles, saveGameTiles } from '@/api/admin'
import { getTiles } from '@/api/tiles'
import TileSvg from '@/components/TileSvg'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessages } from '@/lib/apiErrors'
import { UNLIMITED_TILE_COUNT } from '@/lib/constants'
import type { GameTile, GameTiles } from '@/types/gameTiles'
import type { TileSummary } from '@/types/tile'

// One row being edited. count is the text typed ('' = unknown); unlimited overrides it. removed rows stay listed (crossed out) until saved, so a
// mistake can be undone; isNew marks tiles added on this page.
interface EditRow {
  tile: Pick<GameTile, 'tileId' | 'number' | 'color' | 'displayName' | 'definitionCode'>
  count: string
  unlimited: boolean
  notes: string
  removed: boolean
  isNew: boolean
}

const MAX_COUNT = 100
// Note the importer puts on counts read from 18xx.games (DataImporter.CountNote). Editing the count clears it, since the count is no longer imported.
const IMPORT_NOTE = 'Count from 18xx.games manifest'
const SEARCH_DELAY_MS = 300

const toRow = (t: GameTile): EditRow => ({
  tile: t,
  count: t.count === null || t.count === UNLIMITED_TILE_COUNT ? '' : String(t.count),
  unlimited: t.count === UNLIMITED_TILE_COUNT,
  notes: t.notes ?? '',
  removed: false,
  isNew: false,
})

// The count to save: 999 when unlimited, null when empty (unknown), the number when it is 1 to 100, or undefined when the text is not valid.
function countOf(row: EditRow): number | null | undefined {
  if (row.unlimited) return UNLIMITED_TILE_COUNT
  if (row.count.trim() === '') return null
  const n = Number(row.count)
  return Number.isInteger(n) && n >= 1 && n <= MAX_COUNT ? n : undefined
}

// Edit game tiles (/admin/games/:id/tiles, admins only, DESIGN.md section 8): every tile the game uses with its count and notes, in one list. Change
// counts, remove tiles, or add any existing tile, then save everything as one change (one entry on the History page). The API checks again.
export default function EditGameTilesPage() {
  const { id: idText } = useParams()
  const gameId = Number(idText)
  const [loaded, setLoaded] = useState<GameTiles | null>(null)
  const [rows, setRows] = useState<EditRow[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<{ q: string; tiles: TileSummary[] } | null>(null)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveErrors, setSaveErrors] = useState<string[]>([])
  const [savedAt, setSavedAt] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    getGameTiles(gameId)
      .then((data) => {
        if (ignore) return
        setLoaded(data)
        setRows(data.tiles.map(toRow))
      })
      .catch((err: unknown) => {
        if (!ignore) setLoadError(apiErrorMessages(err).join(' '))
      })
    return () => {
      ignore = true
    }
  }, [gameId])

  // Search all tiles by number, a moment after typing stops.
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

  if (loadError) return <p className="text-destructive">Could not load the game. {loadError}</p>
  if (!loaded) return <p className="text-muted-foreground">Loading…</p>

  const update = (tileId: number, change: Partial<EditRow>) => setRows(rows.map((r) => (r.tile.tileId === tileId ? { ...r, ...change } : r)))
  // Count edits: an imported count's note goes away while the count differs from the saved one, and comes back if it is set back.
  const updateCount = (row: EditRow, change: Partial<EditRow>) => {
    const next = { ...row, ...change }
    const saved = loaded.tiles.find((t) => t.tileId === row.tile.tileId)
    const importNote = saved?.notes === IMPORT_NOTE
    const sameAsSaved = saved !== undefined && countOf(next) === saved.count
    const notes = importNote && (row.notes === IMPORT_NOTE || row.notes === '') ? (sameAsSaved ? IMPORT_NOTE : '') : row.notes
    update(row.tile.tileId, { ...change, notes })
  }
  const inList = new Set(rows.map((r) => r.tile.tileId))
  const addTile = (t: TileSummary) => {
    setRows([...rows, { tile: { ...t, tileId: t.id }, count: '', unlimited: false, notes: '', removed: false, isNew: true }])
    setSearch('')
  }

  // What saving would change, compared with the list as loaded.
  const original = new Map(loaded.tiles.map((t) => [t.tileId, t]))
  const kept = rows.filter((r) => !r.removed)
  const added = kept.filter((r) => !original.has(r.tile.tileId)).length
  const removed = rows.filter((r) => r.removed && original.has(r.tile.tileId)).length
  const changed = kept.filter((r) => {
    const o = original.get(r.tile.tileId)
    return o && (o.count !== countOf(r) || (o.notes ?? '') !== r.notes.trim())
  }).length
  const invalid = kept.filter((r) => countOf(r) === undefined)
  const dirty = added + removed + changed > 0

  const save = async () => {
    setSaving(true)
    setSaveErrors([])
    try {
      const tiles = kept.map((r) => ({ tileId: r.tile.tileId, count: countOf(r) ?? null, notes: r.notes.trim() || null }))
      const saved = await saveGameTiles(gameId, tiles, reason.trim() || null)
      setLoaded(saved)
      setRows(saved.tiles.map(toRow))
      setReason('')
      setSavedAt(new Date().toLocaleTimeString())
    } catch (err) {
      setSaveErrors(apiErrorMessages(err))
    } finally {
      setSaving(false)
    }
  }

  const shownResults = results?.q === q ? results.tiles.filter((t) => !inList.has(t.id)) : []

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Button asChild size="sm" variant="ghost" className="-ml-2">
          <Link to={`/tiles?game=${gameId}`}>
            <ArrowLeft aria-hidden="true" />
            Back to {loaded.title} tiles
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">Edit game tiles: {loaded.title}</h1>
        <p className="text-sm text-muted-foreground">
          Every tile this game uses, with how many come in the box. Leave a count empty if it is unknown; check Unlimited for an unlimited supply. Changes are
          saved together as one entry on the History page.
        </p>
      </div>

      {/* Add a tile that is not in the game yet. */}
      <div className="max-w-md space-y-2">
        <Input placeholder="Add a tile: type its number, e.g. 57" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Find a tile to add" />
        {q && results?.q === q && (
          <ul className="divide-y rounded-lg border">
            {shownResults.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">No tiles to add for "{q}".</li>}
            {shownResults.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-3 py-1.5 text-sm">
                <TileSvg definitionCode={t.definitionCode} color={t.color} number={t.number} className="w-10 shrink-0" />
                <span className="flex-1">
                  {t.displayName} <span className="text-muted-foreground">· {t.color}</span>
                </span>
                <Button size="sm" variant="outline" onClick={() => addTile(t)}>
                  Add
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ul className="divide-y rounded-lg border">
        {rows.map((r) => {
          const bad = !r.removed && countOf(r) === undefined
          return (
            <li key={r.tile.tileId} className={`flex flex-wrap items-center gap-3 px-3 py-2 text-sm ${r.removed ? 'bg-muted/60' : ''}`}>
              <TileSvg
                definitionCode={r.tile.definitionCode}
                color={r.tile.color}
                number={r.tile.number}
                className={`w-12 shrink-0 ${r.removed ? 'opacity-40' : ''}`}
              />
              <span className={`w-40 min-w-0 ${r.removed ? 'text-muted-foreground line-through' : 'font-medium'}`}>
                <Link to={`/tiles/${r.tile.tileId}`} className="hover:underline">
                  {r.tile.displayName}
                </Link>
                {r.isNew && <span className="ml-2 rounded bg-emerald-100 px-1.5 text-xs text-emerald-900">new</span>}
              </span>
              <label className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Count</span>
                <Input
                  className={`w-16 ${bad ? 'border-destructive' : ''}`}
                  inputMode="numeric"
                  value={r.unlimited ? '' : r.count}
                  placeholder={r.unlimited ? '∞' : '?'}
                  disabled={r.unlimited || r.removed}
                  onChange={(e) => updateCount(r, { count: e.target.value })}
                  aria-label={`Count of ${r.tile.displayName}`}
                />
              </label>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={r.unlimited} disabled={r.removed} onChange={(e) => updateCount(r, { unlimited: e.target.checked })} />
                Unlimited
              </label>
              <Input
                className="min-w-40 flex-1"
                placeholder="Notes (optional)"
                value={r.notes}
                maxLength={500}
                disabled={r.removed}
                onChange={(e) => update(r.tile.tileId, { notes: e.target.value })}
                aria-label={`Notes for ${r.tile.displayName}`}
              />
              {r.isNew ? (
                <Button size="sm" variant="outline" onClick={() => setRows(rows.filter((x) => x.tile.tileId !== r.tile.tileId))}>
                  Remove
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => update(r.tile.tileId, { removed: !r.removed })}>
                  {r.removed ? 'Undo' : 'Remove'}
                </Button>
              )}
              {bad && <span className="w-full text-xs text-destructive">Count must be empty (unknown) or a whole number from 1 to {MAX_COUNT}.</span>}
            </li>
          )
        })}
        {rows.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">This game has no tiles yet. Add some above.</li>}
      </ul>

      {/* Save: a summary of what will change, an optional reason for the History page, and the result. */}
      <div className="max-w-xl space-y-2">
        <p className="text-sm">
          {dirty ? `${added} added, ${removed} removed, ${changed} changed.` : 'No changes yet.'} {kept.length} tiles in the game after saving.
        </p>
        <Textarea placeholder="Reason (optional), e.g. checked against the box" value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} />
        <div className="flex items-center gap-3">
          <Button disabled={!dirty || invalid.length > 0 || saving} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
          {savedAt && !dirty && <span className="text-sm text-emerald-700">Saved at {savedAt}.</span>}
        </div>
        {saveErrors.map((m) => (
          <p key={m} className="text-sm text-destructive">
            {m}
          </p>
        ))}
      </div>
    </div>
  )
}
