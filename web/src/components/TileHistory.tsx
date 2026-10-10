import { useEffect, useState } from 'react'
import { getTileHistory } from '@/api/admin'
import StatusBadge from '@/components/StatusBadge'
import TileChange from '@/components/TileChange'
import { apiErrorMessages } from '@/lib/apiErrors'
import type { TileHistory as TileHistoryData } from '@/types/changeRequest'

// Dates are stored in UTC; show them in the viewer's local time.
const when = (utc: string) => new Date(utc).toLocaleString()

// History of one tile, for admins (DESIGN.md section 7, audit trail): who added it and when, its last change, and every change request about it, with
// before and after drawings. Shown on the tile page; the API refuses non-admins.
export default function TileHistory({ tileId }: { tileId: number }) {
  const [data, setData] = useState<{ tileId: number; history: TileHistoryData } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    getTileHistory(tileId)
      .then((history) => {
        if (!ignore) setData({ tileId, history })
      })
      .catch((err: unknown) => {
        if (!ignore) setError(apiErrorMessages(err).join(' '))
      })
    return () => {
      ignore = true
    }
  }, [tileId])

  if (error) return <p className="text-sm text-destructive">Could not load the history. {error}</p>
  if (data?.tileId !== tileId) return <p className="text-sm text-muted-foreground">Loading history…</p>

  const { history } = data
  const added =
    history.source === 'user'
      ? `Added by ${history.createdByEmail ?? 'an unknown user'} on ${when(history.createdUtc)}.`
      : `Imported from 18xx.games on ${when(history.createdUtc)}.`
  const changed = history.updatedUtc ? ` Last changed on ${when(history.updatedUtc)} by ${history.updatedByEmail ?? 'an unknown user'}.` : ''

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">History</h2>
      <p className="text-sm">
        {added}
        {changed}
      </p>
      {history.requests.length === 0 ? (
        <p className="text-sm text-muted-foreground">No change requests for this tile.</p>
      ) : (
        <ol className="space-y-3">
          {history.requests.map((request) => (
            <li key={request.id} className="space-y-2 rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">
                  #{request.id} {request.type}
                </span>
                <StatusBadge status={request.status} />
                <span className="text-muted-foreground">
                  submitted by {request.submittedByEmail ?? 'an unknown user'} on {when(request.submittedUtc)}
                </span>
              </div>
              {request.reason && <p>Reason: {request.reason}</p>}
              {request.reviewedUtc && (
                <p className="text-muted-foreground">
                  {request.status} by {request.reviewedByEmail ?? 'an unknown user'} on {when(request.reviewedUtc)}
                  {request.reviewNote && `: ${request.reviewNote}`}
                </p>
              )}
              <TileChange request={request} />
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
