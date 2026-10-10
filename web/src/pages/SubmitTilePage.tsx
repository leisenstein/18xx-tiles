import { useEffect, useState } from 'react'
import { submitChangeRequest } from '@/api/changeRequests'
import { getGames } from '@/api/games'
import RequestOutcome from '@/components/RequestOutcome'
import TileForm from '@/components/TileForm'
import { Button } from '@/components/ui/button'
import { apiErrorMessages } from '@/lib/apiErrors'
import type { ChangeRequest, TileContent } from '@/types/changeRequest'
import type { GameSummary } from '@/types/game'

const EMPTY_TILE: TileContent = { number: '', color: 'yellow', definitionCode: '', games: [] }

// Propose a new tile (/submit, DESIGN.md section 9.1), with a live drawing. Signed-in users only (RequireRole in App.tsx).
export default function SubmitTilePage() {
  const [games, setGames] = useState<GameSummary[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [result, setResult] = useState<ChangeRequest | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  // Changing the key gives TileForm a fresh, empty state for "Propose another tile".
  const [formKey, setFormKey] = useState(0)

  useEffect(() => {
    let ignore = false
    getGames()
      .then((list) => {
        if (!ignore) setGames(list)
      })
      .catch((err: unknown) => {
        if (!ignore) setLoadError(apiErrorMessages(err).join(' '))
      })
    return () => {
      ignore = true
    }
  }, [])

  const onSubmit = async (tile: TileContent, reason: string) => {
    setBusy(true)
    setErrors([])
    try {
      setResult(await submitChangeRequest({ type: 'Add', tile, reason: reason || null }))
    } catch (err) {
      setErrors(apiErrorMessages(err))
    } finally {
      setBusy(false)
    }
  }

  if (loadError) return <p className="text-destructive">Could not load games. {loadError}</p>
  if (!games) return <p className="text-muted-foreground">Loading…</p>

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Propose a new tile</h1>
      {result ? (
        <div className="space-y-4">
          <RequestOutcome request={result} />
          <Button
            variant="outline"
            onClick={() => {
              setResult(null)
              setFormKey(formKey + 1)
            }}
          >
            Propose another tile
          </Button>
        </div>
      ) : (
        <TileForm key={formKey} initial={EMPTY_TILE} games={games} submitLabel="Submit" busy={busy} errors={errors} onSubmit={onSubmit} />
      )}
    </div>
  )
}
