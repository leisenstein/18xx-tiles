// One import of the tobymao/18xx seed files (DESIGN.md section 6.4). Matches ImportRunDto and ImportNoteDto in the API.

// kind: game-renamed, game-not-renamed, game-not-upstream, generic-changed, definition-changed, deleted-in-app, count-differs, or not-upstream.
export interface ImportNote {
  kind: string
  message: string
}

export interface ImportRun {
  id: number
  sourceCommit: string
  committedUtc: string | null
  importedUtc: string
  mode: 'seed' | 'merge' // seed = empty database; merge = added to existing data
  gamesAdded: number
  tilesAdded: number
  linksAdded: number
  countsFilled: number
  notes: ImportNote[]
}
