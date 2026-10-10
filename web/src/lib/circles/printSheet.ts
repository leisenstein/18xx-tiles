import { PDFDocument, rgb } from 'pdf-lib'
import { circlePath, UNIT_RADIUS, type CircleArt } from './crossingSign'

// The PDF print sheet (DESIGN.md section 9.4): circles in rows and columns on Letter or A4 pages, with the margins and spacing the user chose.
// Built in the browser with pdf-lib. Everything is drawn as vector paths, so it prints sharp at any size. PDF units are points (72 per inch).

export type Paper = 'letter' | 'a4'

export const PAPER_SIZES: Record<Paper, { label: string; width: number; height: number }> = {
  letter: { label: 'Letter (8.5 x 11 in)', width: 612, height: 792 },
  a4: { label: 'A4 (210 x 297 mm)', width: 595.28, height: 841.89 },
}

export interface SheetOptions {
  paper: Paper
  diameterInches: number
  marginInches: number // empty border around the page
  spacingInches: number // gap between neighboring circles (bleeds included in the circle, not the gap)
  bleedInches: number // extra color outside the cut line
  cutLine: boolean // thin gray circle at the cut size
}

export interface SheetLayout {
  pageWidth: number
  pageHeight: number
  columns: number
  rows: number
  perPage: number
  pitch: number // distance between neighboring circle centers
  first: { x: number; y: number } // center of the top-left circle, measured from the page's top-left corner
  cellRadius: number // radius including bleed
}

const POINTS = 72

export function sheetLayout(o: SheetOptions): SheetLayout {
  const { width, height } = PAPER_SIZES[o.paper]
  const cellRadius = ((o.diameterInches + 2 * o.bleedInches) * POINTS) / 2
  const pitch = 2 * cellRadius + o.spacingInches * POINTS
  const margin = o.marginInches * POINTS
  const fit = (length: number) => Math.max(0, Math.floor((length - 2 * margin + o.spacingInches * POINTS) / pitch))
  const columns = fit(width)
  const rows = fit(height)
  // Center the grid on the page, so leftover space is split evenly.
  const used = (count: number) => count * pitch - o.spacingInches * POINTS
  return {
    pageWidth: width,
    pageHeight: height,
    columns,
    rows,
    perPage: columns * rows,
    pitch,
    first: { x: (width - used(columns)) / 2 + cellRadius, y: (height - used(rows)) / 2 + cellRadius },
    cellRadius,
  }
}

// "#RRGGBB" -> pdf-lib color.
function color(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

// One page per perPage circles. arts are in print order (a tile with quantity 3 appears 3 times).
export async function buildSheetPdf(arts: CircleArt[], o: SheetOptions, title: string): Promise<Uint8Array> {
  const layout = sheetLayout(o)
  if (layout.perPage === 0) throw new Error('No circles fit on the page with these margins and this size.')
  const pdf = await PDFDocument.create()
  pdf.setTitle(title)
  pdf.setCreator('18xx Tiles')
  const scale = (o.diameterInches * POINTS) / (2 * UNIT_RADIUS) // unit circle (radius 50) -> points

  arts.forEach((art, i) => {
    const slot = i % layout.perPage
    const page = slot === 0 ? pdf.addPage([layout.pageWidth, layout.pageHeight]) : pdf.getPage(pdf.getPageCount() - 1)
    const x = layout.first.x + (slot % layout.columns) * layout.pitch
    // PDF y counts up from the bottom of the page.
    const y = layout.pageHeight - (layout.first.y + Math.floor(slot / layout.columns) * layout.pitch)
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
    if (o.cutLine) page.drawSvgPath(circlePath(UNIT_RADIUS), { x, y, scale, borderColor: color('#9A9A9A'), borderWidth: 0.4 / scale })
  })
  return pdf.save()
}
