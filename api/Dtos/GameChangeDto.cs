namespace Tiles18xx.Api.Dtos;

// One change to a game, for the History page: who, when, why, and what. Kind: "tiles" (a saved tile list: each tile added, removed, or changed),
// "created" (New game), "edited" (title, designer, or publisher: Details), or "deleted" (Changes lists the tile links it had, as removed).
public sealed record GameChangeDto
{
    public long Id { get; init; }
    public long GameId { get; init; }
    public string GameTitle { get; init; } = "";
    public bool GameDeleted { get; init; }   // the game has since been deleted (its title is not linked)
    public string Kind { get; init; } = "tiles";
    public GameDetailsChangeDto? Details { get; init; }
    public string? ChangedByEmail { get; init; }
    public string ChangedUtc { get; init; } = "";
    public string? Reason { get; init; }
    public IReadOnlyList<GameTileChangeDto> Changes { get; init; } = [];
}
