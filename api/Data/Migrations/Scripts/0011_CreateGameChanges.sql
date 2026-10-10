-- Admin edits of a game's tile list (after Phase 4): which tiles a game uses, with counts and notes, saved as one change from the Edit game tiles
-- page. One row per save, for the History page. Tile-by-tile edits still go through ChangeRequests.
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
