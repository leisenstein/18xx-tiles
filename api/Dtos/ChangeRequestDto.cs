namespace Tiles18xx.Api.Dtos;

// One change request as returned by the API (my requests, the admin review queue, and the result of submitting).
public sealed record ChangeRequestDto
{
    public long Id { get; init; }
    public string Type { get; init; } = "";   // Add, Edit, Delete
    public string Status { get; init; } = ""; // Pending, Approved, Rejected

    // The tile the request is about. For an Add, set once it is approved.
    public long? TileId { get; init; }
    public string? TileDisplayName { get; init; }

    // The tile as it is now (Edit, Delete) and as proposed (Add, Edit), for before/after drawings.
    public TileContentDto? Current { get; init; }
    public TileContentDto? Proposed { get; init; }

    // For an approved Edit or Delete: the tile just before the change (audit trail). Empty for requests approved before the audit trail existed.
    public TileContentDto? Before { get; init; }

    public string? Reason { get; init; }
    public string? SubmittedByEmail { get; init; }
    public string SubmittedUtc { get; init; } = "";
    public string? ReviewedByEmail { get; init; }
    public string? ReviewedUtc { get; init; }
    public string? ReviewNote { get; init; }
}
