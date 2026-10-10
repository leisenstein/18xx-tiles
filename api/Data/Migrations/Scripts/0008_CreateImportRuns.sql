-- One row per import of the seed files (DESIGN.md section 6.4). At startup the API compares the seed files' commit (source.json) with this table and
-- imports only a commit it has not applied yet.
CREATE TABLE ImportRuns (
  Id            INTEGER PRIMARY KEY,
  SourceCommit  TEXT NOT NULL UNIQUE,     -- tobymao/18xx commit hash the seed files came from
  CommittedUtc  TEXT NULL,                -- when that commit was made upstream
  ImportedUtc   TEXT NOT NULL,
  Mode          TEXT NOT NULL,            -- 'seed' (empty database) or 'merge' (added to existing data)
  GamesAdded    INTEGER NOT NULL,
  TilesAdded    INTEGER NOT NULL,
  LinksAdded    INTEGER NOT NULL,
  CountsFilled  INTEGER NOT NULL,         -- empty GameTiles.Count values filled from the manifest
  NotesJson     TEXT NOT NULL             -- [{ kind, message }]: upstream changes not applied, renames, and other things to review
);
