namespace Tiles18xx.Api.Dtos;

// One tile in a saved game tile list: which tile, its count (NULL = unknown, 999 = unlimited), and optional notes. Also the stored shape in
// GameChanges.BeforeJson and AfterJson.
public sealed record GameTileInputDto
{
    public long TileId { get; init; }
    public int? Count { get; init; }
    public string? Notes { get; init; }
}
