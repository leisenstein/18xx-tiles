// Light fill colors for each tile color, chosen to print well (DESIGN.md section 10).
// Two-color tiles have two fills: left half first, right half second.
const TILE_FILLS: Record<string, string[]> = {
  yellow: ['#FBE88A'],
  green: ['#A8D5A2'],
  brown: ['#D9B48F'],
  gray: ['#D0D0D0'],
  sepia: ['#E6CFA8'],
  greenbrown: ['#A8D5A2', '#D9B48F'],
  browngray: ['#D9B48F', '#D0D0D0'],
  brownsepia: ['#D9B48F', '#E6CFA8'],
  none: ['#FFFFFF'],
  white: ['#FFFFFF'],
  // Colors used only by game-specific tiles (added in design doc 1.2).
  red: ['#F4A6A0'],
  blue: ['#A9C8EC'],
  purple: ['#C9B3E0'],
  orange: ['#F8C48C'],
}

// Colors a tile can have, in display order (matches TileColors in the API, DESIGN.md section 7):
// the four main colors first, then the rest alphabetically.
export const TILE_COLORS = [
  'yellow',
  'green',
  'brown',
  'gray',
  'blue',
  'browngray',
  'brownsepia',
  'greenbrown',
  'none',
  'orange',
  'purple',
  'red',
  'white',
]

// Unknown colors draw white rather than failing the whole tile.
export function tileFills(color: string): string[] {
  return TILE_FILLS[color] ?? ['#FFFFFF']
}
