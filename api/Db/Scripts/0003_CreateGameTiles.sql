CREATE TABLE GameTiles (
  GameId  INTEGER NOT NULL REFERENCES Games(Id),
  TileId  INTEGER NOT NULL REFERENCES Tiles(Id),
  Count   INTEGER NULL,                   -- tiles included in the box; NULL = unknown; 999 = unlimited
  Notes   TEXT NULL,                      -- e.g. different counts in other editions or printings
  PRIMARY KEY (GameId, TileId)
);
-- Not in the design doc: supports looking up a tile's games by TileId.
CREATE INDEX IX_GameTiles_TileId ON GameTiles(TileId);
