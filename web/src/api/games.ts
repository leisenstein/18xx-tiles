import type { GameSummary } from '@/types/game'
import { getJson } from './client'

// API calls for games. Pages call these instead of using fetch directly, so
// URLs and response types are defined in one place.

// All games with tile counts (GET /api/games).
export const getGames = () => getJson<GameSummary[]>('/api/games')

// One game by id (GET /api/games/{id}). Throws if the game does not exist (404).
export const getGame = (id: number) => getJson<GameSummary>(`/api/games/${id}`)
