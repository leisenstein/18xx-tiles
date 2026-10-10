import { cn } from '@/lib/utils'
import type { ChangeRequestStatus } from '@/types/changeRequest'

// Colored label for a change request's status: Pending amber, Approved green, Rejected red.
const styles: Record<ChangeRequestStatus, string> = {
  Pending: 'bg-amber-100 text-amber-900',
  Approved: 'bg-green-100 text-green-900',
  Rejected: 'bg-red-100 text-red-900',
}

export default function StatusBadge({ status }: { status: ChangeRequestStatus }) {
  return <span className={cn('rounded-md px-2 py-0.5 text-xs font-medium', styles[status])}>{status}</span>
}
