CREATE TABLE ChangeRequests (
  Id              INTEGER PRIMARY KEY,
  Type            TEXT NOT NULL,          -- 'Add', 'Edit', 'Delete'
  TileId          INTEGER NULL REFERENCES Tiles(Id),   -- NULL for Add
  ProposedJson    TEXT NULL,              -- number, color, definition, game links
  Status          TEXT NOT NULL,          -- 'Pending', 'Approved', 'Rejected'
  SubmittedBy     TEXT NOT NULL,
  SubmittedUtc    TEXT NOT NULL,
  ReviewedBy      TEXT NULL,
  ReviewedUtc     TEXT NULL,
  ReviewNote      TEXT NULL
);
CREATE INDEX IX_ChangeRequests_Status ON ChangeRequests(Status);
