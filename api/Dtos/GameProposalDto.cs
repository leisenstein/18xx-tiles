namespace Tiles18xx.Api.Dtos;

// A proposed new game (change request Type AddGame): its details and the existing tiles it uses, with box counts. Stored as ChangeRequests.ProposedJson.
// On input only each tile's TileId, Count, and Notes are read; when reading a request back, the API fills in the tile's number, color, display name, and
// definition so the tiles can be drawn.
public sealed record GameProposalDto
{
    public string Title { get; init; } = "";
    public string? Designer { get; init; }
    public string? Publisher { get; init; }  // one or more, comma-separated
    public IReadOnlyList<GameTileDto> Tiles { get; init; } = [];
}
