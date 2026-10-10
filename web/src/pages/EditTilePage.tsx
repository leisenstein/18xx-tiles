import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { submitChangeRequest } from '@/api/changeRequests'
import { getGames } from '@/api/games'
import { getTile } from '@/api/tiles'
import RequestOutcome from '@/components/RequestOutcome'
import TileForm from '@/components/TileForm'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessages } from '@/lib/apiErrors'
import type { ChangeRequest, TileContent } from '@/types/changeRequest'
import type { GameSummary } from '@/types/game'
import type { TileDetail } from '@/types/tile'

// Edit or delete a tile (/tiles/:id/edit, DESIGN.md section 9.1). Admins only (RequireRole in App.tsx; the API also refuses everyone else).
// Changes apply at once and are recorded as change requests approved by the admin, so every change has an audit row.
export default function EditTilePage() {
  const { id: idText } = useParams()
  const id = Number(idText)
  const validId = Number.isInteger(id) && id > 0
  const navigate = useNavigate()

  const [data, setData] = useState<{ id: number; tile: TileDetail; games: GameSummary[] } | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [result, setResult] = useState<ChangeRequest | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [deleteReason, setDeleteReason] = useState('')
  const [deleteErrors, setDeleteErrors] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  // Load the tile and the game list together.
  useEffect(() => {
    if (!validId) return
    let ignore = false
    Promise.all([getTile(id), getGames()])
      .then(([tile, games]) => {
        if (!ignore) setData({ id, tile, games })
      })
      .catch((err: unknown) => {
        if (!ignore) setLoadError(apiErrorMessages(err).join(' '))
      })
    return () => {
      ignore = true
    }
  }, [id, validId])

  const onEdit = async (tile: TileContent, reason: string) => {
    setBusy(true)
    setErrors([])
    try {
      setResult(await submitChangeRequest({ type: 'Edit', tileId: id, tile, reason: reason || null }))
    } catch (err) {
      setErrors(apiErrorMessages(err))
    } finally {
      setBusy(false)
    }
  }

  const onDelete = async () => {
    if (!window.confirm('Delete this tile now? It will be hidden from the site but kept in the database.')) return
    setBusy(true)
    setDeleteErrors([])
    try {
      await submitChangeRequest({ type: 'Delete', tileId: id, reason: deleteReason.trim() || null })
      navigate('/tiles', { replace: true }) // the tile no longer exists on the site
    } catch (err) {
      setDeleteErrors(apiErrorMessages(err))
      setBusy(false)
    }
  }

  if (!validId) return <p>Tile not found.</p>
  if (loadError) return <p className="text-destructive">Could not load the tile. {loadError}</p>
  if (data?.id !== id) return <p className="text-muted-foreground">Loading…</p>

  const { tile, games } = data
  // The form starts with the tile as it is now, including its games and box counts.
  const initial: TileContent = {
    number: tile.number,
    color: tile.color,
    definitionCode: tile.definitionCode,
    games: tile.games.map((g) => ({ gameId: g.gameId, count: g.count, notes: g.notes, title: g.title })),
    // The part in parentheses of the display name, e.g. "1825" from "#10 (1825)"; none for a plain "#57".
    variantName: /^#.+ \((.+)\)$/.exec(tile.displayName)?.[1] ?? null,
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Edit {tile.displayName}</h1>
        <Link to={`/tiles/${tile.id}`} className="text-sm underline">
          Back to the tile
        </Link>
      </div>

      {result ? (
        <RequestOutcome request={result} />
      ) : (
        <>
          <section className="space-y-3">
            <TileForm initial={initial} tileId={tile.id} games={games} submitLabel="Save changes" busy={busy} errors={errors} onSubmit={onEdit} />
          </section>

          <section className="space-y-3 border-t pt-6">
            <h2 className="text-lg font-semibold">Delete</h2>
            <p className="text-sm text-muted-foreground">The tile is hidden from the site but kept in the database, so the change can be traced.</p>
            <Textarea
              aria-label="Reason for deleting"
              placeholder="Reason (optional)"
              rows={2}
              maxLength={1000}
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
            />
            {deleteErrors.length > 0 && <p className="text-sm text-destructive">{deleteErrors.join(' ')}</p>}
            <Button variant="destructive" disabled={busy} onClick={() => void onDelete()}>
              Delete tile
            </Button>
          </section>
        </>
      )}
    </div>
  )
}
