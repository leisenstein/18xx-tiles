import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { getImports } from '@/api/admin'
import EmptyState from '@/components/EmptyState'
import LoadingState from '@/components/LoadingState'
import PageHeader from '@/components/PageHeader'
import { apiErrorMessages } from '@/lib/apiErrors'
import type { ImportNote, ImportRun } from '@/types/importRun'

// Dates are stored in UTC; show them in the viewer's local time.
const when = (utc: string) => new Date(utc).toLocaleString()

// Headings for each kind of note, in the order they are shown. Kinds not listed here (added to the API later) go last, under their code.
const NOTE_GROUPS: Record<string, string> = {
  'definition-changed': 'Tile changed upstream (not applied)',
  'generic-changed': 'Generic tile changed upstream (not applied)',
  'count-differs': 'Count differs from upstream (app count kept)',
  'deleted-in-app': 'Deleted in the app (not added back)',
  'not-upstream': 'In the app but not upstream (kept)',
  'game-not-upstream': 'Game no longer upstream (kept)',
  'game-not-renamed': 'Game not renamed',
  'game-renamed': 'Game renamed',
  'game-details': 'Designers and publishers updated',
}

// Notes grouped by kind, in NOTE_GROUPS order.
function groupNotes(notes: ImportNote[]): [string, string[]][] {
  const groups = new Map<string, string[]>()
  for (const note of notes) groups.set(note.kind, [...(groups.get(note.kind) ?? []), note.message])
  const order = Object.keys(NOTE_GROUPS)
  const rank = (kind: string) => (order.includes(kind) ? order.indexOf(kind) : order.length)
  return [...groups.entries()].sort((a, b) => rank(a[0]) - rank(b[0]))
}

// Import history (/admin/imports, DESIGN.md section 6.4): each time the API applied new seed files from tobymao/18xx, what it added, and the upstream
// changes it did not apply because they would overwrite data edited in the app. Apply those by hand with Edit tile if they are wanted.
export default function AdminImportsPage() {
  const [runs, setRuns] = useState<ImportRun[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    getImports()
      .then((data) => {
        if (!ignore) setRuns(data)
      })
      .catch((err: unknown) => {
        if (!ignore) setError(apiErrorMessages(err).join(' '))
      })
    return () => {
      ignore = true
    }
  }, [])

  if (error) return <p className="text-destructive">Could not load imports. {error}</p>
  if (!runs) return <LoadingState label="Loading imports…" />

  return (
    <div className="space-y-4">
      <PageHeader icon={Download} area="admin" title="Imports" description="Each time the site's data was loaded from tobymao/18xx." />
      <p className="text-sm text-muted-foreground">
        Data from{' '}
        <a href="https://github.com/tobymao/18xx" className="underline">
          tobymao/18xx
        </a>
        . To get newer data, run <code className="rounded bg-muted px-1">python -I tools/import/update_data.py</code>, then rebuild and restart the API. Imports
        add new games, tiles, and counts; they never overwrite changes made here.
      </p>
      {runs.length === 0 && (
        <EmptyState icon={Download} title="No imports yet" description="The first import runs when the API starts with seed files from tobymao/18xx." />
      )}
      <ol className="space-y-4">
        {runs.map((run) => (
          <li key={run.id} className="space-y-2 rounded-lg border p-4 text-sm">
            <div className="flex flex-wrap items-baseline gap-x-3">
              <span className="font-medium">
                Commit{' '}
                <a href={`https://github.com/tobymao/18xx/commit/${run.sourceCommit}`} className="font-mono underline">
                  {run.sourceCommit.slice(0, 7)}
                </a>
              </span>
              {run.committedUtc && <span className="text-muted-foreground">committed {when(run.committedUtc)}</span>}
              <span className="text-muted-foreground">
                imported {when(run.importedUtc)} ({run.mode === 'seed' ? 'new database' : 'merged'})
              </span>
            </div>
            <p>
              Added {run.gamesAdded} games, {run.tilesAdded} tiles, and {run.linksAdded} game links; filled {run.countsFilled} counts.
            </p>
            {run.notes.length === 0 ? (
              <p className="text-muted-foreground">Nothing to review.</p>
            ) : (
              groupNotes(run.notes).map(([kind, messages]) => (
                <details key={kind}>
                  <summary className="cursor-pointer">
                    {NOTE_GROUPS[kind] ?? kind} ({messages.length})
                  </summary>
                  <ul className="mt-1 list-disc space-y-1 pl-6 break-words text-muted-foreground">
                    {messages.map((message, i) => (
                      <li key={i}>{message}</li>
                    ))}
                  </ul>
                </details>
              ))
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
