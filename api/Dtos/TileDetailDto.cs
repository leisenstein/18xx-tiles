namespace Tiles18xx.Api.Dtos;

// Everything the tile detail page needs.
public sealed record TileDetailDto
{
    public long Id { get; init; }
    public string Number { get; init; } = "";
    public string Color { get; init; } = "";
    public string DisplayName { get; init; } = "";
    public string DefinitionCode { get; init; } = "";
    public bool HasCity { get; init; }
    public bool HasTown { get; init; }
    public string Source { get; init; } = "";      // generic, game-version, game-specific, user
    public string? SourceRef { get; init; }

    // Games that use this tile, sorted by title.
    public IReadOnlyList<TileGameDto> Games { get; init; } = [];

    // Other tiles with the same number (other versions), in the shared tile sort order.
    public IReadOnlyList<TileSummaryDto> OtherVersions { get; init; } = [];
}
