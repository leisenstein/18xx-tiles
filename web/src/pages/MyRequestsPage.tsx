import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Inbox, SquarePlus } from 'lucide-react'
import { getMyChangeRequests } from '@/api/changeRequests'
import EmptyState from '@/components/EmptyState'
import LoadingState from '@/components/LoadingState'
import PageHeader from '@/components/PageHeader'
import StatusBadge from '@/components/StatusBadge'
import TileChange from '@/components/TileChange'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { apiErrorMessages } from '@/lib/apiErrors'
import type { ChangeRequest } from '@/types/changeRequest'

// The signed-in user's change requests and their status (/account/requests, DESIGN.md section 9.1). Newest first.
export default function MyRequestsPage() {
  const [requests, setRequests] = useState<ChangeRequest[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    getMyChangeRequests()
      .then((list) => {
        if (!ignore) setRequests(list)
      })
      .catch((err: unknown) => {
        if (!ignore) setError(apiErrorMessages(err).join(' '))
      })
    return () => {
      ignore = true
    }
  }, [])

  if (error) return <p className="text-destructive">Could not load your requests. {error}</p>
  if (!requests) return <LoadingState label="Loading…" />

  return (
    <div className="space-y-4">
      <PageHeader icon={Inbox} area="contribute" title="My requests" description="Tiles you proposed, and what the admins decided." />
      {requests.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No requests yet"
          description="Tiles you propose show up here with their status: waiting, approved, or rejected with the admin's note."
          action={
            <Button asChild size="sm">
              <Link to="/submit">
                <SquarePlus aria-hidden="true" />
                Propose a new tile
              </Link>
            </Button>
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Request</TableHead>
              <TableHead>Change</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((request) => (
              <TableRow key={request.id} className="align-top">
                <TableCell className="whitespace-normal">
                  <div className="font-medium">
                    #{request.id} {request.type}
                  </div>
                  <div className="text-xs text-muted-foreground">{new Date(request.submittedUtc).toLocaleString()}</div>
                  {request.reason && <div className="mt-1 max-w-48 text-xs">{request.reason}</div>}
                </TableCell>
                <TableCell className="whitespace-normal">
                  <TileChange request={request} />
                </TableCell>
                <TableCell className="whitespace-normal">
                  <StatusBadge status={request.status} />
                  {request.reviewedUtc && <div className="mt-1 text-xs text-muted-foreground">{new Date(request.reviewedUtc).toLocaleString()}</div>}
                  {request.reviewNote && <div className="mt-1 max-w-48 text-xs">{request.reviewNote}</div>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
