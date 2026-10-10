-- Re-apply seed files when the data changes, not only when the tobymao/18xx commit does (after Phase 4).
-- update_data.py writes a hash of games.json and tiles.json to source.json; an improved parser can change the data for the same commit (for example
-- adding designers and publishers). DataImporter skips a run only when a previous run has the same hash. Older rows have NULL.
ALTER TABLE ImportRuns ADD COLUMN DataHash TEXT NULL;
CREATE INDEX IX_ImportRuns_DataHash ON ImportRuns(DataHash);
