// Fill colors for each tile color, "deep print" style (picked after Phase 4, style B): richer than the original pale fills, still dark enough for
// black track and light enough for black labels. DESIGN.md section 10. Two-color tiles have two fills: left half first, right half second.
const TILE_FILLS: Record<string, string[]> = {
  yellow: ['#F2C230'],
  green: ['#5FAE57'],
  brown: ['#B9814B'],
  gray: ['#ABABAB'],
  sepia: ['#CFA970'],
  greenbrown: ['#5FAE57', '#B9814B'],
  browngray: ['#B9814B', '#ABABAB'],
  brownsepia: ['#B9814B', '#CFA970'],
  none: ['#FFFFFF'],
  white: ['#FFFFFF'],
  // Colors used only by game-specific tiles (added in design doc 1.2).
  red: ['#E0655E'],
  blue: ['#5E95D8'],
  purple: ['#A07CCB'],
  orange: ['#F09A42'],
}

// The four main tile colors' fills, yellow to gray, for decoration (the strip across the top of every page).
export const TILE_FILLS_MAIN = ['yellow', 'green', 'brown', 'gray'].map((c) => TILE_FILLS[c][0])

// Colors a tile can have, in display order (matches TileColors in the API, DESIGN.md section 7):
// the four main colors first, then the rest alphabetically.
export const TILE_COLORS = ['yellow', 'green', 'brown', 'gray', 'blue', 'browngray', 'brownsepia', 'greenbrown', 'none', 'orange', 'purple', 'red', 'white']

// Unknown colors draw white rather than failing the whole tile.
export function tileFills(color: string): string[] {
  return TILE_FILLS[color] ?? ['#FFFFFF']
}

// Mix a "#RRGGBB" color toward black (amount < 0) or white (amount > 0); amount from -1 to 1. Other color formats are returned unchanged.
export function shade(hex: string, amount: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const target = amount < 0 ? 0 : 255
  const k = Math.abs(amount)
  const channels = [0, 2, 4].map((i) => Number.parseInt(m[1].slice(i, i + 2), 16))
  return (
    '#' +
    channels
      .map((c) =>
        Math.round(c + (target - c) * k)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  )
}
