using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Tiles18xx.Api.Auth;
using Tiles18xx.Api.Data.Repositories;
using Tiles18xx.Api.Domain;
using Tiles18xx.Api.Dtos;

namespace Tiles18xx.Api.Controllers;

// Admin-only routes: the change-request review queue, tile history, and import reports (DESIGN.md section 8).
// [Authorize(Roles = "Admin")]: not signed in -> 401; signed in without the Admin role -> 403 (forbidden).
[ApiController]
[Route("api/admin")]
[Authorize(Roles = AdminSeeder.AdminRole)]
public sealed class AdminController(ChangeRequestsRepository requests, ImportRunsRepository imports) : ControllerBase
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
