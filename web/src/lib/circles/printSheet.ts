import { PDFDocument, rgb } from 'pdf-lib'
import { circlePath, UNIT_RADIUS, type CircleArt } from './crossingSign'
import { HEX_CORNER, hexPath } from './tileHex'

// The PDF print sheet (DESIGN.md section 9.4): stickers (number circles or tile-picture hexes) in rows and columns on Letter or A4 pages, with the
// margins and spacing the user chose.
// Built in the browser with pdf-lib. Everything is drawn as vector paths, so it prints sharp at any size. PDF units are points (72 per inch).

export type Paper = 'letter' | 'a4'

export const PAPER_SIZES: Record<Paper, { label: string; width: number; height: number }> = {
  letter: { label: 'Letter (8.5 x 11 in)', width: 612, height: 792 },
  a4: { label: 'A4 (210 x 297 mm)', width: 595.28, height: 841.89 },
}

export type StickerShape = 'circle' | 'hex'

export interface SheetOptions {
  paper: Paper
  shape: StickerShape // circle: the number circle; hex: the tile picture (1 inch only)
  diameterInches: number // circle diameter, or the hex's height across its flat sides
  marginInches: number // empty border around the page
  spacingInches: number // gap between neighboring stickers (bleeds included in the sticker, not the gap)
  bleedInches: number // extra color outside the cut line
  cutLine: boolean // thin gray outline at the cut size
}

export interface SheetLayout {
  pageWidth: number
  pageHeight: number
  columns: number
  rows: number
  perPage: number
  pitchX: number // distance between neighboring sticker centers, across and down
  pitchY: number
  first: { x: number; y: number } // center of the top-left sticker, measured from the page's top-left corner
}

const POINTS = 72

export function sheetLayout(o: SheetOptions): SheetLayout {
  const { width, height } = PAPER_SIZES[o.paper]
  // Half the sticker's height and width, bleed included. A hex is wider than tall (corner to corner vs. flat to flat).
  const halfHeight = ((o.diameterInches + 2 * o.bleedInches) * POINTS) / 2
  const halfWidth = o.shape === 'hex' ? (halfHeight * HEX_CORNER) / UNIT_RADIUS : halfHeight
  const gap = o.spacingInches * POINTS
  const pitchX = 2 * halfWidth + gap
  const pitchY = 2 * halfHeight + gap
  const margin = o.marginInches * POINTS
  const fit = (length: number, pitch: number) => Math.max(0, Math.floor((length - 2 * margin + gap) / pitch))
  const columns = fit(width, pitchX)
  const rows = fit(height, pitchY)
  // Center the grid on the page, so leftover space is split evenly.
  const used = (count: number, pitch: number) => count * pitch - gap
  return {
    pageWidth: width,
    pageHeight: height,
    columns,
    rows,
    perPage: columns * rows,
    pitchX,
    pitchY,
    first: { x: (width - used(columns, pitchX)) / 2 + halfWidth, y: (height - used(rows, pitchY)) / 2 + halfHeight },
  }
}

// The color names the tile drawings use ("white" for cities and revenue text). The screen understands any CSS color, but the PDF needs numbers.
const NAMED_COLORS: Record<string, string> = { white: '#FFFFFF', black: '#000000' }

// "#RRGGBB", "#RGB", or a name above -> pdf-lib color. Anything else is an error, rather than silently printing black.
export function color(value: string) {
  let hex = (NAMED_COLORS[value.toLowerCase()] ?? value).replace('#', '')
  if (hex.length === 3) hex = [...hex].map((c) => c + c).join('')
  if (!/^[0-9a-f]{6}$/i.test(hex)) throw new Error(`Cannot print the color "${value}".`)
  const n = Number.parseInt(hex, 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

// The cut line's path for a sticker, in drawing units (a circle of radius 50, or a hex 100 units across its flats).
export const cutPath = (art: CircleArt) => (art.outline === 'hex' ? hexPath(HEX_CORNER) : circlePath(UNIT_RADIUS))

// One page per perPage stickers. arts are in print order (a tile with quantity 3 appears 3 times).
export async function buildSheetPdf(arts: CircleArt[], o: SheetOptions, title: string): Promise<Uint8Array> {
  const layout = sheetLayout(o)
  if (layout.perPage === 0) throw new Error('Nothing fits on the page with these margins and this size.')
  const pdf = await PDFDocument.create()
  pdf.setTitle(title)
  pdf.setCreator('18xx Tiles')
  const scale = (o.diameterInches * POINTS) / (2 * UNIT_RADIUS) // drawing units (100 = the chosen size) -> points

  arts.forEach((art, i) => {
    const slot = i % layout.perPage
    const page = slot === 0 ? pdf.addPage([layout.pageWidth, layout.pageHeight]) : pdf.getPage(pdf.getPageCount() - 1)
    const x = layout.first.x + (slot % layout.columns) * layout.pitchX
    // PDF y counts up from the bottom of the page.
    const y = layout.pageHeight - (layout.first.y + Math.floor(slot / layout.columns) * layout.pitchY)
    // drawSvgPath scales line widths and dashes too, so the shapes' unit values carry over unchanged.
    for (const shape of art.shapes) {
      page.drawSvgPath(shape.d, {
        x,
        y,
        scale,
        color: shape.fill ? color(shape.fill) : undefined,
        borderColor: shape.stroke ? color(shape.stroke) : undefined,
        borderWidth: shape.stroke ? shape.strokeWidth : undefined,
        borderDashArray: shape.dash,
      })
    }
    // Cut line: a hairline at the finished size (0.4 pt whatever the scale).
    if (o.cutLine) page.drawSvgPath(cutPath(art), { x, y, scale, borderColor: color('#9A9A9A'), borderWidth: 0.4 / scale })
  })
  return pdf.save()
}
