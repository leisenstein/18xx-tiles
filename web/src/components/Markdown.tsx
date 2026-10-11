import { Check, Copy, Info } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Block } from '@/lib/markdown'

// A small Markdown renderer for the admin documents (docs/RUNBOOK.md, docs/DATABASE.md). It covers what those files use: headings (#, ##, ###), paragraphs,
// lists (- and 1.), tables, notes (> lines), fenced code blocks, and inline `code`, **bold**, and [links](url). Everything becomes React elements (no raw
// HTML), so text in the file can never inject markup. Headings get ids (slugs) so the table of contents can link to them.

// Inline formatting: `code`, **bold**, [text](url). Anything else is plain text.
function inline(text: string): ReactNode[] {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g).map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 1) {
      return (
        <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      )
    }
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part)
    if (link) {
      const external = /^https?:/.test(link[2])
      return (
        <a key={i} href={link[2]} className="underline" {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>
          {link[1]}
        </a>
      )
    }
    return part
  })
}

// A code block with its language and a Copy button (commands are meant to be copied and run).
function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <div className="group relative rounded-lg border bg-slate-950 text-slate-100">
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-1 text-xs text-slate-400">
        <span>{lang && lang !== 'text' ? lang : ''}</span>
        <Button size="xs" variant="ghost" className="h-6 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={copy}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <pre className="overflow-x-auto p-3 text-sm leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  )
}

export default function Markdown({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-4 text-sm leading-relaxed">
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'heading':
            if (b.level === 1) return null // the page header already shows the title
            return b.level === 2 ? (
              <h2 key={i} id={b.id} className="scroll-mt-32 border-b pt-4 pb-1 text-xl font-semibold tracking-tight">
                {inline(b.text)}
              </h2>
            ) : (
              <h3 key={i} id={b.id} className="scroll-mt-32 pt-2 text-base font-semibold">
                {inline(b.text)}
              </h3>
            )
          case 'paragraph':
            return <p key={i}>{inline(b.text)}</p>
          case 'note':
            return (
              <div key={i} className="flex gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sky-950">
                <Info className="mt-0.5 size-4 shrink-0 text-sky-700" aria-hidden="true" />
                <p>{inline(b.text)}</p>
              </div>
            )
          case 'list':
            return b.ordered ? (
              <ol key={i} start={b.start} className="list-decimal space-y-1 pl-6">
                {b.items.map((item, j) => (
                  <li key={j}>{inline(item)}</li>
                ))}
              </ol>
            ) : (
              <ul key={i} className="list-disc space-y-1 pl-6">
                {b.items.map((item, j) => (
                  <li key={j}>{inline(item)}</li>
                ))}
              </ul>
            )
          case 'table':
            return (
              <div key={i} className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      {b.head.map((h, j) => (
                        <TableHead key={j} className="whitespace-normal">
                          {inline(h)}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {b.rows.map((row, r) => (
                      <TableRow key={r}>
                        {row.map((cell, c) => (
                          <TableCell key={c} className="align-top whitespace-normal">
                            {inline(cell)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          case 'code':
            return <CodeBlock key={i} lang={b.lang} code={b.code} />
        }
      })}
    </div>
  )
}
