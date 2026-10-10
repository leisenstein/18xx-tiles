namespace Tiles18xx.Api.Dtos;

// One game as returned by the API.
// - TileCount: distinct tiles linked to the game (tile designs, not physical tiles).
// - PhysicalTileCount: total tiles in the box, adding up each link's count; unlimited tiles are not included.
// - UnlimitedTileCount: tile designs with an unlimited supply (count 999).
// - UnknownCountTileCount: tile designs with no count recorded.
// - Yellow/Green/Brown/GrayTileCount: tile designs of each main color (the Games page shows the mix as a strip); other colors are the rest of TileCount.
public sealed record GameSummaryDto(
    long Id,
    string Title,
    string? Designer,
    string? Publisher,
    long TileCount,
    long PhysicalTileCount,
    long UnlimitedTileCount,
    long UnknownCountTileCount,
    long YellowTileCount,
    long GreenTileCount,
    long BrownTileCount,
    long GrayTileCount);
