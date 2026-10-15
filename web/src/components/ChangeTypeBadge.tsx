import { CHANGE_TYPE_STYLES } from '@/lib/changeTypeStyles'
import { cn } from '@/lib/utils'
import type { ChangeRequestType } from '@/types/changeRequest'

// Solid colored label with an icon for a change request's type (Add, Edit, Delete, New game). Solid (white text) so it stands apart from the pale StatusBadge
// beside it. ChangeRequestEntry adds a left border in the same color (typeAccent in lib/changeTypeStyles.ts).
export default function ChangeTypeBadge({ type }: { type: ChangeRequestType }) {
  const { label, badge, icon: Icon } = CHANGE_TYPE_STYLES[type]
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold tracking-wide uppercase', badge)}>
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
    </span>
  )
}
