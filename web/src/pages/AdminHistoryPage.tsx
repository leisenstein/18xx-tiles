import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { getHistory } from '@/api/admin'
import ChangeRequestEntry from '@/components/ChangeRequestEntry'
import GameChangeEntry from '@/components/GameChangeEntry'
import ImportEntry from '@/components/ImportEntry'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { apiErrorMessages } from '@/lib/apiErrors'
import type { ChangeRequestStatus, ChangeRequestType } from '@/types/changeRequest'
import type { HistoryEntry } from '@/types/history'
import type { PagedResult } from '@/types/paged'

// 'Import' shows only data imports from tobymao/18xx; the others show only change requests of that type.
const TYPES: (ChangeRequestType | 'Import' | 'Game')[] = ['Add', 'Edit', 'Delete', 'Import', 'Game']
const STATUSES: ChangeRequestStatus[] = ['Pending', 'Approved', 'Rejected']
const PAGE_SIZE = 25

// Admin History page (/admin/history, DESIGN.md section 7, audit trail): every change request across all tiles and every data import (the first one
// and each later update from tobymao/18xx), newest first. Filters live in the URL (?type=Edit&status=Approved&q=57&page=2), so a view can be bookmarked.
// The search box matches the tile number or name, the submitter's or reviewer's email, or the start of an import's commit hash.
// Imports have no status, so choosing a status hides them.
export default function AdminHistoryPage() {
  const [params, setParams] = useSearchParams()
  const type = TYPES.find((t) => t === params.get('type')) ?? ''
  const status = STATUSES.find((s) => s === params.get('status')) ?? ''
  const q = params.get('q') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)

  // The search box text; sent only when the form is submitted, so typing does not reload on every keystroke.
  const [search, setSearch] = useState(q)
  // The last result, tagged with the filters it was loaded for.
  const key = JSON.stringify([type, status, q, page])
  const [data, setData] = useState<{ key: string; result: PagedResult<HistoryEntry> } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    getHistory({ type, status, q, page, pageSize: PAGE_SIZE })
      .then((result) => {
        if (ignore) return
        setData({ key: JSON.stringify([type, status, q, page]), result })
        setError(null)
      })
      .catch((err: unknown) => {
        if (!ignore) setError(apiErrorMessages(err).join(' '))
      })
    return () => {
      ignore = true
    }
  }, [type, status, q, page])

  // Set or clear one filter. Changing anything other than the page goes back to page 1.
  const setFilter = (name: 'type' | 'status' | 'q' | 'page', value: string) => {
    setParams((previous) => {
      const next = new URLSearchParams(previous)
      if (value === '') next.delete(name)
      else next.set(name, value)
      if (name !== 'page') next.delete('page')
      return next
    })
  }

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    setFilter('q', search.trim())
  }

  const goToPage = (n: number) => {
    setFilter('page', String(n))
    window.scrollTo({ top: 0 })
  }

  const result = data?.result
  const loading = data?.key !== key

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">History</h1>

      <div className="flex flex-wrap items-center gap-3">
        <NativeSelect aria-label="Type" value={type} onChange={(e) => setFilter('type', e.target.value)}>
          <NativeSelectOption value="">All types</NativeSelectOption>
          {TYPES.map((t) => (
            <NativeSelectOption key={t} value={t}>
              {t}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect aria-label="Status" value={status} onChange={(e) => setFilter('status', e.target.value)}>
          <NativeSelectOption value="">All statuses</NativeSelectOption>
          {STATUSES.map((s) => (
            <NativeSelectOption key={s} value={s}>
              {s}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <form onSubmit={onSearch} className="flex gap-2">
          <Input
            aria-label="Search"
            placeholder="Tile, email, game, or commit"
            value={search}
            maxLength={100}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56"
          />
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
      </div>

      {error && <p className="text-destructive">Could not load the history. {error}</p>}
      {!result && !error && <p className="text-muted-foreground">Loading history…</p>}

      {result && (
        // Dim the old results while new ones load, instead of blanking the page.
        <div className={loading ? 'opacity-50' : undefined}>
          <p className="mb-3 text-sm text-muted-foreground">
            {result.totalCount} {result.totalCount === 1 ? 'entry' : 'entries'}
          </p>

          {result.items.length === 0 ? (
            <p className="text-muted-foreground">No changes match these filters.</p>
          ) : (
            <ol className="space-y-3">
              {result.items.map((entry) =>
                entry.kind === 'import' ? (
                  <ImportEntry key={`import-${entry.import.id}`} run={entry.import} />
                ) : entry.kind === 'game' ? (
                  <GameChangeEntry key={`game-${entry.game.id}`} change={entry.game} />
                ) : (
                  <ChangeRequestEntry key={`change-${entry.change.id}`} request={entry.change} showTile />
                ),
              )}
            </ol>
          )}

          {result.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3 text-sm">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
                Previous
              </Button>
              <span>
                Page {result.page} of {result.totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= result.totalPages} onClick={() => goToPage(page + 1)}>
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
