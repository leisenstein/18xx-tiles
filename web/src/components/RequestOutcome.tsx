import { Link } from 'react-router'
import type { ChangeRequest } from '@/types/changeRequest'

// What happened after submitting a change request. An admin's request is applied at once (Approved); a regular user's waits for review (Pending).
export default function RequestOutcome({ request }: { request: ChangeRequest }) {
  if (request.status === 'Approved') {
    return (
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Done</h2>
        <p>
          The change was applied, because you are an admin.{' '}
          {request.type !== 'Delete' && request.tileId !== null && (
            <Link to={`/tiles/${request.tileId}`} className="underline">
              View the tile
            </Link>
          )}
        </p>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold">Sent for review</h2>
      <p>
        An admin will review request #{request.id}. Follow it on{' '}
        <Link to="/account/requests" className="underline">
          My requests
        </Link>
        .
      </p>
    </div>
  )
}
