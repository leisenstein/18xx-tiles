namespace Tiles18xx.Api.Dtos;

// One game that uses a tile, with the box count for that game.
public sealed record TileGameDto
{
    public long GameId { get; init; }
    public string Title { get; init; } = "";

    // Tiles in the box: NULL = unknown, 999 = unlimited.
    public int? Count { get; init; }
    public string? Notes { get; init; }
}
