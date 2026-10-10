namespace Tiles18xx.Api.Dtos;

// One game that uses a tile, in a change request. Count: NULL = unknown, 999 = unlimited, otherwise 1 to 100 (Domain/TileCounts).
// Title is filled in by the API when reading requests back, so pages can show game names; it is ignored on input.
public sealed record TileGameLinkDto
{
    public long GameId { get; init; }
    public int? Count { get; init; }
    public string? Notes { get; init; }
    public string? Title { get; init; }
}
