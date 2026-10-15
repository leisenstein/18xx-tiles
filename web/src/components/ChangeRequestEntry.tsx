import { Link } from 'react-router'
import ChangeTypeBadge from '@/components/ChangeTypeBadge'
import RequestChange from '@/components/RequestChange'
import StatusBadge from '@/components/StatusBadge'
import { typeAccent } from '@/lib/changeTypeStyles'
import { cn } from '@/lib/utils'
import type { ChangeRequest } from '@/types/changeRequest'

// Dates are stored in UTC; show them in the viewer's local time.
const when = (utc: string) => new Date(utc).toLocaleString()

interface ChangeRequestEntryProps {
  request: ChangeRequest
  showTile?: boolean // name and link the tile (the all-tiles History page); the tile page leaves it out because it is about one tile
}

// One change request in a history list (DESIGN.md section 7, audit trail): type, status, who submitted it and when, the reason, who reviewed it and their
// note, and before/after drawings (or the proposed game). Used by the tile page's History section and the admin History page.
export default function ChangeRequestEntry({ request, showTile = false }: ChangeRequestEntryProps) {
  // The tile's name now; for an Add that was never approved there is no tile yet, so use the proposed number.
  const tileLabel = request.tileDisplayName ?? (request.proposed ? `#${request.proposed.number}` : 'tile')
  // A game proposal names the game in GameProposalView instead.
  const showTileLabel = showTile && request.type !== 'AddGame'

  return (
    // A thick left border in the type's color (Add emerald, Edit violet, Delete rose, New game sky) makes the kind of change easy to spot when scanning the list.
    <li className={cn('space-y-2 rounded-lg border border-l-4 p-3 text-sm', typeAccent(request.type))}>
      <div className="flex flex-wrap items-center gap-2">
        <ChangeTypeBadge type={request.type} />
        <span className="font-medium">
          {showTileLabel &&
            (request.tileId ? (
              <Link to={`/tiles/${request.tileId}`} className="underline">
                {tileLabel}
              </Link>
            ) : (
              tileLabel
            ))}{' '}
          <span className="font-normal text-muted-foreground">request #{request.id}</span>
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
      <RequestChange request={request} />
    </li>
  )
}
