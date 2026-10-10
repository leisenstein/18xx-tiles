using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Tiles18xx.Api.Auth;
using Tiles18xx.Api.Data.Repositories;
using Tiles18xx.Api.Domain;
using Tiles18xx.Api.Dtos;

namespace Tiles18xx.Api.Controllers;

// Proposing changes to tiles (DESIGN.md sections 7 and 8). Any signed-in user can propose a new tile (Add); it waits for an admin (Pending). Editing and
// deleting existing tiles is for admins only. An admin's request is applied immediately (Approved by that admin), so every change has an audit row.
[ApiController]
[Route("api/change-requests")]
[Authorize]
public sealed class ChangeRequestsController(ChangeRequestsRepository requests) : ControllerBase
{
    public const int MaxNumberLength = 20;
    public const int MaxVariantNameLength = 40;
    public const int MaxNotesLength = 500;
    public const int MaxReasonLength = 1000;

    // POST /api/change-requests -> 201 with the stored request (Pending, or Approved for an admin); 400 for invalid input; 403 for an Edit or Delete by a
    // non-admin; 409 for a duplicate tile.
    [HttpPost]
    [EnableRateLimiting("submissions")]
    public ActionResult<ChangeRequestDto> Submit(ChangeRequestSubmitDto body)
    {
        // Only admins may change or remove existing tiles; everyone else may only propose new ones.
        if (body.Type is ChangeRequestTypes.Edit or ChangeRequestTypes.Delete && !User.IsInRole(AdminSeeder.AdminRole))
        {
            return Problem(statusCode: StatusCodes.Status403Forbidden, title: "Not allowed", detail: "Only admins can edit or delete tiles.");
        }

        var tile = Normalize(body.Tile);
        var reason = string.IsNullOrWhiteSpace(body.Reason) ? null : body.Reason.Trim();
        Validate(body, tile, reason);
        if (!ModelState.IsValid)
        {
            return ValidationProblem();
        }

        // Catch a duplicate now rather than at approval. For an Edit, the tile being edited does not count as a duplicate of itself.
        var tileId = body.Type == ChangeRequestTypes.Add ? null : body.TileId;
        if (tile is not null && requests.FindConflict(tile, tileId) is { } conflict)
        {
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "Duplicate tile", detail: conflict);
        }

        // The submitter's id comes from the sign-in cookie, never from the request body.
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var id = requests.Create(body.Type, tileId, tile, reason, userId);

        if (User.IsInRole(AdminSeeder.AdminRole))
        {
            var result = requests.Approve(id, userId, "Applied directly by an admin.");
            if (!result.Succeeded)
            {
                return Problem(statusCode: StatusCodes.Status409Conflict, title: "Not applied",
                    detail: $"Saved as request {id}, but it could not be applied: {result.Message}");
            }
        }

