namespace Tiles18xx.Api.Dtos;

// A tile's content: what a change request proposes, and (in the review queue) what the tile looks like now. Stored as ChangeRequests.ProposedJson.
public sealed record TileContentDto
{
    public string Number { get; init; } = "";
    public string Color { get; init; } = "";
    public string DefinitionCode { get; init; } = "";

    // Optional name for a variant, shown as "#57 (Kansas City)" when other tiles already use the number. Empty: "#57" if the number is free, otherwise
    // "#57 (variant k)". For an Edit, empty keeps the current display name unless the number changes.
    public string? VariantName { get; init; }

    // The tile's display name, filled in when reading history snapshots ("#57 (Kansas City)"); ignored on input.
    public string? DisplayName { get; init; }

    // Games that use the tile, with box counts. For an Edit, null keeps the tile's current game links unchanged.
    public IReadOnlyList<TileGameLinkDto>? Games { get; init; }
}
