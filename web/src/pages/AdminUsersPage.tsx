import { useEffect, useState, type FormEvent } from 'react'
import { KeyRound, MailCheck, ShieldMinus, ShieldPlus, Trash2, UserCheck, UserX, Users } from 'lucide-react'
import { addUserRole, confirmUserEmail, deleteUser, disableUser, enableUser, getRoles, getUsers, removeUserRole, sendUserPasswordReset } from '@/api/admin'
import EmptyState from '@/components/EmptyState'
import LoadingState from '@/components/LoadingState'
import PageHeader from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { apiErrorMessages } from '@/lib/apiErrors'
import { cn } from '@/lib/utils'
import type { AdminUser } from '@/types/adminUser'

// Dates are stored in UTC; show them in the viewer's local time.
const when = (utc: string) => new Date(utc).toLocaleString()

// Small colored labels: roles slate, account states by meaning (green fine, amber needs attention, red blocked).
function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={cn('rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap', className)}>{children}</span>
}

function StatusBadges({ user }: { user: AdminUser }) {
  return (
    <div className="flex flex-wrap gap-1">
      {user.status === 'Active' && <Badge className="bg-green-100 text-green-900">Active</Badge>}
      {user.status === 'Disabled' && <Badge className="bg-red-100 text-red-900">Disabled</Badge>}
      {user.status === 'Locked' && (
        <Badge className="bg-amber-100 text-amber-900">Locked until {user.lockoutEndUtc ? when(user.lockoutEndUtc) : 'later'}</Badge>
      )}
      {!user.emailConfirmed && <Badge className="bg-amber-100 text-amber-900">Email not confirmed</Badge>}
    </div>
  )
}

// Admin Users page (/admin/users, DESIGN.md section 9.1): every account, with roles and state, and the actions UsersController allows.
// Your own account and the configured admin (Admin:Email) cannot lose the Admin role, be disabled, or be deleted; their buttons are off, and the API
// refuses anyway. Changes reach people who are signed in within a minute.
export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [roles, setRoles] = useState<string[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('') // the search that was submitted
  const [busyId, setBusyId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Record<string, { text: string; error: boolean }>>({}) // per account, under its row
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    Promise.all([getUsers(query), getRoles()])
      .then(([u, r]) => {
        if (!ignore) {
          setUsers(u)
          setRoles(r)
        }
      })
      .catch((err: unknown) => {
        if (!ignore) setLoadError(apiErrorMessages(err).join(' '))
      })
    return () => {
      ignore = true
    }
  }, [query])

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    setQuery(search.trim())
  }

  // Run one action for one account. An action that returns the account replaces its row; delete removes the row.
  const run = async (user: AdminUser, action: () => Promise<AdminUser | void>, done: string) => {
    setBusyId(user.id)
    setMessages((m) => ({ ...m, [user.id]: { text: '', error: false } }))
    try {
      const updated = await action()
      setUsers((list) => (list ?? []).flatMap((u) => (u.id !== user.id ? [u] : updated ? [updated] : [])))
      setMessages((m) => ({ ...m, [user.id]: { text: done, error: false } }))
    } catch (err) {
      setMessages((m) => ({ ...m, [user.id]: { text: apiErrorMessages(err).join(' '), error: true } }))
    } finally {
      setBusyId(null)
      setConfirmDeleteId(null)
    }
  }

  if (loadError) return <p className="text-destructive">{loadError}</p>
  if (users === null) return <LoadingState />

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Users}
        area="admin"
        title="Users"
        description="Everyone with an account: give or take the Admin role, confirm emails, send password resets, disable, or delete."
        actions={
          <form onSubmit={onSearch} className="flex gap-2">
            <Input aria-label="Search by email" placeholder="Search by email" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Button type="submit" variant="outline">
              Search
            </Button>
          </form>
        }
      />
      <p className="text-sm text-muted-foreground">
        People create their own accounts with Register. Changes reach anyone signed in within a minute. Your own account and the admin in the Admin:Email
        setting cannot be disabled, deleted, or lose the Admin role.
      </p>

      {users.length === 0 ? (
        <EmptyState icon={Users} title="No accounts found" description={query ? `No email contains "${query}".` : 'Nobody has registered yet.'} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>State</TableHead>
              <TableHead className="text-right">Requests</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const locked = user.isYou || user.isConfiguredAdmin // protected from changes that could lock an admin out
              const why = user.isYou ? 'This is your account.' : user.isConfiguredAdmin ? 'This is the admin in the Admin:Email setting.' : undefined
              const busy = busyId === user.id
              const message = messages[user.id]
              return (
                <TableRow key={user.id} className="align-top">
                  <TableCell className="whitespace-normal">
                    <div className="font-medium break-all">{user.email}</div>
                    <div className="flex flex-wrap gap-1 pt-1 text-xs text-muted-foreground">
                      {user.isYou && <span>You</span>}
                      {user.isConfiguredAdmin && <span>{user.isYou ? '· ' : ''}Configured admin</span>}
                    </div>
                    {message?.text && (
                      <p className={cn('pt-1 text-xs', message.error ? 'text-destructive' : 'text-green-700 dark:text-green-400')}>{message.text}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.roles.length === 0 ? (
                        <span className="text-xs text-muted-foreground">None</span>
                      ) : (
                        user.roles.map((role) => (
                          <Badge key={role} className="bg-slate-200 text-slate-800">
                            {role}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <StatusBadges user={user} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{user.requestCount}</TableCell>
                  <TableCell className="whitespace-normal">
                    {confirmDeleteId === user.id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs">Delete this account? Its requests and history stay. This cannot be undone.</span>
                        <Button size="sm" variant="destructive" disabled={busy} onClick={() => void run(user, () => deleteUser(user.id), 'Deleted.')}>
                          Delete
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setConfirmDeleteId(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {roles.map((role) =>
                          user.roles.includes(role) ? (
                            <Button
                              key={role}
                              size="sm"
                              variant="outline"
                              disabled={busy || locked}
                              title={locked ? why : undefined}
                              onClick={() => void run(user, () => removeUserRole(user.id, role), `${role} role removed.`)}
                            >
                              <ShieldMinus aria-hidden="true" />
                              Remove {role}
                            </Button>
                          ) : (
                            <Button
                              key={role}
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => void run(user, () => addUserRole(user.id, role), `${role} role given.`)}
                            >
                              <ShieldPlus aria-hidden="true" />
                              Make {role}
                            </Button>
                          ),
                        )}
                        {!user.emailConfirmed && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void run(user, () => confirmUserEmail(user.id), 'Email confirmed.')}
                          >
                            <MailCheck aria-hidden="true" />
                            Confirm email
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            void run(
                              user,
                              async () => {
                                await sendUserPasswordReset(user.id)
                                return user
                              },
                              'Password reset email sent.',
                            )
                          }
                        >
                          <KeyRound aria-hidden="true" />
                          Send password reset
                        </Button>
                        {user.status === 'Active' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy || locked}
                            title={locked ? why : undefined}
                            onClick={() => void run(user, () => disableUser(user.id), 'Disabled. They are signed out within a minute.')}
                          >
                            <UserX aria-hidden="true" />
                            Disable
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(user, () => enableUser(user.id), 'Enabled.')}>
                            <UserCheck aria-hidden="true" />
                            Enable
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={busy || locked}
                          title={locked ? why : undefined}
                          onClick={() => setConfirmDeleteId(user.id)}
                        >
                          <Trash2 aria-hidden="true" />
                          Delete
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
