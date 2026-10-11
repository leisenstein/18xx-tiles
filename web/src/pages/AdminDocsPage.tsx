import { BookOpen, Database, ScrollText, type LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { NavLink, useParams } from 'react-router'
import { getDoc } from '@/api/admin'
import LoadingState from '@/components/LoadingState'
import Markdown from '@/components/Markdown'
import PageHeader from '@/components/PageHeader'
import { apiErrorMessages } from '@/lib/apiErrors'
import { headingsOf, parseMarkdown } from '@/lib/markdown'
import { cn } from '@/lib/utils'

// The admin documents, as tabs: the runbook and the database guide (docs/RUNBOOK.md and docs/DATABASE.md in the repository).
const DOCS: { name: string; label: string; icon: LucideIcon; description: string }[] = [
  { name: 'runbook', label: 'Runbook', icon: ScrollText, description: 'Set up, run, update, back up, and troubleshoot the app.' },
  { name: 'database', label: 'Database', icon: Database, description: 'Tables, columns, relationships, stored JSON, and useful queries.' },
]

// Admin docs (/admin/docs/:name, admins only, DESIGN.md section 9.1). The text comes from GET /api/admin/docs/{name}, which only admins can call, so
// the documents are not part of the website's code. A table of contents on the left links to each section.
export default function AdminDocsPage() {
  const { name = 'runbook' } = useParams()
  const doc = DOCS.find((d) => d.name === name) ?? DOCS[0]
  const [data, setData] = useState<{ name: string; text: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    getDoc(doc.name)
      .then((text) => {
        if (!ignore) setData({ name: doc.name, text })
      })
      .catch((err: unknown) => {
        if (!ignore) setError(apiErrorMessages(err).join(' '))
      })
    return () => {
      ignore = true
    }
  }, [doc.name])

  const blocks = useMemo(() => (data?.name === doc.name ? parseMarkdown(data.text) : null), [data, doc.name])
  const headings = blocks ? headingsOf(blocks) : []

  return (
    <div className="space-y-6">
      <PageHeader icon={BookOpen} area="admin" title="Docs" description={doc.description} />

      <div className="flex gap-1 border-b">
        {DOCS.map((d) => (
          <NavLink
            key={d.name}
            to={`/admin/docs/${d.name}`}
            className={({ isActive }) =>
              cn(
                '-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground',
                isActive ? 'border-foreground font-medium text-foreground' : 'border-transparent',
              )
            }
          >
            <d.icon className="size-4" aria-hidden="true" />
            {d.label}
          </NavLink>
        ))}
      </div>

      {error && <p className="text-destructive">Could not load the document. {error}</p>}
      {!blocks && !error && <LoadingState />}
      {blocks && (
        <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
          {/* Table of contents: sticks beside the text on wide screens. */}
          <nav className="hidden lg:block" aria-label="Contents">
            <div className="sticky top-28 space-y-1 text-sm">
              <div className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Contents</div>
              {headings.map((h) => (
                <a key={h.id} href={`#${h.id}`} className={cn('block truncate text-muted-foreground hover:text-foreground', h.level === 3 && 'pl-3 text-xs')}>
                  {h.text.replace(/[`*]/g, '')}
                </a>
              ))}
            </div>
          </nav>
          <article className="min-w-0 max-w-4xl">
            <Markdown blocks={blocks} />
          </article>
        </div>
      )}
    </div>
  )
}
