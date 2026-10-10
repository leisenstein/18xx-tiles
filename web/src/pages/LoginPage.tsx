import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { resendConfirmation, signIn } from '@/api/auth'
import { ApiError } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'

// Only follow returnTo when it is a path on this site ("/tiles"), never another site ("//evil.example" or "https://...").
function safeReturnTo(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/'
}

// A plain-language message for each way signing in can fail.
function signInErrorText(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 429) return 'Too many attempts. Wait a minute and try again.'
    if (err.status === 401 && err.problem?.detail === 'NotAllowed') return 'Confirm your email first, using the link in the confirmation email.'
    if (err.status === 401 && err.problem?.detail === 'LockedOut') return 'Too many failed sign-ins. Try again in 5 minutes.'
    if (err.status === 401) return 'Email or password is incorrect.'
  }
  return `Could not sign in. ${err instanceof Error ? err.message : String(err)}`
}

// Sign-in page (/login). After signing in, goes back to ?returnTo (set by pages that need a signed-in user) or the home page.
export default function LoginPage() {
  const { refresh } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notConfirmed, setNotConfirmed] = useState(false)
  const [resent, setResent] = useState(false)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault() // stop the browser's own form submit, which would reload the page
    setBusy(true)
    setError(null)
    try {
      await signIn(email, password)
      await refresh() // load the user, so the header shows them as signed in
      navigate(safeReturnTo(params.get('returnTo')), { replace: true })
    } catch (err) {
      setError(signInErrorText(err))
      setNotConfirmed(err instanceof ApiError && err.problem?.detail === 'NotAllowed')
    } finally {
      setBusy(false)
    }
  }

  const onResend = async () => {
    await resendConfirmation(email)
    setResent(true)
  }

  return (
    <div className="mx-auto max-w-sm space-y-4">
      <h1 className="text-2xl font-semibold">Sign in</h1>
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
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {notConfirmed &&
          (resent ? (
            <p className="text-sm text-muted-foreground">If the account exists, a new confirmation email is on its way.</p>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={onResend}>
              Resend confirmation email
            </Button>
          ))}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
      <p className="text-sm text-muted-foreground">
        No account yet?{' '}
        <Link to="/register" className="underline">
          Register
        </Link>
      </p>
    </div>
  )
}
