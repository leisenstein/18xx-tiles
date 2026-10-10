import { Download } from 'lucide-react'
import { Link } from 'react-router'
import type { ImportRun } from '@/types/importRun'

// Dates are stored in UTC; show them in the viewer's local time.
const when = (utc: string) => new Date(utc).toLocaleString()

// One data import in the admin History list: which tobymao/18xx commit, when, what it added, and how many notes it left for review.
// The full report (each note) is on the Imports page.
export default function ImportEntry({ run }: { run: ImportRun }) {
  const backfilled = run.notes.some((n) => n.kind === 'backfilled')
  const notes = run.notes.filter((n) => n.kind !== 'backfilled').length

  return (
    // Light blue panel with a sky-blue left border, so data imports stand apart from tile changes (which have white panels and type-colored borders).
    <li className="space-y-1 rounded-lg border border-l-4 border-sky-200 border-l-sky-500 bg-sky-50 p-3 text-sm dark:border-sky-900 dark:bg-sky-950/40">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-md bg-sky-600 px-2 py-0.5 text-xs font-semibold tracking-wide text-white uppercase">
          <Download className="size-3.5" aria-hidden="true" />
          Import
        </span>
        <span className="font-medium">
          tobymao/18xx commit{' '}
          <a href={`https://github.com/tobymao/18xx/commit/${run.sourceCommit}`} className="font-mono underline">
            {run.sourceCommit.slice(0, 7)}
          </a>
        </span>
        <span className="rounded-md bg-sky-100 px-1.5 py-0.5 text-xs text-sky-900 dark:bg-sky-900 dark:text-sky-100">
          {run.mode === 'seed' ? 'Initial import' : 'Update'}
        </span>
        <span className="text-muted-foreground">on {when(run.importedUtc)}</span>
      </div>
      <p>
        Added {run.gamesAdded} games, {run.tilesAdded} tiles, and {run.linksAdded} game links; filled {run.countsFilled} counts.{' '}
        {notes > 0 ? (
          <Link to="/admin/imports" className="underline">
            {notes} {notes === 1 ? 'note' : 'notes'} to review
          </Link>
        ) : (
          <span className="text-muted-foreground">Nothing to review.</span>
        )}
      </p>
      {backfilled && <p className="text-xs text-muted-foreground">Recorded later: this import ran before the import log existed.</p>}
    </li>
  )
}
