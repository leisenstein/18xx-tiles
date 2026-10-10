import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { submitChangeRequest } from '@/api/changeRequests'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessages } from '@/lib/apiErrors'

interface AdminTileActionsProps {
  tileId: number
  displayName: string
}

// "Edit tile" and "Delete tile" buttons on the tile page. Admins only: the tile page shows this only to admins, and the API refuses edits and deletes from
// anyone else. Deleting is a soft delete with an audit row (a change request recorded as Approved by the admin).
// "Delete tile" opens a confirmation panel on the page (with an optional reason) instead of the browser's prompt(): some browsers and embedded views
// block or auto-dismiss prompt(), which made the button silently do nothing.
export default function AdminTileActions({ tileId, displayName }: AdminTileActionsProps) {
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onDelete = async () => {
    setBusy(true)
    setError(null)
    try {
      await submitChangeRequest({ type: 'Delete', tileId, reason: reason.trim() || null })
      navigate('/tiles', { replace: true }) // the tile page would now show "not found"
    } catch (err) {
      setError(apiErrorMessages(err).join(' '))
      setBusy(false)
    }
  }

  const onCancel = () => {
    setConfirming(false)
    setReason('')
    setError(null)
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to={`/tiles/${tileId}/edit`}>
            <Pencil aria-hidden="true" />
            Edit tile
          </Link>
        </Button>
        <Button variant="destructive" size="sm" disabled={confirming} onClick={() => setConfirming(true)}>
          <Trash2 aria-hidden="true" />
          Delete tile
        </Button>
      </div>

      {confirming && (
        <div className="max-w-md space-y-2 rounded-lg border border-destructive/50 p-3 text-sm">
          <p>
            Delete <span className="font-medium">{displayName}</span>? It will be hidden from the site but kept in the database, with its history.
          </p>
          <Textarea aria-label="Reason" placeholder="Reason (optional)" value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} />
          <div className="flex gap-2">
            <Button variant="destructive" size="sm" disabled={busy} onClick={() => void onDelete()}>
              {busy ? 'Deleting…' : 'Delete'}
            </Button>
            <Button variant="outline" size="sm" disabled={busy} onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
