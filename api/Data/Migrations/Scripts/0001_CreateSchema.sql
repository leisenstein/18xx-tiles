-- Baseline schema for the 18xx Tiles app (DESIGN.md section 7). Created once, before the first production release, by combining the development
-- scripts 0001 to 0011 into their final shape (DESIGN.md open item 13). After the first release, every schema change is a new numbered script on top
-- of this one; released scripts are never edited or renumbered. The AspNet* tables are created separately by EF Core (Auth/Migrations).

-- Games, imported from tobymao/18xx (DataImporter). Not editable in the app; designer and publisher come from each game's meta.rb.
CREATE TABLE Games (
  Id          INTEGER PRIMARY KEY,
  Title       TEXT NOT NULL UNIQUE,
  SourceKey   TEXT NOT NULL UNIQUE,      -- folder name upstream, e.g. g_1830
  Designer    TEXT NULL,
  Publisher   TEXT NULL,                 -- one or more, comma-separated
  CreatedUtc  TEXT NOT NULL
);

-- Tiles: approved, live data only (pending work lives in ChangeRequests). Delete is soft (IsDeleted = 1), so history and links are kept.
CREATE TABLE Tiles (
  Id              INTEGER PRIMARY KEY,
  Number          TEXT NOT NULL,          -- not unique: versions share numbers
  Color           TEXT NOT NULL,          -- yellow, green, brown, gray, greenbrown, browngray, brownsepia, none, red, blue, purple, white, orange
  DefinitionCode  TEXT NOT NULL,          -- tobymao/18xx tile language, e.g. "city=revenue:20;path=a:0,b:_0"
  DisplayName     TEXT NOT NULL,          -- "#10", "#10 (1825)", "#10 (variant 2)"
  HasCity         INTEGER NOT NULL,       -- derived on save
  HasTown         INTEGER NOT NULL,       -- derived on save
  Source          TEXT NOT NULL,          -- 'generic', 'game-version', 'game-specific' (imported), or 'user' (added in the app)
  SourceRef       TEXT NULL,              -- imported tiles: "18xx.games commit <hash>"
  IsDeleted       INTEGER NOT NULL DEFAULT 0,
  CreatedBy       TEXT NULL,              -- user tiles: who proposed it (AspNetUsers.Id)
  CreatedUtc      TEXT NOT NULL,
  UpdatedUtc      TEXT NULL,              -- the last approved change
  UpdatedBy       TEXT NULL,              -- the admin who made or approved it
  UNIQUE (Number, Color, DefinitionCode)
);
CREATE INDEX IX_Tiles_Number ON Tiles(Number);
CREATE INDEX IX_Tiles_Color ON Tiles(Color);

-- Which tiles each game uses, and how many come in the box.
CREATE TABLE GameTiles (
  GameId  INTEGER NOT NULL REFERENCES Games(Id),
  TileId  INTEGER NOT NULL REFERENCES Tiles(Id),
  Count   INTEGER NULL,                   -- tiles included in the box; NULL = unknown; 999 = unlimited
  Notes   TEXT NULL,                      -- e.g. "Count from 18xx.games manifest", or different counts in other editions
  PRIMARY KEY (GameId, TileId)
);
CREATE INDEX IX_GameTiles_TileId ON GameTiles(TileId);   -- a tile's games, by TileId

-- Proposed and applied tile changes (Add, Edit, Delete), with the full audit trail.
CREATE TABLE ChangeRequests (
  Id              INTEGER PRIMARY KEY,
  Type            TEXT NOT NULL,          -- 'Add', 'Edit', 'Delete'
  TileId          INTEGER NULL REFERENCES Tiles(Id),   -- NULL for an Add until it is approved
  ProposedJson    TEXT NULL,              -- number, color, definition, variant name, game links
  BeforeJson      TEXT NULL,              -- the tile with its games just before an approved Edit or Delete, so history can show before and after
  Reason          TEXT NULL,              -- the submitter's explanation, shown to the reviewing admin
  Status          TEXT NOT NULL,          -- 'Pending', 'Approved', 'Rejected'
  SubmittedBy     TEXT NOT NULL,
  SubmittedUtc    TEXT NOT NULL,
  ReviewedBy      TEXT NULL,
  ReviewedUtc     TEXT NULL,
  ReviewNote      TEXT NULL
);
CREATE INDEX IX_ChangeRequests_Status ON ChangeRequests(Status);
CREATE INDEX IX_ChangeRequests_SubmittedBy ON ChangeRequests(SubmittedBy);   -- "My requests"
CREATE INDEX IX_ChangeRequests_TileId ON ChangeRequests(TileId);             -- a tile's history

-- One row per applied import of the seed files (DESIGN.md section 6.4). DataImporter skips data it has already applied (same DataHash).
CREATE TABLE ImportRuns (
  Id            INTEGER PRIMARY KEY,
  SourceCommit  TEXT NOT NULL,            -- tobymao/18xx commit the seed files came from
  CommittedUtc  TEXT NULL,                -- when that commit was made upstream
  DataHash      TEXT NULL,                -- SHA-256 of games.json and tiles.json (source.json dataHash)
  ImportedUtc   TEXT NOT NULL,
  Mode          TEXT NOT NULL,            -- 'seed' (empty database) or 'merge' (added to existing data)
  GamesAdded    INTEGER NOT NULL,
  TilesAdded    INTEGER NOT NULL,
  LinksAdded    INTEGER NOT NULL,
  CountsFilled  INTEGER NOT NULL,         -- empty GameTiles.Count values filled from the manifest
  NotesJson     TEXT NOT NULL             -- [{ kind, message }]: upstream changes not applied, renames, and other things to review
);
CREATE INDEX IX_ImportRuns_SourceCommit ON ImportRuns(SourceCommit);
CREATE INDEX IX_ImportRuns_DataHash ON ImportRuns(DataHash);
CREATE INDEX IX_ImportRuns_ImportedUtc ON ImportRuns(ImportedUtc);

-- Admin saves of a game's whole tile list (Edit game tiles page). One row per save, for the History page.
CREATE TABLE GameChanges (
  Id          INTEGER PRIMARY KEY,
  GameId      INTEGER NOT NULL REFERENCES Games(Id),
  ChangedBy   TEXT NOT NULL,             -- the admin (AspNetUsers.Id)
  ChangedUtc  TEXT NOT NULL,
  Reason      TEXT NULL,
  BeforeJson  TEXT NOT NULL,             -- the game's live tile links before the save: [{ tileId, count, notes }]
  AfterJson   TEXT NOT NULL              -- and after it
);
CREATE INDEX IX_GameChanges_GameId ON GameChanges(GameId);
