import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { resetPassword } from '@/api/auth'
import Logo from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiErrorMessages } from '@/lib/apiErrors'

// Reset password (/reset-password?email=...&code=..., DESIGN.md section 9.1): opened from the link in the password-reset email. The email and the
// one-time code come from the link; the user types the new password twice. The API checks the code and the password rules.
export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const email = params.get('email') ?? ''
  const code = params.get('code') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      setErrors(['The two passwords do not match.'])
      return
    }
    setBusy(true)
    setErrors([])
    try {
      await resetPassword(email, code, password)
      setDone(true)
    } catch (err) {
      // An expired or already used link comes back as "Invalid token"; say what to do about it.
      const messages = apiErrorMessages(err)
      setErrors(messages.some((m) => /token/i.test(m)) ? ['This link has expired or was already used. Ask for a new one.'] : messages)
    } finally {
      setBusy(false)
    }
  }

  const linkOk = email !== '' && code !== ''

  return (
    <div className="mx-auto max-w-sm space-y-4 rounded-xl border bg-card p-6 shadow-sm">
      <div className="space-y-2 text-center">
        <Logo className="mx-auto size-16" />
        <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
        {linkOk && <p className="text-sm text-muted-foreground">For {email}</p>}
      </div>
      {done ? (
        <div className="space-y-3 text-sm">
          <p>Your password has been changed.</p>
          <Button asChild className="w-full">
            <Link to="/login">Sign in</Link>
          </Button>
        </div>
      ) : !linkOk ? (
        <p className="text-sm">
          This page needs the link from the password-reset email.{' '}
          <Link to="/forgot-password" className="underline">
            Ask for a new link
          </Link>
          .
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="password" className="text-sm font-medium">
              New password
            </label>
            <Input id="password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
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
          {errors.some((m) => m.includes('expired')) && (
            <Link to="/forgot-password" className="block text-sm underline">
              Ask for a new link
            </Link>
          )}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Saving…' : 'Change password'}
          </Button>
        </form>
      )}
    </div>
  )
}
