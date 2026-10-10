-- History of imports (after Phase 4): every import, including the first one, appears in the admin History.
-- 1. Allow the same commit more than once: a database seeded before ImportRuns existed gets a backfilled "seed" row and a later "merge" row for the
--    same commit. SQLite cannot drop a UNIQUE constraint, so the table is rebuilt. DataImporter still applies each commit only once.
CREATE TABLE ImportRuns_New (
  Id            INTEGER PRIMARY KEY,
  SourceCommit  TEXT NOT NULL,            -- tobymao/18xx commit hash the seed files came from
  CommittedUtc  TEXT NULL,                -- when that commit was made upstream
  ImportedUtc   TEXT NOT NULL,
  Mode          TEXT NOT NULL,            -- 'seed' (empty database) or 'merge' (added to existing data)
  GamesAdded    INTEGER NOT NULL,
  TilesAdded    INTEGER NOT NULL,
  LinksAdded    INTEGER NOT NULL,
  CountsFilled  INTEGER NOT NULL,         -- empty GameTiles.Count values filled from the manifest
  NotesJson     TEXT NOT NULL             -- [{ kind, message }]: upstream changes not applied, renames, and other things to review
);
INSERT INTO ImportRuns_New SELECT * FROM ImportRuns;
DROP TABLE ImportRuns;
ALTER TABLE ImportRuns_New RENAME TO ImportRuns;
CREATE INDEX IX_ImportRuns_SourceCommit ON ImportRuns(SourceCommit);
CREATE INDEX IX_ImportRuns_ImportedUtc ON ImportRuns(ImportedUtc);

-- 2. Backfill the first import for a database seeded before ImportRuns existed: rebuilt from the imported tiles' creation time and SourceRef.
--    Does nothing on a new database (no tiles yet) or when a seed row already exists.
INSERT INTO ImportRuns (SourceCommit, CommittedUtc, ImportedUtc, Mode, GamesAdded, TilesAdded, LinksAdded, CountsFilled, NotesJson)
SELECT substr(first.SourceRef, length('18xx.games commit ') + 1),
       NULL,
       first.CreatedUtc,
       'seed',
       (SELECT COUNT(*) FROM Games WHERE CreatedUtc = first.CreatedUtc),
       (SELECT COUNT(*) FROM Tiles WHERE CreatedUtc = first.CreatedUtc AND Source <> 'user'),
       (SELECT COUNT(*) FROM GameTiles gt JOIN Tiles t ON t.Id = gt.TileId WHERE t.CreatedUtc = first.CreatedUtc AND t.Source <> 'user'),
       0,
       '[{"kind":"backfilled","message":"Recorded later from the imported tiles'' creation time; the first import ran before the import log existed. Link count is as of the backfill."}]'
FROM (SELECT CreatedUtc, SourceRef FROM Tiles WHERE Source <> 'user' AND SourceRef LIKE '18xx.games commit %' ORDER BY CreatedUtc, Id LIMIT 1) AS first
WHERE NOT EXISTS (SELECT 1 FROM ImportRuns WHERE Mode = 'seed');