        return StatusCode(StatusCodes.Status201Created, requests.GetById(id));
    }

    // GET /api/change-requests/number-check?number=57&exceptTileId=12 -> live tiles and Pending requests that use this number, and the default display
    // name. The form calls this while you type, to warn that the tile will become a variant. exceptTileId leaves out the tile being edited.
    [HttpGet("number-check")]
    public ActionResult<NumberCheckDto> NumberCheck([FromQuery] string? number, [FromQuery] long? exceptTileId)
    {
        var trimmed = number?.Trim() ?? "";
        if (trimmed.Length is 0 or > MaxNumberLength)
        {
            ModelState.AddModelError("number", $"The tile number is required, up to {MaxNumberLength} characters.");
            return ValidationProblem();
        }
        return Ok(requests.CheckNumber(trimmed, exceptTileId, User.FindFirstValue(ClaimTypes.NameIdentifier)!));
    }

    // GET /api/change-requests/mine -> the signed-in user's requests, newest first.
    [HttpGet("mine")]
    public ActionResult<IReadOnlyList<ChangeRequestDto>> Mine() => Ok(requests.GetBySubmitter(User.FindFirstValue(ClaimTypes.NameIdentifier)!));

    // Trim text so " 57 " and "57" are the same tile; empty notes become null.
    private static TileContentDto? Normalize(TileContentDto? tile) => tile is null ? null : tile with
    {
        Number = tile.Number.Trim(),
        Color = tile.Color.Trim(),
        DefinitionCode = tile.DefinitionCode.Trim(),
        VariantName = string.IsNullOrWhiteSpace(tile.VariantName) ? null : tile.VariantName.Trim(),
        DisplayName = null, // set by the API, never taken from input
        Games = tile.Games?.Select(g => g with { Notes = string.IsNullOrWhiteSpace(g.Notes) ? null : g.Notes.Trim(), Title = null }).ToList(),
    };

    // Explicit checks for every field; all problems are reported together as a 400.
    private void Validate(ChangeRequestSubmitDto body, TileContentDto? tile, string? reason)
    {
        if (!ChangeRequestTypes.IsKnown(body.Type))
        {
            ModelState.AddModelError("type", "Type must be Add, Edit, or Delete.");
            return;
        }

        switch (body.Type)
        {
            case ChangeRequestTypes.Add:
                if (body.TileId is not null) ModelState.AddModelError("tileId", "Leave tileId empty when adding a tile.");
                if (tile is null) ModelState.AddModelError("tile", "Describe the tile to add.");
                break;
            case ChangeRequestTypes.Edit:
                RequireLiveTile(body.TileId);
                if (tile is null) ModelState.AddModelError("tile", "Describe the changed tile.");
                break;
            case ChangeRequestTypes.Delete:
                RequireLiveTile(body.TileId);
                if (tile is not null) ModelState.AddModelError("tile", "Leave tile empty when deleting.");
                break;
        }

        if (tile is not null)
        {
            ValidateTile(tile, body.Type == ChangeRequestTypes.Edit ? body.TileId : null);
        }
        if (reason is { Length: > MaxReasonLength })
        {
            ModelState.AddModelError("reason", $"The reason must be {MaxReasonLength} characters or fewer.");
        }
    }

    private void RequireLiveTile(long? tileId)
    {
        if (tileId is null)
        {
            ModelState.AddModelError("tileId", "Say which tile (tileId).");
        }
        else if (!requests.IsLiveTile(tileId.Value))
        {
            ModelState.AddModelError("tileId", $"Tile {tileId} does not exist or has been deleted.");
        }
    }

    private void ValidateTile(TileContentDto tile, long? editedTileId)
    {
        if (tile.Number.Length is 0 or > MaxNumberLength)
        {
            ModelState.AddModelError("tile.number", $"The tile number is required, up to {MaxNumberLength} characters.");
        }
        // Variant names become part of "#57 (name)", so they must be short and free of parentheses, and not already used for that number.
        if (tile.VariantName is { } variant)
        {
            if (variant.Length > MaxVariantNameLength || variant.Contains('(') || variant.Contains(')'))
            {
                ModelState.AddModelError("tile.variantName", $"The variant name must be up to {MaxVariantNameLength} characters, without parentheses.");
            }
            else if (tile.Number.Length > 0 && requests.IsVariantNameTaken(tile.Number, variant, editedTileId))
            {
                var name = ChangeRequestsRepository.VariantDisplayName(tile.Number, variant);
                ModelState.AddModelError("tile.variantName", $"Another tile is already named {name}.");
            }
        }
        if (!TileColors.IsKnown(tile.Color))
        {
            ModelState.AddModelError("tile.color", $"Unknown color '{tile.Color}'.");
        }
        foreach (var error in TileDefinition.Validate(tile.DefinitionCode))
        {
            ModelState.AddModelError("tile.definitionCode", error);
        }

        var games = tile.Games ?? [];
        if (games.GroupBy(g => g.GameId).Any(g => g.Count() > 1))
        {
            ModelState.AddModelError("tile.games", "Each game can be listed only once.");
        }
        foreach (var missing in requests.MissingGameIds(games.Select(g => g.GameId)))
        {
            ModelState.AddModelError("tile.games", $"Game {missing} does not exist.");
        }
        if (games.Any(g => !TileCounts.IsValid(g.Count)))
        {
            ModelState.AddModelError("tile.games", $"A count must be empty (unknown), 1 to {TileCounts.MaxCount}, or {TileCounts.Unlimited} (unlimited).");
        }
        if (games.Any(g => g.Notes is { Length: > MaxNotesLength }))
        {
            ModelState.AddModelError("tile.games", $"Notes must be {MaxNotesLength} characters or fewer.");
        }
    }
}
