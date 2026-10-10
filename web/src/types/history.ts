import type { ChangeRequest } from '@/types/changeRequest'
import type { ImportRun } from '@/types/importRun'

// One line of the admin History page (matches HistoryEntryDto in the API): a change request or a data import.
// A discriminated union: checking kind tells TypeScript which of change and import is set.
export type HistoryEntry =
  { kind: 'change'; whenUtc: string; change: ChangeRequest; import: null } | { kind: 'import'; whenUtc: string; change: null; import: ImportRun }
