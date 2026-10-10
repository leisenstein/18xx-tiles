import { useEffect, useState } from 'react'
import { History } from 'lucide-react'
import { getTileHistory } from '@/api/admin'
import ChangeRequestEntry from '@/components/ChangeRequestEntry'
import EmptyState from '@/components/EmptyState'
import LoadingState from '@/components/LoadingState'
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
  if (data?.tileId !== tileId) return <LoadingState label="Loading history…" />

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
        <EmptyState compact icon={History} title="No changes yet" description="Edits and deletions of this tile will be listed here." />
      ) : (
        <ol className="space-y-3">
          {history.requests.map((request) => (
            <ChangeRequestEntry key={request.id} request={request} />
          ))}
        </ol>
      )}
    </section>
  )
}
