namespace Tiles18xx.Api.Dtos;

// Body of POST /api/change-requests.
//   Add:    Tile required, TileId empty.
//   Edit:   TileId and Tile required.
//   Delete: TileId required, Tile empty.
// There is no Status here on purpose: the API decides it from the caller's role (DESIGN.md section 7).
public sealed record ChangeRequestSubmitDto
{
    public string Type { get; init; } = "";
    public long? TileId { get; init; }
    public TileContentDto? Tile { get; init; }
    public string? Reason { get; init; }
}
