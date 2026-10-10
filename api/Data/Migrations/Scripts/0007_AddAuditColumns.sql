-- Full audit trail (after Phase 4).

-- The tile as it was just before an approved Edit or Delete (number, color, definition, display name, games), so history can show "before" and "after".
ALTER TABLE ChangeRequests ADD COLUMN BeforeJson TEXT NULL;

-- Who made the tile's last change (the admin who approved it). CreatedBy already records who added a user tile.
ALTER TABLE Tiles ADD COLUMN UpdatedBy TEXT NULL;

-- A tile's history looks up its change requests by TileId.
CREATE INDEX IX_ChangeRequests_TileId ON ChangeRequests(TileId);
