namespace Tiles18xx.Api.Dtos;

// One game as returned by the API.
// TileCount = number of distinct tiles linked to the game (not physical tile counts).
public sealed record GameSummaryDto(
    long Id,
    string Title,
    string? Designer,
    string? Publisher,
    string? DevStage,
    long TileCount);