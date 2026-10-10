namespace Tiles18xx.Api.Dtos;

// One tile's change in a game tile list save: Kind is added, removed, or changed (count or notes). Before is empty for added; After for removed.
public sealed record GameTileChangeDto
{
    public const string Added = "added";
    public const string Removed = "removed";
    public const string Changed = "changed";

    public string Kind { get; init; } = "";
    public long TileId { get; init; }
    public string DisplayName { get; init; } = "";
    public string Number { get; init; } = "";
    public string Color { get; init; } = "";
    public string DefinitionCode { get; init; } = "";
    public int? BeforeCount { get; init; }
    public string? BeforeNotes { get; init; }
    public int? AfterCount { get; init; }
    public string? AfterNotes { get; init; }
}
