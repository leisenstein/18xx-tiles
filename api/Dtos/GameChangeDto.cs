namespace Tiles18xx.Api.Dtos;

// One saved change to a game's tile list, for the History page: who, when, why, and each tile added, removed, or changed.
public sealed record GameChangeDto
{
    public long Id { get; init; }
    public long GameId { get; init; }
    public string GameTitle { get; init; } = "";
    public string? ChangedByEmail { get; init; }
    public string ChangedUtc { get; init; } = "";
    public string? Reason { get; init; }
    public IReadOnlyList<GameTileChangeDto> Changes { get; init; } = [];
}
