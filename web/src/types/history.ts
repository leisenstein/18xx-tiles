import type { ChangeRequest } from '@/types/changeRequest'
import type { GameChange } from '@/types/gameTiles'
import type { ImportRun } from '@/types/importRun'

// One line of the admin History page (matches HistoryEntryDto in the API): a change request, a data import, or a game tile list save.
// A discriminated union: checking kind tells TypeScript which of change, import, and game is set.
export type HistoryEntry =
  | { kind: 'change'; whenUtc: string; change: ChangeRequest; import: null; game: null }
  | { kind: 'import'; whenUtc: string; change: null; import: ImportRun; game: null }
  | { kind: 'game'; whenUtc: string; change: null; import: null; game: GameChange }
