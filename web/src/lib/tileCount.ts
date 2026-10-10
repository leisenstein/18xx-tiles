import { UNLIMITED_TILE_COUNT } from '@/lib/constants'
import type { GameSummary } from '@/types/game'

// How many of a tile come in a game's box, as display text (DESIGN.md section 7):
// null = unknown, 999 = unlimited, otherwise the number.
export function countText(count: number | null): string {
  if (count === null) return 'count unknown'
  if (count === UNLIMITED_TILE_COUNT) return 'unlimited'
  return `${count} in box`
}

// A game's physical tiles as display text: "85 tiles in box · 3 unlimited · 1 count unknown". Unlimited and unknown designs are listed separately,
// because they cannot be added into the total.
export function boxText(game: GameSummary): string {
  // Games where every tile is unlimited (1817NA) skip "0 tiles in box".
  const onlyUnlimited = game.physicalTileCount === 0 && game.unlimitedTileCount > 0
  const parts = onlyUnlimited ? [] : [`${game.physicalTileCount} ${game.physicalTileCount === 1 ? 'tile' : 'tiles'} in box`]
  if (game.unlimitedTileCount > 0) parts.push(`${game.unlimitedTileCount} unlimited`)
  if (game.unknownCountTileCount > 0) parts.push(`${game.unknownCountTileCount} count unknown`)
  return parts.join(' · ')
}
