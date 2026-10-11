import { useState, type FormEvent } from 'react'
import { KeyRound, UserRound } from 'lucide-react'
import { changePassword } from '@/api/auth'
import PageHeader from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'
import { apiErrorMessages } from '@/lib/apiErrors'

// My account (/account, DESIGN.md section 9.1): the signed-in user's email and roles, and a form to change the password. Opened from the email in
// the header. Changing the password keeps this session signed in and signs out the account's other sessions within a minute.
export default function AccountPage() {
  const { user } = useAuth()
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [done, setDone] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setDone(false)
    if (password !== confirm) {
      setErrors(['The two new passwords do not match.'])
      return
    }
    setBusy(true)
    setErrors([])
    try {
      await changePassword(current, password)
      setDone(true)
      setCurrent('')
      setPassword('')
      setConfirm('')
    } catch (err) {
      setErrors(apiErrorMessages(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <PageHeader icon={UserRound} area="contribute" title="My account" description={user?.email} />
      {user && user.roles.length > 0 && <p className="text-sm text-muted-foreground">Roles: {user.roles.join(', ')}</p>}

      <section className="space-y-3 rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="flex items-center gap-2 font-semibold">
          <KeyRound className="size-4" aria-hidden="true" />
          Change password
        </h2>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="current" className="text-sm font-medium">
              Current password
            </label>
            <Input id="current" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label htmlFor="password" className="text-sm font-medium">
              New password
            </label>
            <Input id="password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            <p className="text-xs text-muted-foreground">At least 10 characters, with an uppercase letter, a lowercase letter, a digit, and a symbol.</p>
          </div>
          <div className="space-y-1">
            <label htmlFor="confirm" className="text-sm font-medium">
              New password again
            </label>
            <Input id="confirm" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          {errors.map((m) => (
            <p key={m} className="text-sm text-destructive">
              {m}
            </p>
          ))}
          {done && (
            <p className="text-sm text-green-700 dark:text-green-400">
              Your password has been changed. You stay signed in here; any other devices are signed out within a minute.
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Change password'}
          </Button>
        </form>
      </section>
    </div>
  )
}
