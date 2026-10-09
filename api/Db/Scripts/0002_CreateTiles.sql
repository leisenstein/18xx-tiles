CREATE TABLE Tiles (
  Id              INTEGER PRIMARY KEY,
  Number          TEXT NOT NULL,          -- not unique: versions share numbers
  Color           TEXT NOT NULL,          -- yellow, green, brown, gray, greenbrown, browngray, brownsepia, none
  DefinitionCode  TEXT NOT NULL,
  DisplayName     TEXT NOT NULL,          -- "#10", "#10 (1825)", "#10 (variant 2)"
  HasCity         INTEGER NOT NULL,       -- derived on save
  HasTown         INTEGER NOT NULL,       -- derived on save
  Source          TEXT NOT NULL,          -- 'generic', 'game-version', 'user'
  SourceRef       TEXT NULL,              -- e.g. commit hash and file path
  IsDeleted       INTEGER NOT NULL DEFAULT 0,
  CreatedBy       TEXT NULL,
  CreatedUtc      TEXT NOT NULL,
  UpdatedUtc      TEXT NULL,
  UNIQUE (Number, Color, DefinitionCode)
);
CREATE INDEX IX_Tiles_Number ON Tiles(Number);
CREATE INDEX IX_Tiles_Color ON Tiles(Color);
