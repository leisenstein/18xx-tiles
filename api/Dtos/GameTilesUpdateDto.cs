namespace Tiles18xx.Api.Dtos;

// Body of PUT /api/admin/games/{id}/tiles: the complete new tile list for the game (tiles left out are removed from it), and an optional reason.
public sealed record GameTilesUpdateDto
{
    public List<GameTileInputDto> Tiles { get; init; } = [];
    public string? Reason { get; init; }
}
