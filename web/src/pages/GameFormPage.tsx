import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Pencil, SquarePlus, Trash2 } from 'lucide-react'
import { createGame, deleteGame, updateGame } from '@/api/admin'
import { getGame } from '@/api/games'
import LoadingState from '@/components/LoadingState'
import PageHeader from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessages } from '@/lib/apiErrors'

// New game (/admin/games/new) and Edit game (/admin/games/:id/edit), admins only (DESIGN.md section 8): a game's title, designer, and publisher.
// - New: saving opens Edit game tiles for the new game, to add its tiles and counts.
// - Edit: saving returns to the game's tiles. Edited details are kept by later imports. Delete game (with confirmation) hides the game everywhere and
//   removes its tile links; the tiles stay, and the History page keeps what it had.
// Every add, edit, and delete is recorded on the History page.
export default function GameFormPage() {
  const navigate = useNavigate()
  const { id: idText } = useParams()
  const gameId = idText ? Number(idText) : null
  const editing = gameId !== null

  const [loaded, setLoaded] = useState(!editing)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [originalTitle, setOriginalTitle] = useState('')
  const [title, setTitle] = useState('')
  const [designer, setDesigner] = useState('')
  const [publisher, setPublisher] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteReason, setDeleteReason] = useState('')
  const [deleteErrors, setDeleteErrors] = useState<string[]>([])

  useEffect(() => {
    if (gameId === null) return
    let ignore = false
    getGame(gameId)
      .then((game) => {
        if (ignore) return
        setOriginalTitle(game.title)
        setTitle(game.title)
        setDesigner(game.designer ?? '')
        setPublisher(game.publisher ?? '')
        setLoaded(true)
      })
      .catch((err: unknown) => {
        if (!ignore) setLoadError(apiErrorMessages(err).join(' '))
      })
    return () => {
      ignore = true
    }
  }, [gameId])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErrors([])
    try {
      if (gameId === null) {
        const game = await createGame(title, designer, publisher)
        navigate(`/admin/games/${game.id}/tiles`)
      } else {
        await updateGame(gameId, title, designer, publisher, reason)
        navigate(`/tiles?game=${gameId}`)
      }
    } catch (err) {
      setErrors(apiErrorMessages(err))
      setBusy(false)
    }
  }

  const onDelete = async () => {
    setBusy(true)
    setDeleteErrors([])
    try {
      await deleteGame(gameId!, deleteReason)
      navigate('/')
    } catch (err) {
      setDeleteErrors(apiErrorMessages(err))
      setBusy(false)
    }
  }

  if (loadError) return <p className="text-destructive">Could not load the game. {loadError}</p>
  if (!loaded) return <LoadingState />

  const field = (id: string, label: string, value: string, set: (v: string) => void, hint: string, required = false) => (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Input id={id} value={value} required={required} maxLength={200} onChange={(e) => set(e.target.value)} />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  )

  return (
    <div className="max-w-xl space-y-6">
      <Button asChild variant="outline" size="sm">
        <Link to={editing ? `/tiles?game=${gameId}` : '/'}>
          <ArrowLeft aria-hidden="true" />
          {editing ? 'Back to the game' : 'Games'}
        </Link>
      </Button>
      <PageHeader
        icon={editing ? Pencil : SquarePlus}
        area="admin"
        title={editing ? `Edit game: ${originalTitle}` : 'New game'}
        description={
          editing
            ? "Change the game's title, designer, or publisher. Later data imports keep your changes. To change its tiles, use Edit this game's tiles."
            : 'Add a game that is not in the list. After saving, you pick its tiles and how many come in the box.'
        }
      />

      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
        {field('title', 'Title', title, setTitle, 'Must be different from every other game.', true)}
        {field('designer', 'Designer', designer, setDesigner, 'Optional. Several people: separate them with commas.')}
        {field('publisher', 'Publisher', publisher, setPublisher, 'Optional. Several publishers: separate them with commas.')}
        {editing && (
          <div className="space-y-1">
            <label htmlFor="reason" className="text-sm font-medium">
              Reason
            </label>
            <Textarea id="reason" rows={2} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} />
            <p className="text-xs text-muted-foreground">Optional. Shown on the History page.</p>
          </div>
        )}
        {errors.map((m) => (
          <p key={m} className="text-sm text-destructive">
            {m}
          </p>
        ))}
        <Button type="submit" disabled={busy || !title.trim()}>
          {busy ? 'Saving…' : editing ? 'Save changes' : 'Create and add tiles'}
        </Button>
      </form>

      {editing && (
        <section className="space-y-3 rounded-xl border border-destructive/40 p-5">
          <h2 className="flex items-center gap-2 font-semibold text-destructive">
            <Trash2 className="size-4" aria-hidden="true" />
            Delete game
          </h2>
          <p className="text-sm text-muted-foreground">
            The game disappears from the site and its tile list is cleared. The tiles themselves stay, and the History page keeps a record of what the game had.
            Data imports will not add it back.
          </p>
          {confirmDelete ? (
            <div className="space-y-2">
              <label htmlFor="delete-reason" className="text-sm font-medium">
                Reason (optional)
              </label>
              <Textarea id="delete-reason" rows={2} maxLength={1000} value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} />
              {deleteErrors.map((m) => (
                <p key={m} className="text-sm text-destructive">
                  {m}
                </p>
              ))}
              <div className="flex gap-2">
                <Button variant="destructive" disabled={busy} onClick={() => void onDelete()}>
                  Delete {originalTitle}
                </Button>
                <Button variant="outline" disabled={busy} onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 aria-hidden="true" />
              Delete game
            </Button>
          )}
        </section>
      )}
    </div>
  )
}
