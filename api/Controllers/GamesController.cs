using Microsoft.AspNetCore.Mvc;
using Tiles18xx.Api.Data.Repositories;
using Tiles18xx.Api.Dtos;

namespace Tiles18xx.Api.Controllers;

// Routes under /api/games.
[ApiController]
[Route("api/games")]
public sealed class GamesController(GamesRepository repo) : ControllerBase
{
    // GET /api/games -> all games with tile counts
    [HttpGet]
    public ActionResult<IReadOnlyList<GameSummaryDto>> GetAll() => Ok(repo.GetAll());

    // GET /api/games/5 -> one game, or 404 if it does not exist
    [HttpGet("{id:long}")]
    public ActionResult<GameSummaryDto> GetById(long id) =>
        repo.GetById(id) is { } game ? Ok(game) : NotFound();
}
