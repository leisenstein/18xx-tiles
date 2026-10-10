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
    // GET /api/tiles?game=&color=&kind=city|town&q=&page=&pageSize=
    [HttpGet]
    public ActionResult<PagedResultDto<TileSummaryDto>> Search([FromQuery] TileQueryDto query)
    {
        // Check every input explicitly; report all problems at once as a 400.
        if (query.Color is not null && !TileColors.IsKnown(query.Color))
        {
            ModelState.AddModelError("color", $"Unknown color '{query.Color}'.");
        }
        if (query.Kind is not null && query.Kind is not ("city" or "town"))
        {
            ModelState.AddModelError("kind", "Kind must be 'city' or 'town'.");
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

    // GET /api/tiles/60 -> one tile, or 404 if it does not exist
    [HttpGet("{id:long}")]
    public ActionResult<TileDetailDto> GetById(long id) =>
        tiles.GetById(id) is { } tile ? Ok(tile) : NotFound();
}