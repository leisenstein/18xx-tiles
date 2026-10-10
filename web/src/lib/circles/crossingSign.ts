import { shade, tileFills } from '@/lib/tiles/colors'
import type { NumberFont } from './numberFont'

// The "crossing sign" tile number circle (DESIGN.md section 9.4), modeled on the round railroad advance warning sign: tile-color circle, black border
// just inside the edge, a black X whose bars reach the border, large "R"s left and right, and a white city circle holding the tile number.
//
// Everything is built as SVG path data in one coordinate system: the circle has radius 50 centered on (0, 0), y grows downward. The SVG, PNG, and PDF
// outputs scale these same shapes to the chosen diameter, so all three look identical.

export const UNIT_RADIUS = 50
export const MIN_NUMBER_POINTS = 6 // smaller numbers are flagged on the page (hard to read when printed)

const INK = '#1A1A1A'

export interface CircleShape {
  d: string // SVG path data
  fill?: string
  stroke?: string
  strokeWidth?: number
  dash?: number[]
}

export interface CircleArt {
  shapes: CircleShape[]
  extent: number // drawn radius including bleed, in the same units (50 + bleed)
  numberPoints: number // printed size of the number in points (font size), for the readability check
}

// Full circle as path data (two arcs), so circles and everything else go through the same path drawing in SVG and PDF.
export const circlePath = (r: number) => `M${r} 0A${r} ${r} 0 1 1 ${-r} 0A${r} ${r} 0 1 1 ${r} 0Z`
const halfPath = (r: number, side: 'left' | 'right') => (side === 'left' ? `M0 ${-r}A${r} ${r} 0 0 0 0 ${r}Z` : `M0 ${-r}A${r} ${r} 0 0 1 0 ${r}Z`)

// A bar of the X: a rectangle through the center at the given angle.
function bar(angle: number, halfLength: number, halfWidth: number): string {
  const ux = Math.cos(angle)
  const uy = Math.sin(angle)
  const corners = [
    [ux * halfLength - uy * halfWidth, uy * halfLength + ux * halfWidth],
    [ux * halfLength + uy * halfWidth, uy * halfLength - ux * halfWidth],
    [-ux * halfLength + uy * halfWidth, -uy * halfLength - ux * halfWidth],
    [-ux * halfLength - uy * halfWidth, -uy * halfLength + ux * halfWidth],
  ]
  return 'M' + corners.map(([x, y]) => `${x.toFixed(3)} ${y.toFixed(3)}`).join('L') + 'Z'
}

// Long numbers (6+ characters) go on two lines, split at a hyphen or where letters and digits meet, nearest the middle: "X17coaloil" -> X17 / coaloil.
export function splitNumber(text: string): string[] {
  if (text.length < 6) return [text]
  let best = -1
  for (let i = 1; i < text.length; i++) {
    const before = text[i - 1]
    const after = text[i]
    const boundary = before === '-' || after === '-' || /\d/.test(before) !== /\d/.test(after)
    if (boundary && (best < 0 || Math.abs(i - text.length / 2) < Math.abs(best - text.length / 2))) best = i
  }
  if (best < 0) best = Math.ceil(text.length / 2)
  return [text.slice(0, best), text.slice(best)]
}

// Proportions, as fractions of the radius. On 1/2 inch circles the city grows and the decorations slim down, so the number stays readable.
function layout(diameterInches: number) {
  const small = diameterInches <= 0.5
  return {
    border: 0.95, // center line of the black border
    borderWidth: 0.045,
    bar: small ? 0.15 : 0.17, // width of each X bar
    rSize: small ? 0.34 : 0.37, // font size of the R's
    rX: small ? 0.745 : 0.725, // distance of each R from the center
    city: small ? 0.54 : 0.5, // white circle radius
    cityLine: 0.04,
  }
}

export function crossingSign(font: NumberFont, number: string, color: string, diameterInches: number, bleedInches = 0): CircleArt {
  const R = UNIT_RADIUS
  const L = layout(diameterInches)
  const bleed = (bleedInches / diameterInches) * 2 * R
  const extent = R + bleed
  const fills = tileFills(color)
  const shapes: CircleShape[] = []

  // Background, extended by the bleed so a slightly off cut still shows no white rim. Two-color tiles: left half first color, right half second.
  if (fills.length > 1) {
    shapes.push({ d: halfPath(extent, 'left'), fill: fills[0] }, { d: halfPath(extent, 'right'), fill: fills[1] })
  } else {
    shapes.push({ d: circlePath(extent), fill: fills[0] })
  }

  // The X: two bars ending just under the black border (their corners touch the border's center line, which the border then covers).
  const b = R * L.border
  const halfWidth = (R * L.bar) / 2
  const halfLength = Math.sqrt(b * b - halfWidth * halfWidth)
  shapes.push({ d: bar(Math.PI / 4, halfLength, halfWidth), fill: INK }, { d: bar(-Math.PI / 4, halfLength, halfWidth), fill: INK })

  // Black border just inside the edge.
  shapes.push({ d: circlePath(b), stroke: INK, strokeWidth: R * L.borderWidth })

  // The R's, extra bold: the bold font plus a thin outline in the same color.
  const rSize = R * L.rSize
  for (const x of [-R * L.rX, R * L.rX]) {
    shapes.push({ d: font.textPath('R', x, (rSize * font.capEm) / 2, rSize), fill: INK, stroke: INK, strokeWidth: R * 0.025 })
  }

  // White city circle and the number: the largest size whose lines fit the city's width (84% of its diameter on one line, 78% on two) and height.
  const rc = R * L.city
  shapes.push({ d: circlePath(rc), fill: '#FFFFFF', stroke: INK, strokeWidth: R * L.cityLine })
  const lines = splitNumber(number)
  const widest = Math.max(...lines.map((line) => font.widthEm(line)))
  const gap = 0.28 // space between two lines, as a fraction of the digit height
  const size =
    lines.length === 1 ? Math.min((1.68 * rc) / widest, (1.24 * rc) / font.capEm) : Math.min((1.56 * rc) / widest, (1.4 * rc) / (font.capEm * (2 + gap)))
  const step = size * font.capEm * (1 + gap)
  lines.forEach((line, i) => {
    const baseline = (size * font.capEm) / 2 + (i - (lines.length - 1) / 2) * step
    shapes.push({ d: font.textPath(line, 0, baseline, size), fill: INK })
  })

  // Color "none": white tile, so mark the cut edge with a dashed line.
  if (color === 'none') shapes.push({ d: circlePath(R - 0.5), stroke: shade('#8C8C8C', -0.2), strokeWidth: 0.8, dash: [3, 3] })

  return { shapes, extent, numberPoints: (size / (2 * R)) * diameterInches * 72 }
}
