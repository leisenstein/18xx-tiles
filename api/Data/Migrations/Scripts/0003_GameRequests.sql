-- Signed-in users can propose a new game (DESIGN.md section 7). The proposal is a change request of Type 'AddGame', reviewed in the same queue as tiles.
-- Its ProposedJson holds { "title", "designer", "publisher", "tiles": [{ "tileId", "count", "notes" }] }, and TileId stays NULL.

-- 'AddGame' only: the game that approving the request created, so My requests and History can link to it.
ALTER TABLE ChangeRequests ADD COLUMN GameId INTEGER NULL REFERENCES Games(Id);
