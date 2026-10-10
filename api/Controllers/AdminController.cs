using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Tiles18xx.Api.Auth;
using Tiles18xx.Api.Data.Repositories;
using Tiles18xx.Api.Domain;
using Tiles18xx.Api.Dtos;

namespace Tiles18xx.Api.Controllers;

// Admin-only routes: the change-request review queue, change history (all tiles and per tile), import reports, and a game's tile list (DESIGN.md section 8).
// [Authorize(Roles = "Admin")]: not signed in -> 401; signed in without the Admin role -> 403 (forbidden).
[ApiController]
[Route("api/admin")]
[Authorize(Roles = AdminSeeder.AdminRole)]
public sealed class AdminController(
    ChangeRequestsRepository requests, ImportRunsRepository imports, HistoryRepository history, GameTilesRepository gameTiles) : ControllerBase
{
    public const int MaxNoteLength = 1000;

    // GET /api/admin/ping -> proves the caller is an admin.
    [HttpGet("ping")]
    public IActionResult Ping() => Ok(new { status = "ok" });

    // GET /api/admin/change-requests?status=Pending -> requests with that status (Pending oldest first; others newest first).
    [HttpGet("change-requests")]
    public ActionResult<IReadOnlyList<ChangeRequestDto>> Queue([FromQuery] string status = ChangeRequestStatuses.Pending)
    {
        if (!ChangeRequestStatuses.IsKnown(status))
        {
            ModelState.AddModelError("status", "Status must be Pending, Approved, or Rejected.");
            return ValidationProblem();
        }
        return Ok(requests.GetByStatus(status));
    }

    // POST /api/admin/change-requests/5/approve -> applies the change and marks the request Approved, in one transaction. Optional body: { note }.
    // 404 if the request does not exist; 409 if it is not Pending, its tile is gone, or the result would duplicate another tile.
    [HttpPost("change-requests/{id:long}/approve")]
    public IActionResult Approve(long id, [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] ChangeRequestReviewDto? review)
    {
        var note = string.IsNullOrWhiteSpace(review?.Note) ? null : review.Note.Trim();
        if (note is { Length: > MaxNoteLength })
        {
            ModelState.AddModelError("note", $"The note must be {MaxNoteLength} characters or fewer.");
            return ValidationProblem();
        }
        return ToResponse(id, requests.Approve(id, ReviewerId(), note));
    }

    // POST /api/admin/change-requests/5/reject with { note } -> marks the request Rejected. A note is required, so the submitter knows why.
    [HttpPost("change-requests/{id:long}/reject")]
    public IActionResult Reject(long id, ChangeRequestReviewDto review)
    {
        var note = review.Note?.Trim() ?? "";
        if (note.Length is 0 or > MaxNoteLength)
        {
            ModelState.AddModelError("note", $"Explain why, in 1 to {MaxNoteLength} characters.");
            return ValidationProblem();
        }
        return ToResponse(id, requests.Reject(id, ReviewerId(), note));
    }

    // GET /api/admin/tiles/60/history -> who added the tile, its last change, and every change request about it (oldest first). Deleted tiles too.
    [HttpGet("tiles/{id:long}/history")]
    public ActionResult<TileHistoryDto> TileHistory(long id) => requests.GetHistory(id) is { } history ? Ok(history) : NotFound();

    // GET /api/admin/history?type=&status=&q=&page=&pageSize= -> every change request across all tiles and every data import, newest first, one page
    // at a time. type=Import shows only imports; a status filter shows only change requests (imports have no status).
    [HttpGet("history")]
    public ActionResult<PagedResultDto<HistoryEntryDto>> History([FromQuery] HistoryQueryDto query)
    {
        if (!string.IsNullOrEmpty(query.Type) && query.Type is not (HistoryQueryDto.ImportType or HistoryQueryDto.GameType)
            && !ChangeRequestTypes.IsKnown(query.Type))
        {
            ModelState.AddModelError("type", "Type must be Add, Edit, Delete, Import, or Game.");
        }
        if (!string.IsNullOrEmpty(query.Status) && !ChangeRequestStatuses.IsKnown(query.Status))
        {
            ModelState.AddModelError("status", "Status must be Pending, Approved, or Rejected.");
        }
        if (query.Q is { Length: > HistoryQueryDto.MaxSearchLength })
        {
            ModelState.AddModelError("q", $"Search text must be {HistoryQueryDto.MaxSearchLength} characters or fewer.");
        }
        if (query.Page < 1)
        {
            ModelState.AddModelError("page", "Page must be 1 or greater.");
        }
        if (query.PageSize is < 1 or > HistoryQueryDto.MaxPageSize)
        {
            ModelState.AddModelError("pageSize", $"Page size must be from 1 to {HistoryQueryDto.MaxPageSize}.");
        }
        if (!ModelState.IsValid)
        {
            return ValidationProblem();
        }
        return Ok(history.Search(query));
    }

    // GET /api/admin/games/25/tiles -> the game and every live tile it uses, with counts and notes (Edit game tiles page).
    [HttpGet("games/{id:long}/tiles")]
    public ActionResult<GameTilesDto> GameTiles(long id) => gameTiles.Get(id) is { } game ? Ok(game) : NotFound();

    // PUT /api/admin/games/25/tiles with { tiles: [{ tileId, count, notes }], reason } -> replaces the game's tile list (tiles left out are removed),
    // in one transaction with one History entry. 404 if the game does not exist; 409 if nothing changed.
    [HttpPut("games/{id:long}/tiles")]
    public IActionResult SaveGameTiles(long id, GameTilesUpdateDto body)
    {
        var tiles = body.Tiles.Select(t => t with { Notes = string.IsNullOrWhiteSpace(t.Notes) ? null : t.Notes.Trim() }).ToList();
        var reason = string.IsNullOrWhiteSpace(body.Reason) ? null : body.Reason.Trim();
        if (tiles.GroupBy(t => t.TileId).Any(g => g.Count() > 1))
        {
            ModelState.AddModelError("tiles", "Each tile can appear only once.");
        }
        foreach (var missing in gameTiles.NotLiveTileIds(tiles.Select(t => t.TileId)))
        {
            ModelState.AddModelError("tiles", $"Tile {missing} does not exist or has been deleted.");
        }
        if (tiles.Any(t => !TileCounts.IsValid(t.Count)))
        {
            ModelState.AddModelError("tiles", $"A count must be empty (unknown), 1 to {TileCounts.MaxCount}, or {TileCounts.Unlimited} (unlimited).");
        }
        if (tiles.Any(t => t.Notes is { Length: > ChangeRequestsController.MaxNotesLength }))
        {
            ModelState.AddModelError("tiles", $"Notes must be {ChangeRequestsController.MaxNotesLength} characters or fewer.");
        }
        if (reason is { Length: > MaxNoteLength })
        {
            ModelState.AddModelError("reason", $"The reason must be {MaxNoteLength} characters or fewer.");
        }
        if (!ModelState.IsValid)
        {
            return ValidationProblem();
        }
        var result = gameTiles.Save(id, tiles, ReviewerId(), reason);
        if (!result.Found)
        {
            return NotFound();
        }
        return result.Succeeded ? Ok(gameTiles.Get(id)) : Problem(statusCode: StatusCodes.Status409Conflict, title: "Not changed", detail: result.Message);
    }

    // GET /api/admin/imports -> every import of the tobymao/18xx seed files, newest first, with notes about upstream changes that were not applied.
    [HttpGet("imports")]
    public ActionResult<IReadOnlyList<ImportRunDto>> Imports() => Ok(imports.GetAll());

    private string ReviewerId() => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    private IActionResult ToResponse(long id, ReviewResult result)
    {
        if (!result.Found)
        {
            return NotFound();
        }
        if (!result.Succeeded)
        {
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "Not changed", detail: result.Message);
        }
        return Ok(requests.GetById(id));
    }
}
