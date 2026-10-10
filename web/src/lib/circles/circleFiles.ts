import type { CircleArt, CircleShape } from './crossingSign'

// Single-circle downloads (DESIGN.md section 9.4): a standalone SVG file sized in inches, and a 300 DPI PNG made from that SVG.

export const PNG_DPI = 300

const shapeSvg = ({ d, fill, stroke, strokeWidth, dash }: CircleShape) =>
  `<path d="${d}" fill="${fill ?? 'none'}"` +
  (stroke ? ` stroke="${stroke}" stroke-width="${strokeWidth ?? 1}" stroke-linejoin="round"` : '') +
  (dash ? ` stroke-dasharray="${dash.join(' ')}"` : '') +
  '/>'

// A complete SVG document. Its printed size is the circle's diameter plus any bleed, in inches.
export function circleSvg(art: CircleArt, diameterInches: number): string {
  const e = art.extent
  const inches = (diameterInches * e) / 50
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${inches}in" height="${inches}in" viewBox="${-e} ${-e} ${2 * e} ${2 * e}">` +
    art.shapes.map(shapeSvg).join('') +
    '</svg>'
  )
}

// Draws the SVG onto a canvas at 300 pixels per inch and returns it as a PNG. The SVG has no external fonts or images, so it draws the same in a canvas.
export function circlePng(art: CircleArt, diameterInches: number): Promise<Blob> {
  const pixels = Math.round(((diameterInches * art.extent) / 50) * PNG_DPI)
  const url = URL.createObjectURL(new Blob([circleSvg(art, diameterInches)], { type: 'image/svg+xml' }))
  return new Promise<Blob>((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = pixels
      canvas.getContext('2d')!.drawImage(image, 0, 0, pixels, pixels)
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not create the PNG.'))), 'image/png')
    }
    image.onerror = () => reject(new Error('Could not draw the circle.'))
    image.src = url
  }).finally(() => URL.revokeObjectURL(url))
}
