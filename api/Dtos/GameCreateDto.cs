namespace Tiles18xx.Api.Dtos;

// Body of POST /api/admin/games (New game) and PUT /api/admin/games/{id} (Edit game). A new game's tiles are added afterwards on the Edit game tiles
// page. Reason is used only by an edit (shown on the History page).
public sealed record GameCreateDto
{
    public string Title { get; init; } = "";
    public string? Designer { get; init; }
    public string? Publisher { get; init; }  // one or more, comma-separated
    public string? Reason { get; init; }
}
