import { UNLIMITED_TILE_COUNT } from '@/lib/constants'

// How many of a tile come in a game's box, as display text (DESIGN.md section 7):
// null = unknown, 999 = unlimited, otherwise the number.
export function countText(count: number | null): string {
  if (count === null) return 'count unknown'
  if (count === UNLIMITED_TILE_COUNT) return 'unlimited'
  return `${count} in box`
}
