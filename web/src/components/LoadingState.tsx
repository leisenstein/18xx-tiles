import { LoaderCircle } from 'lucide-react'

// Shown while a page or section loads: a small spinning icon and a short label, so every page waits the same way.
export default function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground" role="status">
      <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      {label}
    </p>
  )
}
