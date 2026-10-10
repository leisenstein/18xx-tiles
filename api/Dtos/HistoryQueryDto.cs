namespace Tiles18xx.Api.Dtos;

// Query string for GET /api/admin/history, e.g. ?type=Edit&status=Approved&q=57&page=2
public sealed record HistoryQueryDto
{
    public const int MaxPageSize = 100;
    public const int MaxSearchLength = 100;
    public const string ImportType = "Import";

    public string? Type { get; init; }    // Add, Edit, Delete, or Import; empty = everything
    public string? Status { get; init; }  // Pending, Approved, Rejected; empty = all. Imports have no status, so a status hides them.
    public string? Q { get; init; }       // tile number or name, submitter's or reviewer's email, or the start of an import's commit hash
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 25;
}
