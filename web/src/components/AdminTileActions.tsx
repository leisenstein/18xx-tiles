import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { submitChangeRequest } from '@/api/changeRequests'
import { Button } from '@/components/ui/button'
import { apiErrorMessages } from '@/lib/apiErrors'

interface AdminTileActionsProps {
  tileId: number
  displayName: string
}

// "Edit tile" and "Delete tile" buttons on the tile page. Admins only: the tile page shows this only to admins, and the API refuses edits and deletes from
// anyone else. Deleting is a soft delete with an audit row (a change request recorded as Approved by the admin).
export default function AdminTileActions({ tileId, displayName }: AdminTileActionsProps) {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onDelete = async () => {
    // The prompt asks for an optional reason; Cancel (null) stops the deletion.
    const reason = window.prompt(`Delete ${displayName}? It will be hidden from the site but kept in the database.\n\nReason (optional):`, '')
    if (reason === null) return
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

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to={`/tiles/${tileId}/edit`}>Edit tile</Link>
        </Button>
        <Button variant="destructive" size="sm" disabled={busy} onClick={() => void onDelete()}>
          {busy ? 'Deleting…' : 'Delete tile'}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
