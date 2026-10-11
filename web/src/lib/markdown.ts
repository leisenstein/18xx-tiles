// Parsing for the small Markdown renderer (components/Markdown.tsx): turns the admin documents (docs/RUNBOOK.md, docs/DATABASE.md) into blocks. Kept
// apart from the component because a component file should export only components (React Fast Refresh rule).

export interface Heading {
  level: 2 | 3
  text: string
  id: string
}

export type Block =
  | { kind: 'heading'; level: 1 | 2 | 3; text: string; id: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; start: number; items: string[] }
  | { kind: 'table'; head: string[]; rows: string[][] }
  | { kind: 'note'; text: string }
  | { kind: 'code'; lang: string; code: string }

export const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[`*]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim())

// Split the file into blocks, line by line.
export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '') {
      i++
      continue
    }
    const fence = /^```(\w*)/.exec(line)
    if (fence) {
      const code: string[] = []
      for (i++; i < lines.length && !lines[i].startsWith('```'); i++) code.push(lines[i])
      blocks.push({ kind: 'code', lang: fence[1], code: code.join('\n') })
      i++
      continue
    }
    const heading = /^(#{1,3}) (.*)$/.exec(line)
    if (heading) {
      const text = heading[2].trim()
      blocks.push({ kind: 'heading', level: heading[1].length as 1 | 2 | 3, text, id: slug(text) })
      i++
      continue
    }
    if (line.startsWith('>')) {
      const text: string[] = []
      for (; i < lines.length && lines[i].startsWith('>'); i++) text.push(lines[i].replace(/^>\s?/, ''))
      blocks.push({ kind: 'note', text: text.join(' ') })
      continue
    }
    if (line.trim().startsWith('|') && /^\s*\|?\s*:?-+/.test(lines[i + 1] ?? '')) {
      const head = cells(line)
      const rows: string[][] = []
      for (i += 2; i < lines.length && lines[i].trim().startsWith('|'); i++) rows.push(cells(lines[i]))
      blocks.push({ kind: 'table', head, rows })
      continue
    }
    const item = /^(-|(\d+)\.) (.*)$/.exec(line)
    if (item) {
      const ordered = item[1] !== '-'
      const items: string[] = []
      for (; i < lines.length; i++) {
        const m = /^(-|(\d+)\.) (.*)$/.exec(lines[i])
        if (m && (m[1] !== '-') === ordered) items.push(m[3])
        else if (items.length && /^\s{2,}\S/.test(lines[i])) items[items.length - 1] += ' ' + lines[i].trim()
        else break
      }
      blocks.push({ kind: 'list', ordered, start: ordered ? Number(item[2]) : 1, items })
      continue
    }
    const text: string[] = []
    for (; i < lines.length && lines[i].trim() !== '' && !/^(#{1,3} |```|>|\||-\s|\d+\.\s)/.test(lines[i]); i++) text.push(lines[i].trim())
    if (text.length === 0) text.push(lines[i++].trim())
    blocks.push({ kind: 'paragraph', text: text.join(' ') })
  }
  return blocks
}

// The h2 and h3 headings, for a table of contents.
export const headingsOf = (blocks: Block[]): Heading[] =>
  blocks
    .filter((b): b is Extract<Block, { kind: 'heading' }> => b.kind === 'heading' && b.level > 1)
    .map((b) => ({ level: b.level as 2 | 3, text: b.text, id: b.id }))
