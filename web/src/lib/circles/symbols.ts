import type { CircleShape } from './crossingSign'

// Symbols in tile labels (★, ⚓, ⚒, ⛏, 🛢) for the tile-picture stickers. Sticker text is turned into outlines in the number font (Roboto Condensed),
// which has letters and digits but none of these symbols, so they came out as empty boxes in the PDF, SVG, and PNG. Here each symbol is drawn instead
// as a small icon made of plain outlines, which every sticker output (PDF, SVG, PNG, the previews) already knows how to draw.
//
// The star, anchor, and oil drum outlines are from Lucide (lucide.dev, ISC license; the same icon set the site's buttons use), on its 24 x 24 grid
// with 2-unit lines. The hammer and pick (⚒) and the pick (⛏) are drawn here on the same grid, kept simple so they stay readable at sticker size:
// crossed handles, a solid hammer head, and a curved pick head. The star and the hammer head are filled; the rest are lines.

interface IconPart {
  d?: string
  circle?: [number, number, number] // cx, cy, r
  filled?: boolean // fill the outline instead of drawing it as a line
}

const PICK: IconPart[] = [
  { d: 'M4 20L16.5 7.5' }, // handle, lower left to upper right
  { d: 'M10.5 3.5C15.5 3.2 20.8 8.5 20.5 13.5' }, // curved head across the top of the handle
]
const HAMMER: IconPart[] = [
  { d: 'M8.5 8.5L20 20' }, // handle, lower right to upper left
  { d: 'M10.74 5.08L7.92 2.26L2.26 7.92L5.08 10.74Z', filled: true }, // head, square to the handle
]

const ICONS: Record<string, IconPart[]> = {
  '★': [
    {
      filled: true,
      d: 'M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z',
    },
  ],
  '⚓': [{ d: 'M12 6v16' }, { d: 'm19 13 2-1a9 9 0 0 1-18 0l2 1' }, { d: 'M9 11h6' }, { circle: [12, 4, 2] }],
  '⚒': [...PICK, ...HAMMER],
  '⛏': PICK,
  '🛢': [
    { d: 'M10 3a41 41 0 000 18' },
    { d: 'M14 3a41 41 0 010 18' },
    {
      d: 'M16.997 21a2 2 0 001.68-.92 15.25 15.25 0 000-16.16 2 2 0 00-1.68-.92h-10a2 2 0 00-1.681.92 15.25 15.25 0 000 16.16 2 2 0 001.681.92z',
    },
    { d: 'M3.54 16h16.914' },
    { d: 'M3.54 8h16.914' },
  ],
}

// Variation selectors (U+FE0E text style, U+FE0F emoji style) only choose how a font shows the symbol, so they are ignored here.
const VARIATION_SELECTORS = new RegExp('[\\uFE0E\\uFE0F]', 'g')

// Moves and scales SVG path data: x' = x * sx + tx, y' = y * sy + ty (relative moves are only scaled). Handles every command Lucide uses, including
// arcs written compactly, such as "a41 41 0 000 18", where the two flags are single digits run together. A mirror (sx * sy < 0) reverses each arc's
// direction.
export function transformPath(d: string, sx: number, sy: number, tx: number, ty: number): string {
  let i = 0
  const out: string[] = []
  const skip = () => {
    while (i < d.length && /[\s,]/.test(d[i])) i++
  }
  const number = () => {
    skip()
    const match = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/.exec(d.slice(i))
    if (!match) throw new Error(`Bad path data near "${d.slice(i, i + 10)}"`)
    i += match[0].length
    return Number.parseFloat(match[0])
  }
  const flag = () => {
    skip()
    return d[i++] === '1' ? 1 : 0
  }
  const f = (n: number) => Number(n.toFixed(4)).toString()
  const point = (relative: boolean) => {
    const x = number()
    const y = number()
    return relative ? `${f(x * sx)} ${f(y * sy)}` : `${f(x * sx + tx)} ${f(y * sy + ty)}`
  }
  let command = ''
  while (true) {
    skip()
    if (i >= d.length) break
    if (/[a-zA-Z]/.test(d[i])) {
      command = d[i++]
    } else if (command === 'M' || command === 'm') {
      command = command === 'M' ? 'L' : 'l' // numbers after a move continue as lines
    }
    const relative = command === command.toLowerCase()
    switch (command.toUpperCase()) {
      case 'Z':
        out.push('Z')
        break
      case 'M':
        // A path's first move is always absolute, even when written "m" (there is no earlier point to be relative to).
        if (out.length === 0) out.push('M' + point(false))
        else out.push(command + point(relative))
        break
      case 'L':
      case 'T':
        out.push(command + point(relative))
        break
      case 'H': {
        const x = number()
        out.push(command + f(relative ? x * sx : x * sx + tx))
        break
      }
      case 'V': {
        const y = number()
        out.push(command + f(relative ? y * sy : y * sy + ty))
        break
      }
      case 'C':
        out.push(command + [point(relative), point(relative), point(relative)].join(' '))
        break
      case 'S':
      case 'Q':
        out.push(command + [point(relative), point(relative)].join(' '))
        break
      case 'A': {
        const rx = number()
        const ry = number()
        const rotation = number()
        const large = flag()
        const sweep = flag()
        const mirrored = sx * sy < 0
        out.push(
          `${command}${f(rx * Math.abs(sx))} ${f(ry * Math.abs(sy))} ${f(mirrored ? -rotation : rotation)} ${large} ${mirrored ? 1 - sweep : sweep} ${point(relative)}`,
        )
        break
      }
      default:
        throw new Error(`Unsupported path command "${command}"`)
    }
  }
  return out.join('')
}

// The shapes for a label made only of known symbols (for example "★", "⚓︎", or "⛏️🛢️"), centered on x with the text baseline at y, at this font
// size, in the given color. Returns null for any other text, which the caller draws with the number font as before.
export function symbolShapes(text: string, x: number, baseline: number, size: number, color: string): CircleShape[] | null {
  const symbols = [...text.replace(VARIATION_SELECTORS, '')]
  if (symbols.length === 0 || !symbols.every((s) => s in ICONS)) return null

  const box = size * 0.95 // each icon's width and height
  const gap = size * 0.12
  const total = symbols.length * box + (symbols.length - 1) * gap
  const top = baseline - 0.35 * size - box / 2 // the tile drawing puts the baseline 0.35 x size below the text's center
  const scale = box / 24
  const lineWidth = 2.2 * scale // a little bolder than on screen, so it prints clearly at sticker size

  const shapes: CircleShape[] = []
  symbols.forEach((symbol, n) => {
    const left = x - total / 2 + n * (box + gap)
    for (const part of ICONS[symbol]) {
      const circle = part.circle
      const path = circle
        ? `M${circle[0] + circle[2]} ${circle[1]}A${circle[2]} ${circle[2]} 0 1 1 ${circle[0] - circle[2]} ${circle[1]}A${circle[2]} ${circle[2]} 0 1 1 ${circle[0] + circle[2]} ${circle[1]}Z`
        : part.d!
      const d = transformPath(path, scale, scale, left, top)
      shapes.push(part.filled ? { d, fill: color } : { d, stroke: color, strokeWidth: lineWidth })
    }
  })
  return shapes
}
