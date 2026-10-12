-- Games added, edited, and deleted in the app by admins (Phase 5; DESIGN.md section 7). The first schema change after the baseline (0001).

-- Deleted by an admin: hidden from every list. Its tile links are removed (and kept in the GameChanges row), and imports never add it back.
ALTER TABLE Games ADD COLUMN IsDeleted INTEGER NOT NULL DEFAULT 0;
-- The last change to the title, designer, or publisher made in the app. Once set, imports keep the app's values (the "never overwrite edits" rule).
ALTER TABLE Games ADD COLUMN UpdatedUtc TEXT NULL;
ALTER TABLE Games ADD COLUMN UpdatedBy TEXT NULL;

-- What a GameChanges row records: 'tiles' (a saved tile list; all rows before this script), 'created', 'edited' (title, designer, or publisher),
-- or 'deleted' (BeforeJson then holds the tile links the game had).
ALTER TABLE GameChanges ADD COLUMN Kind TEXT NOT NULL DEFAULT 'tiles';
-- 'edited' only: { "before": { "title", "designer", "publisher" }, "after": { ... } }.
ALTER TABLE GameChanges ADD COLUMN DetailsJson TEXT NULL;
