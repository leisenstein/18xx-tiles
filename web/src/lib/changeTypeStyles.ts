import { LayoutGrid, Pencil, Plus, Trash2, type LucideIcon } from 'lucide-react'
import type { ChangeRequestType } from '@/types/changeRequest'

// Labels, colors, and icons for change request types: Add emerald, Edit violet, Delete rose, New game sky (colors the status badges do not use).
// Kept out of ChangeTypeBadge.tsx because a component file should export only components (React Fast Refresh rule).
export const CHANGE_TYPE_STYLES: Record<ChangeRequestType, { label: string; badge: string; accent: string; icon: LucideIcon }> = {
  Add: { label: 'Add', badge: 'bg-emerald-600 text-white', accent: 'border-l-emerald-600', icon: Plus },
  Edit: { label: 'Edit', badge: 'bg-violet-600 text-white', accent: 'border-l-violet-600', icon: Pencil },
  Delete: { label: 'Delete', badge: 'bg-rose-600 text-white', accent: 'border-l-rose-600', icon: Trash2 },
  AddGame: { label: 'New game', badge: 'bg-sky-600 text-white', accent: 'border-l-sky-600', icon: LayoutGrid },
}

// How a request names its type in text, e.g. "#12 New game".
export const typeLabel = (type: ChangeRequestType) => CHANGE_TYPE_STYLES[type].label

// The left-border color class for a history entry of this type.
export const typeAccent = (type: ChangeRequestType) => CHANGE_TYPE_STYLES[type].accent
