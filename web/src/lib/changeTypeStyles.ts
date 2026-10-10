import { Pencil, Plus, Trash2, type LucideIcon } from 'lucide-react'
import type { ChangeRequestType } from '@/types/changeRequest'

// Colors and icons for change request types: Add emerald, Edit violet, Delete rose (colors the status badges do not use).
// Kept out of ChangeTypeBadge.tsx because a component file should export only components (React Fast Refresh rule).
export const CHANGE_TYPE_STYLES: Record<ChangeRequestType, { badge: string; accent: string; icon: LucideIcon }> = {
  Add: { badge: 'bg-emerald-600 text-white', accent: 'border-l-emerald-600', icon: Plus },
  Edit: { badge: 'bg-violet-600 text-white', accent: 'border-l-violet-600', icon: Pencil },
  Delete: { badge: 'bg-rose-600 text-white', accent: 'border-l-rose-600', icon: Trash2 },
}

// The left-border color class for a history entry of this type.
export const typeAccent = (type: ChangeRequestType) => CHANGE_TYPE_STYLES[type].accent
