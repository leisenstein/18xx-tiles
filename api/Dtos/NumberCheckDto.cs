namespace Tiles18xx.Api.Dtos;

// Result of GET /api/change-requests/number-check: who else uses a tile number, so the form can explain that a new tile becomes a variant.
public sealed record NumberCheckDto
{
    public string Number { get; init; } = "";

    // Live tiles that already use the number (with drawings' data), in the shared tile sort order.
    public IReadOnlyList<TileSummaryDto> Tiles { get; init; } = [];

    // Pending requests that propose a tile with this number.
    public IReadOnlyList<PendingNumberUseDto> PendingRequests { get; init; } = [];

    // The display name the tile would get if no variant name is given, e.g. "#57" or "#57 (variant 2)".
    public string DefaultDisplayName { get; init; } = "";
}
