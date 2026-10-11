import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { forgotPassword } from '@/api/auth'
import Logo from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiErrorMessages } from '@/lib/apiErrors'

// Forgot password (/forgot-password, DESIGN.md section 9.1): asks for the email address, and the API emails a link to /reset-password. The answer is the
// same whether or not the account exists, so this page cannot be used to find out who has an account.
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await forgotPassword(email.trim())
      setSent(true)
    } catch (err) {
      setError(apiErrorMessages(err).join(' '))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-4 rounded-xl border bg-card p-6 shadow-sm">
      <div className="space-y-2 text-center">
        <Logo className="mx-auto size-16" />
        <h1 className="text-2xl font-semibold tracking-tight">Forgot your password?</h1>
        <p className="text-sm text-muted-foreground">Enter your email and we will send you a link to choose a new one.</p>
      </div>
      {sent ? (
        <div className="space-y-3 text-sm">
          <p>If an account exists for {email.trim()}, an email with a reset link is on its way. The link works once.</p>
          {import.meta.env.DEV && <p className="text-muted-foreground">Development: without an email provider, the link is in the API log.</p>}
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      )}
      <p className="text-sm text-muted-foreground">
        Remembered it?{' '}
        <Link to="/login" className="underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
