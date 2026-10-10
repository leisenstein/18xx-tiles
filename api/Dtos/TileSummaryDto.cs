using Tiles18xx.Api.Domain;

namespace Tiles18xx.Api.Dtos;

// One tile in a list. Init properties (not a positional record) so Dapper can
// convert SQLite integers to bool and int?.
public sealed record TileSummaryDto : ISortableTile
{
    public long Id { get; init; }
    public string Number { get; init; } = "";
    public string Color { get; init; } = "";
    public string DisplayName { get; init; } = "";
    public string DefinitionCode { get; init; } = "";
    public bool HasCity { get; init; }
    public bool HasTown { get; init; }

    // How many games use this tile.
    public int GameCount { get; init; }

    // Tiles of this kind in the box, only when the list is filtered by game. NULL = unknown.
    public int? CountInGame { get; init; }
}