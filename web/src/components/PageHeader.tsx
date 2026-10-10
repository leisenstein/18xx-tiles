import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// Which part of the site a page belongs to; it picks the soft color of the icon chip, so the color means something without shouting:
// browse = amber (games and tiles), contribute = emerald (things signed-in users do), admin = slate (admin tools).
export type PageArea = 'browse' | 'contribute' | 'admin'

const AREA_STYLES: Record<PageArea, string> = {
  browse: 'bg-amber-100 text-amber-800',
  contribute: 'bg-emerald-100 text-emerald-800',
  admin: 'bg-slate-200 text-slate-700',
}

interface PageHeaderProps {
  icon: LucideIcon
  title: ReactNode
  description?: ReactNode
  area?: PageArea
  actions?: ReactNode // buttons or controls shown on the right (below the title on phones)
}

// The top of every page: an icon chip, the title, a one-line description, and optional actions. One component, so all pages look alike.
export default function PageHeader({ icon: Icon, title, description, area = 'browse', actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', AREA_STYLES[area])}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
