import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Hexagon, LayoutGrid } from 'lucide-react'
import { submitChangeRequest } from '@/api/changeRequests'
import EmptyState from '@/components/EmptyState'
import PageHeader from '@/components/PageHeader'
import RequestOutcome from '@/components/RequestOutcome'
import TilePicker from '@/components/TilePicker'
import TileSvg from '@/components/TileSvg'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessages } from '@/lib/apiErrors'
import { MAX_TILE_COUNT, parseCount } from '@/lib/tileCount'
import type { ChangeRequest } from '@/types/changeRequest'
import type { TileSummary } from '@/types/tile'

// One tile in the proposed game. count is the text typed ('' = unknown); unlimited overrides it.
interface Row {
  tile: TileSummary
  count: string
  unlimited: boolean
  notes: string
}

// Propose a new game (/submit/game, DESIGN.md section 9.1), for any signed-in user: its title, designer, and publisher, and the existing tiles it uses
// with how many come in the box. It goes to the review queue as one request (type AddGame); an admin approves it to add the game, or rejects it with a
// note. An admin's own proposal is added at once. Tiles that are not on the site yet are proposed first on Submit a tile.
export default function ProposeGamePage() {
  const [title, setTitle] = useState('')
  const [designer, setDesigner] = useState('')
  const [publisher, setPublisher] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [result, setResult] = useState<ChangeRequest | null>(null)

  const update = (tileId: number, change: Partial<Row>) => setRows(rows.map((r) => (r.tile.id === tileId ? { ...r, ...change } : r)))
  const invalid = rows.some((r) => parseCount(r.count, r.unlimited) === undefined)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErrors([])
    try {
      const tiles = rows.map((r) => ({ tileId: r.tile.id, count: parseCount(r.count, r.unlimited) ?? null, notes: r.notes.trim() || null }))
      const game = { title, designer: designer || null, publisher: publisher || null, tiles }
      setResult(await submitChangeRequest({ type: 'AddGame', game, reason: reason.trim() || null }))
    } catch (err) {
      setErrors(apiErrorMessages(err))
    } finally {
      setBusy(false)
    }
  }

  const startOver = () => {
    setResult(null)
    setTitle('')
    setDesigner('')
    setPublisher('')
    setRows([])
    setReason('')
  }

  const field = (id: string, label: string, value: string, set: (v: string) => void, hint: string, required = false) => (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Input id={id} value={value} required={required} maxLength={200} onChange={(e) => set(e.target.value)} />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  )

  return (
    <div className="space-y-4">
      <PageHeader
        icon={LayoutGrid}
        area="contribute"
        title="Propose a new game"
        description="A game that is not on the site yet, and the tiles it uses. An admin reviews every proposal before it appears on the site."
      />
      {result ? (
        <div className="space-y-4">
          <RequestOutcome request={result} />
          <Button variant="outline" onClick={startOver}>
            Propose another game
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="max-w-xl space-y-4 rounded-xl border bg-card p-5 shadow-sm">
            {field('title', 'Title', title, setTitle, 'Must be different from every game on the site.', true)}
            {field('designer', 'Designer', designer, setDesigner, 'Optional. Several people: separate them with commas.')}
            {field('publisher', 'Publisher', publisher, setPublisher, 'Optional. Several publishers: separate them with commas.')}
          </div>

          <section className="space-y-3">
            <h2 className="font-semibold">Tiles</h2>
            <p className="text-sm text-muted-foreground">
              Add each tile the game uses, and how many come in the box. Leave a count empty if you do not know it; check Unlimited for an unlimited supply. A
              tile that is not on the site yet must be{' '}
              <Link to="/submit" className="underline">
                proposed as a tile
              </Link>{' '}
              first.
            </p>
            <TilePicker exclude={new Set(rows.map((r) => r.tile.id))} onAdd={(tile) => setRows([...rows, { tile, count: '', unlimited: false, notes: '' }])} />
            <ul className="divide-y rounded-lg border">
              {rows.map((r) => {
                const bad = parseCount(r.count, r.unlimited) === undefined
                return (
                  <li key={r.tile.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                    <TileSvg definitionCode={r.tile.definitionCode} color={r.tile.color} number={r.tile.number} className="w-12 shrink-0" />
                    <span className="w-40 min-w-0 font-medium">{r.tile.displayName}</span>
                    <label className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">Count</span>
                      <Input
                        className={`w-16 ${bad ? 'border-destructive' : ''}`}
                        inputMode="numeric"
                        value={r.unlimited ? '' : r.count}
                        placeholder={r.unlimited ? '∞' : '?'}
                        disabled={r.unlimited}
                        onChange={(e) => update(r.tile.id, { count: e.target.value })}
                        aria-label={`Count of ${r.tile.displayName}`}
                      />
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input type="checkbox" checked={r.unlimited} onChange={(e) => update(r.tile.id, { unlimited: e.target.checked })} />
                      Unlimited
                    </label>
                    <Input
                      className="min-w-40 flex-1"
                      placeholder="Notes (optional)"
                      value={r.notes}
                      maxLength={500}
                      onChange={(e) => update(r.tile.id, { notes: e.target.value })}
                      aria-label={`Notes for ${r.tile.displayName}`}
                    />
                    <Button type="button" size="sm" variant="outline" onClick={() => setRows(rows.filter((x) => x.tile.id !== r.tile.id))}>
                      Remove
                    </Button>
                    {bad && (
                      <span className="w-full text-xs text-destructive">Count must be empty (unknown) or a whole number from 1 to {MAX_TILE_COUNT}.</span>
                    )}
                  </li>
                )
              })}
              {rows.length === 0 && (
                <li className="p-3">
                  <EmptyState compact icon={Hexagon} title="No tiles yet" description="Add the game's tiles with the search box above." />
                </li>
              )}
            </ul>
          </section>

          <div className="max-w-xl space-y-2">
            <label htmlFor="reason" className="text-sm font-medium">
              Reason (shown to the reviewer)
            </label>
            <Textarea
              id="reason"
              rows={3}
              maxLength={1000}
              placeholder="Optional, e.g. where the tile list and counts come from"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            {errors.map((m) => (
              <p key={m} className="text-sm text-destructive">
                {m}
              </p>
            ))}
            <p className="text-sm text-muted-foreground">
              {rows.length} {rows.length === 1 ? 'tile' : 'tiles'} in the game.
            </p>
            <Button type="submit" disabled={busy || !title.trim() || rows.length === 0 || invalid}>
              {busy ? 'Submitting…' : 'Submit for review'}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
