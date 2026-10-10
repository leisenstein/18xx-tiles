import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { register } from '@/api/auth'
import { ApiError } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// The messages to show when registering fails. Identity explains rejected input in problem.errors (e.g. "Passwords must have at least one digit").
function registerErrorTexts(err: unknown): string[] {
  if (err instanceof ApiError) {
    if (err.status === 429) return ['Too many attempts. Wait a minute and try again.']
    const messages = Object.values(err.problem?.errors ?? {}).flat()
    if (err.status === 400 && messages.length > 0) return messages
  }
  return [`Could not register. ${err instanceof Error ? err.message : String(err)}`]
}

// Registration page (/register). On success the user must confirm their email before they can sign in (DESIGN.md section 4).
export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    // Check what the browser can check; the API enforces the password rules.
    if (password !== confirm) {
      setErrors(['The two passwords do not match.'])
      return
    }
    setBusy(true)
    setErrors([])
    try {
      await register(email, password)
      setDone(true)
    } catch (err) {
      setErrors(registerErrorTexts(err))
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-sm space-y-3">
        <h1 className="text-2xl font-semibold">Check your email</h1>
        <p>We sent a confirmation link to {email}. Open it, then sign in.</p>
        {import.meta.env.DEV && <p className="text-sm text-muted-foreground">Development: the email is written to the API log instead of being sent.</p>}
        <Link to="/login" className="underline">
          Go to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-sm space-y-4">
      <h1 className="text-2xl font-semibold">Register</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">At least 10 characters, with an uppercase letter, a lowercase letter, a digit, and a symbol.</p>
        </div>
        <div className="space-y-1">
          <label htmlFor="confirm" className="text-sm font-medium">
            Confirm password
          </label>
          <Input id="confirm" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        {errors.length > 0 && (
          <ul className="list-disc space-y-1 pl-5 text-sm text-destructive">
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
      <p className="text-sm text-muted-foreground">
        Already registered?{' '}
        <Link to="/login" className="underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
