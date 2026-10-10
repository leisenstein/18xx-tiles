import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: ReactNode
  action?: ReactNode // for example a button that fixes the situation ("Clear filters", "Propose a new tile")
  compact?: boolean // smaller, for empty sections inside a page (for example a tile's history)
}

// What a page or list shows when there is nothing to show (DESIGN.md section 9.2): a muted icon, a short title, a hint about why or what to do,
// and an optional action. Dashed border, so it reads as "space for content" rather than an error.
export default function EmptyState({ icon: Icon, title, description, action, compact = false }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-center', compact ? 'px-4 py-5' : 'px-6 py-12')}>
      <span className={cn('flex items-center justify-center rounded-full bg-muted text-muted-foreground', compact ? 'size-9' : 'size-12')}>
        <Icon className={compact ? 'size-4' : 'size-6'} aria-hidden="true" />
      </span>
      <p className={cn('font-medium', compact && 'text-sm')}>{title}</p>
      {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
