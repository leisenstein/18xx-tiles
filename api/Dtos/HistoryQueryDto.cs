namespace Tiles18xx.Api.Dtos;

// Query string for GET /api/admin/history, e.g. ?type=Edit&status=Approved&q=57&page=2
public sealed record HistoryQueryDto
{
    public const int MaxPageSize = 100;
    public const int MaxSearchLength = 100;
    public const string ImportType = "Import";
    public const string GameType = "Game";

    public string? Type { get; init; }    // Add, Edit, Delete, Import, or Game (game tile list saves); empty = everything
    public string? Status { get; init; }  // Pending, Approved, Rejected; empty = all. Imports and game saves have no status, so a status hides them.
    public string? Q { get; init; }       // tile number or name, an email, a game title (game saves), or the start of an import's commit hash
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 25;
}
