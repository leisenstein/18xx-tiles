namespace Tiles18xx.Api.Dtos;

// One tile in a game's tile list, for the Edit game tiles page. Count: NULL = unknown, 999 = unlimited, otherwise 1 to 100 (Domain/TileCounts).
public sealed record GameTileDto
{
    public long TileId { get; init; }
    public string Number { get; init; } = "";
    public string Color { get; init; } = "";
    public string DisplayName { get; init; } = "";
    public string DefinitionCode { get; init; } = "";
    public int? Count { get; init; }
    public string? Notes { get; init; }
}
