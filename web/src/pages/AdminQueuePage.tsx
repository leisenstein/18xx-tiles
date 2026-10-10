import { useEffect, useState } from 'react'
import { CheckCheck, ClipboardCheck, Inbox } from 'lucide-react'
import { approveChangeRequest, getChangeRequests, rejectChangeRequest } from '@/api/admin'
import EmptyState from '@/components/EmptyState'
import LoadingState from '@/components/LoadingState'
import PageHeader from '@/components/PageHeader'
import StatusBadge from '@/components/StatusBadge'
import TileChange from '@/components/TileChange'
import { Button } from '@/components/ui/button'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessages } from '@/lib/apiErrors'
import type { ChangeRequest, ChangeRequestStatus } from '@/types/changeRequest'

const STATUSES: ChangeRequestStatus[] = ['Pending', 'Approved', 'Rejected']

// Admin review queue (/admin/queue, DESIGN.md section 9.1): change requests with before/after drawings; approve or reject Pending ones.
// RequireRole in App.tsx keeps non-admins out, and the API checks the Admin role again on every call.
export default function AdminQueuePage() {
  const [status, setStatus] = useState<ChangeRequestStatus>('Pending')
  const [data, setData] = useState<{ status: ChangeRequestStatus; requests: ChangeRequest[] } | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadCount, setReloadCount] = useState(0) // bumped after each approve/reject to load the list again
  const [notes, setNotes] = useState<Record<number, string>>({}) // reject note per request
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({})
  const [busyId, setBusyId] = useState<number | null>(null)

  useEffect(() => {
    let ignore = false
    getChangeRequests(status)
      .then((requests) => {
        if (!ignore) setData({ status, requests })
      })
      .catch((err: unknown) => {
        if (!ignore) setLoadError(apiErrorMessages(err).join(' '))
      })
    return () => {
      ignore = true
    }
  }, [status, reloadCount])

  // Run approve or reject for one request; on success reload the list, on failure show the API's message on that row.
  const review = async (id: number, action: () => Promise<unknown>) => {
    setBusyId(id)
    setRowErrors({ ...rowErrors, [id]: '' })
    try {
      await action()
      setReloadCount(reloadCount + 1)
    } catch (err) {
      setRowErrors({ ...rowErrors, [id]: apiErrorMessages(err).join(' ') })
    } finally {
      setBusyId(null)
    }
  }

  const onReject = (id: number) => {
    const note = (notes[id] ?? '').trim()
    if (!note) {
      setRowErrors({ ...rowErrors, [id]: 'Write a note so the submitter knows why.' })
      return
    }
    void review(id, () => rejectChangeRequest(id, note))
  }

  return (
    <div className="space-y-4">
      <PageHeader
        icon={ClipboardCheck}
        area="admin"
        title="Review queue"
        description="Proposed tiles waiting for a decision. Approve to publish, or reject with a note for the submitter."
        actions={
          <NativeSelect aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as ChangeRequestStatus)}>
            {STATUSES.map((s) => (
              <NativeSelectOption key={s} value={s}>
                {s}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        }
      />

      {loadError && <p className="text-destructive">Could not load requests. {loadError}</p>}
      {!data && !loadError && <LoadingState label="Loading…" />}
      {data &&
        data.requests.length === 0 &&
        (data.status === 'Pending' ? (
          <EmptyState icon={CheckCheck} title="All caught up" description="No proposals are waiting for review." />
        ) : (
          <EmptyState icon={Inbox} title={`No ${data.status.toLowerCase()} requests`} description="Requests appear here once they are reviewed." />
        ))}

      {data && data.requests.length > 0 && (
        <Table className={data.status !== status ? 'opacity-50' : undefined}>
          <TableHeader>
            <TableRow>
              <TableHead>Request</TableHead>
              <TableHead>Change</TableHead>
              <TableHead>{data.status === 'Pending' ? 'Decision' : 'Result'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.requests.map((request) => (
              <TableRow key={request.id} className="align-top">
                <TableCell className="whitespace-normal">
                  <div className="font-medium">
                    #{request.id} {request.type} {request.tileDisplayName && <span className="text-muted-foreground">{request.tileDisplayName}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">{request.submittedByEmail}</div>
                  <div className="text-xs text-muted-foreground">{new Date(request.submittedUtc).toLocaleString()}</div>
                  {request.reason && <div className="mt-1 max-w-56 text-xs">{request.reason}</div>}
                </TableCell>
                <TableCell className="whitespace-normal">
                  <TileChange request={request} />
                </TableCell>
                <TableCell className="whitespace-normal">
                  {request.status === 'Pending' ? (
                    <div className="w-56 space-y-2">
                      <Button
                        size="sm"
                        className="w-full"
                        disabled={busyId !== null}
                        onClick={() => void review(request.id, () => approveChangeRequest(request.id))}
                      >
                        Approve
                      </Button>
                      <Textarea
                        aria-label="Reason for rejecting"
                        placeholder="Reason for rejecting"
                        rows={2}
                        maxLength={1000}
                        value={notes[request.id] ?? ''}
                        onChange={(e) => setNotes({ ...notes, [request.id]: e.target.value })}
                      />
                      <Button size="sm" variant="outline" className="w-full" disabled={busyId !== null} onClick={() => onReject(request.id)}>
                        Reject
                      </Button>
                      {rowErrors[request.id] && <p className="text-xs text-destructive">{rowErrors[request.id]}</p>}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <StatusBadge status={request.status} />
                      <div className="text-xs text-muted-foreground">{request.reviewedByEmail}</div>
                      {request.reviewedUtc && <div className="text-xs text-muted-foreground">{new Date(request.reviewedUtc).toLocaleString()}</div>}
                      {request.reviewNote && <div className="max-w-56 text-xs">{request.reviewNote}</div>}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
