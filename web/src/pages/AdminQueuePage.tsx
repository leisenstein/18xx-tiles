import { useEffect, useState } from 'react'
import { pingAdmin } from '@/api/admin'

// Admin review queue (/admin/queue, DESIGN.md section 9.1). Placeholder until Phase 4, when it lists change requests to approve or reject.
// RequireRole in App.tsx keeps non-admins out; the ping below shows that the API also accepts this user as an admin.
export default function AdminQueuePage() {
  const [apiCheck, setApiCheck] = useState<string>('checking…')

  useEffect(() => {
    let ignore = false
    pingAdmin()
      .then((result) => {
        if (!ignore) setApiCheck(result.status === 'ok' ? 'admin access confirmed' : `unexpected answer: ${result.status}`)
      })
      .catch((err: unknown) => {
        if (!ignore) setApiCheck(err instanceof Error ? err.message : String(err))
      })
    return () => {
      ignore = true
    }
  }, [])

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Review queue</h1>
      <p className="text-muted-foreground">Change requests to approve or reject will appear here in Phase 4.</p>
      <p className="text-sm">API check: {apiCheck}</p>
    </div>
  )
}
