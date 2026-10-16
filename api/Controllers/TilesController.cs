using Microsoft.AspNetCore.Mvc;
using Tiles18xx.Api.Data.Repositories;
using Tiles18xx.Api.Domain;
using Tiles18xx.Api.Dtos;

namespace Tiles18xx.Api.Controllers;

// Routes under /api/tiles.
[ApiController]
[Route("api/tiles")]
public sealed class TilesController(TilesRepository tiles, GamesRepository games) : ControllerBase
{
    // GET /api/tiles?game=&color=&kind=city|town|none&exits=0..6&revenue=&minGames=&q=&page=&pageSize=
    [HttpGet]
    public ActionResult<PagedResultDto<TileSummaryDto>> Search([FromQuery] TileQueryDto query)
    {
        // Check every input explicitly; report all problems at once as a 400.
        if (query.Color is not null && !TileColors.IsKnown(query.Color))
        {
            ModelState.AddModelError("color", $"Unknown color '{query.Color}'.");
        }
        if (query.Kind is not null && query.Kind is not ("city" or "town" or "none"))
        {
            ModelState.AddModelError("kind", "Kind must be 'city', 'town', or 'none'.");
        }
        if (query.Revenue is < 0)
        {
            ModelState.AddModelError("revenue", "Revenue must be 0 or more.");
        }
        if (query.MinGames is < 1 or > TileQueryDto.MaxMinGames)
        {
            ModelState.AddModelError("minGames", $"Minimum games must be from 1 to {TileQueryDto.MaxMinGames}.");
        }
        if (query.Exits is < 0 or > TileDefinition.MaxExits)
        {
            ModelState.AddModelError("exits", $"Exits must be from 0 to {TileDefinition.MaxExits}.");
        }
        if (query.Q is { Length: > TileQueryDto.MaxSearchLength })
        {
            ModelState.AddModelError("q", $"Search text must be {TileQueryDto.MaxSearchLength} characters or fewer.");
        }
        if (query.Page < 1)
        {
            ModelState.AddModelError("page", "Page must be 1 or greater.");
        }
        if (query.PageSize is < 1 or > TileQueryDto.MaxPageSize)
        {
            ModelState.AddModelError("pageSize", $"Page size must be from 1 to {TileQueryDto.MaxPageSize}.");
        }
        if (query.Game is long gameId && games.GetById(gameId) is null)
        {
            ModelState.AddModelError("game", $"Game {gameId} does not exist.");
        }
        if (!ModelState.IsValid)
        {
            return ValidationProblem();
        }

        return Ok(tiles.Search(query));
    }

    // GET /api/tiles/revenues -> every revenue amount any live tile can pay, lowest first (the Revenue filter's choices).
    [HttpGet("revenues")]
    public ActionResult<IReadOnlyList<int>> GetRevenues() => Ok(tiles.GetRevenues());

    // Allowed range for minGames on the Common Tiles page (DESIGN.md 9.3).
    public const int MinGamesLowest = 2;
    public const int MinGamesHighest = 200;

    // GET /api/tiles/common?minGames=10 -> tiles used by at least minGames games.
    // A non-numeric minGames is rejected with a 400 by [ApiController] before this runs.
    [HttpGet("common")]
    public ActionResult<IReadOnlyList<TileSummaryDto>> GetCommon([FromQuery] int minGames = 10)
    {
        if (minGames is < MinGamesLowest or > MinGamesHighest)
        {
            ModelState.AddModelError("minGames", $"minGames must be a whole number from {MinGamesLowest} to {MinGamesHighest}.");
            return ValidationProblem();
        }

        return Ok(tiles.GetCommon(minGames));
    }

    // GET /api/tiles/60 -> one tile, or 404 if it does not exist
    [HttpGet("{id:long}")]
    public ActionResult<TileDetailDto> GetById(long id) => tiles.GetById(id) is { } tile ? Ok(tile) : NotFound();
}