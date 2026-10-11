namespace Tiles18xx.Api.Dtos;

// One game as returned by the API.
// - TileCount: distinct tiles linked to the game (tile designs, not physical tiles).
// - PhysicalTileCount: total tiles in the box, adding up each link's count; unlimited tiles are not included.
// - UnlimitedTileCount: tile designs with an unlimited supply (count 999).
// - UnknownCountTileCount: tile designs with no count recorded.
// - ColorCounts: tile designs of each color the game uses, keyed by Tiles.Color ("yellow", "greenbrown", "red", ...); they add up to TileCount.
//   The Games page draws them as the game's color strip.
public sealed record GameSummaryDto
{
    public long Id { get; init; }
    public string Title { get; init; } = "";
    public string? Designer { get; init; }
    public string? Publisher { get; init; }
    public long TileCount { get; init; }
    public long PhysicalTileCount { get; init; }
    public long UnlimitedTileCount { get; init; }
    public long UnknownCountTileCount { get; init; }
    public IReadOnlyDictionary<string, long> ColorCounts { get; init; } = new Dictionary<string, long>();
}
