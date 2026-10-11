import { buildTileDrawing, type Point } from '@/lib/tiles/drawing'
import { tileFills } from '@/lib/tiles/colors'
import { UNIT_RADIUS, type CircleArt, type CircleShape } from './crossingSign'
import type { NumberFont } from './numberFont'

// The "tile picture" sticker (DESIGN.md section 9.4): the tile itself, drawn exactly as on the site (buildTileDrawing), on a hex-shaped sticker for
// tile trays. Offered at 3/4 and 1 inch; the page warns that very busy tiles may look jumbled, especially at 3/4 inch.
//
// Same coordinate system as the circles: centered on (0, 0), y grows downward, and 100 units = the chosen size. Here the size is measured across the
// hex's flat sides (top to bottom), so a 1 inch sticker is 1 inch tall and about 1.15 inches from corner to corner. Text (revenues, the tile number)
// becomes outlines in the number font, so the preview, SVG, PNG, and PDF are identical and need no installed fonts.

// Half the corner-to-corner width, for a hex whose flat-to-flat height is 2 * UNIT_RADIUS.
export const HEX_CORNER = (2 * UNIT_RADIUS) / Math.sqrt(3)

const pathOf = (points: Point[], closed: boolean) => 'M' + points.map(([x, y]) => `${x.toFixed(3)} ${y.toFixed(3)}`).join('L') + (closed ? 'Z' : '')

const circleAt = ([x, y]: Point, r: number) => `M${x + r} ${y}A${r} ${r} 0 1 1 ${x - r} ${y}A${r} ${r} 0 1 1 ${x + r} ${y}Z`

// Flat-top hex corners for a corner radius, starting at the right corner.
export function hexCorners(radius: number): Point[] {
  return Array.from({ length: 6 }, (_, i) => [radius * Math.cos((Math.PI / 3) * i), radius * Math.sin((Math.PI / 3) * i)] as Point)
}
export const hexPath = (radius: number) => pathOf(hexCorners(radius), true)

export function tileHex(font: NumberFont, code: string, color: string, number: string, sizeInches: number, bleedInches = 0): CircleArt {
  // buildTileDrawing makes a hex of corner radius size/2 - 1 inside a box; pick the size that makes its corner radius HEX_CORNER, then move its
  // center to (0, 0).
  const drawing = buildTileDrawing(code, color, 2 * (HEX_CORNER + 1), number)
  const ox = drawing.width / 2
  const oy = drawing.height / 2
  const move = ([x, y]: Point): Point => [x - ox, y - oy]

  const bleed = (bleedInches / sizeInches) * 2 * UNIT_RADIUS // in units, measured square to the hex's sides
  const shapes: CircleShape[] = []

  // Bleed: a larger hex in the tile's color(s) behind the drawing, so a slightly off cut shows no white rim. Two-color tiles: left half first color.
  if (bleed > 0) {
    const outer = HEX_CORNER + (2 * bleed) / Math.sqrt(3)
    const fills = tileFills(color)
    if (fills.length > 1) {
      const c = hexCorners(outer) // 0 right, 1 lower-right, 2 lower-left, 3 left, 4 upper-left, 5 upper-right (y grows downward)
      const top: Point = [0, c[4][1]]
      const bottom: Point = [0, c[1][1]]
      shapes.push({ d: pathOf([top, c[4], c[3], c[2], bottom], true), fill: fills[0] }, { d: pathOf([top, c[5], c[0], c[1], bottom], true), fill: fills[1] })
    } else {
      shapes.push({ d: hexPath(outer), fill: fills[0] })
    }
  }

  let numberPoints = 99
  for (const s of drawing.shapes) {
    switch (s.kind) {
      case 'polygon':
        shapes.push({ d: pathOf(s.points.map(move), true), fill: s.fill, stroke: s.stroke, strokeWidth: s.strokeWidth, dash: s.dash })
        break
      case 'polyline':
        shapes.push({ d: pathOf(s.points.map(move), false), stroke: s.stroke, strokeWidth: s.strokeWidth, dash: s.dash })
        break
      case 'circle':
        shapes.push({ d: circleAt(move(s.center), s.r), fill: s.fill, stroke: s.stroke, strokeWidth: s.strokeWidth })
        break
      case 'text': {
        const [x, y] = move(s.at)
        shapes.push({ d: font.textPath(s.text, x, y, s.size), fill: s.fill })
        if (s.text === number) numberPoints = (s.size / (2 * UNIT_RADIUS)) * sizeInches * 72
        break
      }
    }
  }

  return { shapes, extent: UNIT_RADIUS + bleed, extentX: HEX_CORNER + (2 * bleed) / Math.sqrt(3), outline: 'hex', numberPoints }
}
