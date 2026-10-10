import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Printer } from 'lucide-react'
import { ApiError } from '@/api/client'
import { getTile } from '@/api/tiles'
import AdminTileActions from '@/components/AdminTileActions'
import LoadingState from '@/components/LoadingState'
import TileCard from '@/components/TileCard'
import TileHistory from '@/components/TileHistory'
import TileSvg from '@/components/TileSvg'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { ADMIN_ROLE } from '@/lib/constants'
import { countText } from '@/lib/tileCount'
import type { TileDetail } from '@/types/tile'

// Tile detail page (/tiles/:id, DESIGN.md section 9.1): large drawing, number, color,
// definition string, the games that use the tile, and other versions of the same number.
export default function TileDetailPage() {
  // The id from the URL. Anything that is not a whole number above 0 counts as "not found".
  const { id: idText } = useParams()
  const id = Number(idText)
  const validId = Number.isInteger(id) && id > 0
  const { user } = useAuth()
  const isAdmin = user?.roles.includes(ADMIN_ROLE) ?? false

  // The loaded tile, tagged with its id so a stale tile is never shown for a new URL.
  const [data, setData] = useState<{ id: number; tile: TileDetail } | null>(null)
  const [notFound, setNotFound] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!validId) return
    let ignore = false
    getTile(id)
      .then((tile) => {
        if (ignore) return
        setData({ id, tile })
        setError(null)
      })
      .catch((err: unknown) => {
        if (ignore) return
        if (err instanceof ApiError && err.status === 404) setNotFound(id)
        else setError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      ignore = true
    }
  }, [id, validId])

  if (!validId || notFound === id) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Tile not found</h1>
        <Link to="/tiles" className="text-sm underline">
          Browse all tiles
        </Link>
      </div>
    )
  }
  if (error) {
    return <p className="text-destructive">Could not load the tile. {error}</p>
  }
  if (data?.id !== id) {
    return <LoadingState label="Loading tile…" />
  }

  const tile = data.tile

  return (
    <div className="space-y-8">
      {/* Drawing beside the facts on wide screens; stacked on phones. */}
      <div className="flex flex-col gap-6 sm:flex-row">
        <TileSvg definitionCode={tile.definitionCode} color={tile.color} number={tile.number} className="w-full max-w-80 shrink-0" />
        <div className="min-w-0 space-y-3">
          <h1 className="text-2xl font-semibold">{tile.displayName}</h1>
          {/* Actions: print this tile's number circle (signed-in users, DESIGN.md 9.4); edit or delete it (admins only; everyone else can propose new
              tiles from "Submit a tile"). */}
          {user && (
            <div className="flex flex-wrap items-start gap-2">
              <Button asChild size="sm">
                <Link to={`/print/circles?tile=${tile.id}`}>
                  <Printer aria-hidden="true" />
                  Print number circle
                </Link>
              </Button>
              {isAdmin && <AdminTileActions tileId={tile.id} displayName={tile.displayName} />}
            </div>
          )}
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Number</dt>
            <dd>{tile.number}</dd>
            <dt className="text-muted-foreground">Color</dt>
            <dd>{tile.color}</dd>
            <dt className="text-muted-foreground">Has</dt>
            <dd>{[tile.hasCity && 'city', tile.hasTown && 'town'].filter(Boolean).join(', ') || 'no city or town'}</dd>
            <dt className="text-muted-foreground">Source</dt>
            <dd>{tile.source}</dd>
          </dl>
          <div>
            <div className="text-sm text-muted-foreground">Definition</div>
            {/* break-all: definitions are long strings without spaces. */}
            <code className="block rounded-md bg-muted p-2 text-xs break-all">{tile.definitionCode || '(empty)'}</code>
          </div>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">
          Used in {tile.games.length} {tile.games.length === 1 ? 'game' : 'games'}
        </h2>
        {tile.games.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No game uses this exact version.
            {tile.otherVersions.length > 0 && ' See the other versions below.'}
          </p>
        ) : (
          <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {tile.games.map((game) => (
              <li key={game.gameId}>
                <Link to={`/tiles?game=${game.gameId}`} className="underline">
                  {game.title}
                </Link>{' '}
                <span className="text-muted-foreground">
                  · {countText(game.count)}
                  {game.notes && ` · ${game.notes}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {tile.otherVersions.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Other versions of #{tile.number}</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {tile.otherVersions.map((other) => (
              <li key={other.id}>
                <TileCard tile={other} showCountInGame={false} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Audit trail: who added and changed this tile, for admins. */}
      {isAdmin && <TileHistory tileId={tile.id} />}
    </div>
  )
}
