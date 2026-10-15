using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Tiles18xx.Api.Auth;
using Tiles18xx.Api.Data.Repositories;
using Tiles18xx.Api.Domain;
using Tiles18xx.Api.Dtos;

namespace Tiles18xx.Api.Controllers;

// Proposing changes (DESIGN.md sections 7 and 8). Any signed-in user can propose a new tile (Add) or a new game with its tiles (AddGame); it waits for an
// admin (Pending). Editing and deleting existing tiles is for admins only. An admin's request is applied immediately (Approved by that admin), so every
// change has an audit row.
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
    // non-admin; 409 for a duplicate tile, or a game title that is taken or already waiting for review.
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
        var game = Normalize(body.Game);
        var reason = string.IsNullOrWhiteSpace(body.Reason) ? null : body.Reason.Trim();
        Validate(body, tile, game, reason);
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
        if (game is not null && requests.IsGameTitleTaken(game.Title))
        {
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "Title taken",
                detail: $"A game called \"{game.Title}\" is already on the site (or was deleted). Choose another title.");
        }
        if (game is not null && requests.IsGameTitlePending(game.Title))
        {
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "Already proposed",
                detail: $"A game called \"{game.Title}\" is already waiting for review.");
        }

        // The submitter's id comes from the sign-in cookie, never from the request body.
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var id = requests.Create(body.Type, tileId, tile, game, reason, userId);

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

    // Trim a game proposal's text; empty designer, publisher, and notes become null. Only each tile's id, count, and notes are kept.
    private static GameProposalDto? Normalize(GameProposalDto? game) => game is null ? null : new GameProposalDto
    {
        Title = game.Title.Trim(),
        Designer = string.IsNullOrWhiteSpace(game.Designer) ? null : game.Designer.Trim(),
        Publisher = string.IsNullOrWhiteSpace(game.Publisher) ? null : game.Publisher.Trim(),
        Tiles = game.Tiles.Select(t => new GameTileDto { TileId = t.TileId, Count = t.Count, Notes = string.IsNullOrWhiteSpace(t.Notes) ? null : t.Notes.Trim() })
            .ToList(),
    };

    // Explicit checks for every field; all problems are reported together as a 400.
    private void Validate(ChangeRequestSubmitDto body, TileContentDto? tile, GameProposalDto? game, string? reason)
    {
        if (!ChangeRequestTypes.IsKnown(body.Type))
        {
            ModelState.AddModelError("type", "Type must be Add, Edit, Delete, or AddGame.");
            return;
        }
        if (body.Type != ChangeRequestTypes.AddGame && game is not null)
        {
            ModelState.AddModelError("game", "Leave game empty unless proposing a game (AddGame).");
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
            case ChangeRequestTypes.AddGame:
                if (body.TileId is not null) ModelState.AddModelError("tileId", "Leave tileId empty when proposing a game.");
                if (tile is not null) ModelState.AddModelError("tile", "Leave tile empty when proposing a game.");
                if (game is null) ModelState.AddModelError("game", "Describe the game to add.");
                else ValidateGame(game);
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

    // The same rules as New game and Edit game tiles: a title, short text, at least one live tile, each once, with valid counts and short notes.
    private void ValidateGame(GameProposalDto game)
    {
        if (game.Title.Length == 0)
        {
            ModelState.AddModelError("game.title", "Enter the game's title.");
        }
        foreach (var (field, value) in new[] { ("title", game.Title), ("designer", game.Designer), ("publisher", game.Publisher) })
        {
            if (value is { Length: > AdminController.MaxGameTextLength })
            {
                ModelState.AddModelError($"game.{field}", $"The {field} must be {AdminController.MaxGameTextLength} characters or fewer.");
            }
        }
        if (game.Tiles.Count == 0)
        {
            ModelState.AddModelError("game.tiles", "Add at least one tile the game uses.");
        }
        if (game.Tiles.GroupBy(t => t.TileId).Any(g => g.Count() > 1))
        {
            ModelState.AddModelError("game.tiles", "Each tile can appear only once.");
        }
        foreach (var missing in requests.NotLiveTileIds(game.Tiles.Select(t => t.TileId)))
        {
            ModelState.AddModelError("game.tiles", $"Tile {missing} does not exist or has been deleted.");
        }
        if (game.Tiles.Any(t => !TileCounts.IsValid(t.Count)))
        {
            ModelState.AddModelError("game.tiles", $"A count must be empty (unknown), 1 to {TileCounts.MaxCount}, or {TileCounts.Unlimited} (unlimited).");
        }
        if (game.Tiles.Any(t => t.Notes is { Length: > MaxNotesLength }))
        {
            ModelState.AddModelError("game.tiles", $"Notes must be {MaxNotesLength} characters or fewer.");
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
