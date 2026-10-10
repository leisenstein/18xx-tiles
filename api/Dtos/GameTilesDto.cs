namespace Tiles18xx.Api.Dtos;

// GET /api/admin/games/{id}/tiles: a game and every live tile it uses, sorted like the tile list.
public sealed record GameTilesDto(long GameId, string Title, IReadOnlyList<GameTileDto> Tiles);
