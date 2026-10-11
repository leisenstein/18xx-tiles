import { extentX, type CircleArt, type CircleShape } from './crossingSign'

// Single-sticker downloads (DESIGN.md section 9.4): a standalone SVG file sized in inches, and a 300 DPI PNG made from that SVG.

export const PNG_DPI = 300

const shapeSvg = ({ d, fill, stroke, strokeWidth, dash }: CircleShape) =>
  `<path d="${d}" fill="${fill ?? 'none'}"` +
  (stroke ? ` stroke="${stroke}" stroke-width="${strokeWidth ?? 1}" stroke-linejoin="round"` : '') +
  (dash ? ` stroke-dasharray="${dash.join(' ')}"` : '') +
  '/>'

// Printed width and height in inches (100 drawing units = the chosen size), bleed included.
const inchesOf = (art: CircleArt, sizeInches: number) => ({ width: (sizeInches * extentX(art)) / 50, height: (sizeInches * art.extent) / 50 })

// A complete SVG document at its printed size: the circle's diameter (or the hex's height across its flats) plus any bleed, in inches.
export function circleSvg(art: CircleArt, diameterInches: number): string {
  const e = art.extent
  const ex = extentX(art)
  const { width, height } = inchesOf(art, diameterInches)
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}in" height="${height}in" viewBox="${-ex} ${-e} ${2 * ex} ${2 * e}">` +
    art.shapes.map(shapeSvg).join('') +
    '</svg>'
  )
}

// Draws the SVG onto a canvas at 300 pixels per inch and returns it as a PNG. The SVG has no external fonts or images, so it draws the same in a canvas.
export function circlePng(art: CircleArt, diameterInches: number): Promise<Blob> {
  const { width, height } = inchesOf(art, diameterInches)
  const pixelsX = Math.round(width * PNG_DPI)
  const pixelsY = Math.round(height * PNG_DPI)
  const url = URL.createObjectURL(new Blob([circleSvg(art, diameterInches)], { type: 'image/svg+xml' }))
  return new Promise<Blob>((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = pixelsX
      canvas.height = pixelsY
      canvas.getContext('2d')!.drawImage(image, 0, 0, pixelsX, pixelsY)
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not create the PNG.'))), 'image/png')
    }
    image.onerror = () => reject(new Error('Could not draw the sticker.'))
    image.src = url
  }).finally(() => URL.revokeObjectURL(url))
}
