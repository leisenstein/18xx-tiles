import { UNLIMITED_TILE_COUNT } from '@/lib/constants'
import type { GameSummary } from '@/types/game'

// Largest box count you can type (Domain/TileCounts.MaxCount in the API); larger supplies are marked Unlimited instead.
export const MAX_TILE_COUNT = 100

// The count to save from a count box and its Unlimited checkbox: 999 when unlimited, null when empty (unknown), the number when it is 1 to 100, or
// undefined when the text is not valid. Used by Edit game tiles and Propose a game.
export function parseCount(text: string, unlimited: boolean): number | null | undefined {
  if (unlimited) return UNLIMITED_TILE_COUNT
  if (text.trim() === '') return null
  const n = Number(text)
  return Number.isInteger(n) && n >= 1 && n <= MAX_TILE_COUNT ? n : undefined
}

// How many of a tile come in a game's box, as display text (DESIGN.md section 7):
// null = unknown, 999 = unlimited, otherwise the number.
export function countText(count: number | null): string {
  if (count === null) return 'count unknown'
  if (count === UNLIMITED_TILE_COUNT) return 'unlimited'
  return `${count} in box`
}

// A game's designer and publisher as one line: "Francis Tresham · Lookout Games". Empty when neither is known.
export function creditsText(game: GameSummary): string {
  return [game.designer, game.publisher].filter(Boolean).join(' · ')
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
