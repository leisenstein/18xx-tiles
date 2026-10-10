// Parses a tile definition string (tobymao/18xx TILES.md "Tile language"),
// e.g. "city=revenue:20;path=a:0,b:_0;label=OO".
// Ported from parse() and rev_text() in reference/build_pdf.py.

// One part: the type before "=" and its "key:value" settings.
export interface TilePart {
  type: string
  values: Record<string, string>
}

// "city=revenue:20,slots:2" -> { type: 'city', values: { revenue: '20', slots: '2' } }
// A setting without ":" (e.g. "label=OO") becomes a key with an empty value.
export function parseDefinition(code: string): TilePart[] {
  const parts: TilePart[] = []
  for (const raw of code.split(';')) {
    const text = raw.trim()
    if (!text) continue
    const eq = text.indexOf('=')
    const type = eq < 0 ? text : text.slice(0, eq)
    const values: Record<string, string> = {}
    if (eq >= 0) {
      for (const setting of text.slice(eq + 1).split(',')) {
        const colon = setting.indexOf(':')
        if (colon < 0) values[setting] = ''
        else values[setting.slice(0, colon)] = setting.slice(colon + 1)
      }
    }
    parts.push({ type, values })
  }
  return parts
}

// Revenue as display text. Phase lists show each phase's number:
// "30" -> "30", "#cb7743_50|brown_60" -> "50/60". Returns null when there is none.
// Takes only the trailing digits of each phase, so a color code like "#cb7743" is not read as a number.
export function revenueText(value: string | undefined): string | null {
  if (!value) return null
  const numbers = value
    .split('|')
    .map((segment) => /(\d+)$/.exec(segment)?.[1])
    .filter((n): n is string => n !== undefined)
  return numbers.length > 0 ? numbers.join('/') : null
}
