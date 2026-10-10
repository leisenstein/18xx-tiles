-- DevStage was 18xx.games' own implementation status (production, beta, alpha, prealpha).
-- It describes their site, not this project, so the column is removed.
ALTER TABLE Games DROP COLUMN DevStage;
