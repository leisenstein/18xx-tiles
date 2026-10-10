import fontkit from '@pdf-lib/fontkit'
import fontUrl from '@fontsource/roboto-condensed/files/roboto-condensed-latin-700-normal.woff2?url'

// The font for tile number circles (DESIGN.md section 9.4): Roboto Condensed Bold, read with fontkit so text can be measured exactly and turned into
// outlines. Drawing the number as outlines (not as text) makes the preview, SVG, PNG, and PDF identical, and nothing depends on fonts installed on the
// viewer's computer or printer.

export interface NumberFont {
  // Width of the text at a font size of 1 (multiply by the font size).
  widthEm(text: string): number
  // Height of capital letters and digits at a font size of 1.
  capEm: number
  // SVG path data for the text at this font size, centered horizontally on x, with the baseline at y (SVG coordinates: y grows downward).
  textPath(text: string, x: number, baseline: number, size: number): string
}

// fontkit's typings leave out the outline commands, which the runtime provides.
interface PathCommand {
  command: 'moveTo' | 'lineTo' | 'quadraticCurveTo' | 'bezierCurveTo' | 'closePath'
  args: number[]
}

const LETTERS: Record<PathCommand['command'], string> = { moveTo: 'M', lineTo: 'L', quadraticCurveTo: 'Q', bezierCurveTo: 'C', closePath: 'Z' }

let loading: Promise<NumberFont> | null = null

// Loads the font file once (about 20 KB); later calls get the same promise.
export function loadNumberFont(): Promise<NumberFont> {
  loading ??= fetch(fontUrl)
    .then((response) => {
      if (!response.ok) throw new Error(`Could not load the number font (${response.status}).`)
      return response.arrayBuffer()
    })
    .then((buffer) => {
      const font = fontkit.create(new Uint8Array(buffer))
      const unit = 1 / font.unitsPerEm
      return {
        widthEm: (text) => font.layout(text).advanceWidth * unit,
        capEm: font.capHeight * unit,
        textPath(text, x, baseline, size) {
          const run = font.layout(text)
          const scale = size * unit
          let penX = x - (run.advanceWidth * scale) / 2
          const parts: string[] = []
          run.glyphs.forEach((glyph, i) => {
            const position = run.positions[i]
            const originX = penX + position.xOffset * scale
            const originY = baseline - position.yOffset * scale
            // Font outlines have y growing upward; flip each point into SVG coordinates.
            for (const { command, args } of (glyph.path as unknown as { commands: PathCommand[] }).commands) {
              const points: string[] = []
              for (let k = 0; k < args.length; k += 2) points.push(`${(originX + args[k] * scale).toFixed(3)} ${(originY - args[k + 1] * scale).toFixed(3)}`)
              parts.push(LETTERS[command] + points.join(' '))
            }
            penX += position.xAdvance * scale
          })
          return parts.join('')
        },
      } satisfies NumberFont
    })
  // If loading failed, let the next call try again.
  loading.catch(() => {
    loading = null
  })
  return loading
}
