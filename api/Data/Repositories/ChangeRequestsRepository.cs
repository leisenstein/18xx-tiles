using System.Data;
using System.Text.Json;
using Dapper;
using Tiles18xx.Api.Domain;
using Tiles18xx.Api.Dtos;

namespace Tiles18xx.Api.Data.Repositories;

// Reads and writes change requests, and applies approved ones to Tiles and GameTiles, or for a game proposal (AddGame) to Games and GameTiles
// (DESIGN.md section 7). Inputs are validated by the controllers.
// Submitter and reviewer emails are read from Identity's AspNetUsers table (read-only; EF Core owns that table's schema).
public sealed class ChangeRequestsRepository(SqliteConnectionFactory db)
{
    // ProposedJson is stored with the same camelCase names the API uses in JSON.
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private const string SelectRequests = """
        SELECT cr.Id, cr.Type, cr.Status, cr.TileId, cr.ProposedJson, cr.BeforeJson, cr.Reason, cr.SubmittedUtc, cr.ReviewedUtc, cr.ReviewNote,
               su.Email AS SubmittedByEmail, ru.Email AS ReviewedByEmail,
               t.DisplayName AS TileDisplayName, t.Number AS TileNumber, t.Color AS TileColor, t.DefinitionCode AS TileDefinitionCode,
               cr.GameId, g.Title AS GameTitle
        FROM ChangeRequests cr
        LEFT JOIN AspNetUsers su ON su.Id = cr.SubmittedBy
        LEFT JOIN AspNetUsers ru ON ru.Id = cr.ReviewedBy
        LEFT JOIN Tiles t ON t.Id = cr.TileId
        LEFT JOIN Games g ON g.Id = cr.GameId
        """;

    // Stores a new Pending request and returns its id. proposed is the tile (Add, Edit) and proposedGame the game (AddGame); at most one is set.
    public long Create(string type, long? tileId, TileContentDto? proposed, GameProposalDto? proposedGame, string? reason, string userId)
    {
        var proposedJson = proposedGame is not null
            ? JsonSerializer.Serialize(StoredGame.From(proposedGame), Json)
            : proposed is null ? null : JsonSerializer.Serialize(proposed, Json);
        using var connection = db.Open();
        return connection.ExecuteScalar<long>("""
            INSERT INTO ChangeRequests (Type, TileId, ProposedJson, Reason, Status, SubmittedBy, SubmittedUtc)
            VALUES (@type, @tileId, @proposedJson, @reason, @status, @userId, @now)
            RETURNING Id;
            """,
            new
            {
                type,
                tileId,
                proposedJson,
                reason,
                status = ChangeRequestStatuses.Pending,
                userId,
                now = Now(),
            });
    }

    public ChangeRequestDto? GetById(long id) => Read(SelectRequests + " WHERE cr.Id = @id;", new { id }).SingleOrDefault();

    // A user's own requests, newest first.
    public IReadOnlyList<ChangeRequestDto> GetBySubmitter(string userId) =>
        Read(SelectRequests + " WHERE cr.SubmittedBy = @userId ORDER BY cr.Id DESC;", new { userId });

    // The review queue: Pending requests oldest first (first come, first served); other statuses newest first.
    public IReadOnlyList<ChangeRequestDto> GetByStatus(string status) =>
        Read(SelectRequests + " WHERE cr.Status = @status ORDER BY "
            + (status == ChangeRequestStatuses.Pending ? "cr.Id" : "cr.Id DESC") + ";", new { status });

    // Several requests by id (the admin History page), in no particular order.
    public IReadOnlyList<ChangeRequestDto> GetByIds(IReadOnlyCollection<long> ids) =>
        ids.Count == 0 ? [] : Read(SelectRequests + " WHERE cr.Id IN @ids;", new { ids });

    // Does any game (deleted ones included) already have this title, ignoring case?
    public bool IsGameTitleTaken(string title)
    {
        using var connection = db.Open();
        return GamesRepository.TitleTaken(connection, null, title, null);
    }

    // Is a game with this title already waiting for review (a Pending AddGame request), ignoring case?
    public bool IsGameTitlePending(string title)
    {
        using var connection = db.Open();
        return connection.ExecuteScalar<long>(
            "SELECT COUNT(*) FROM ChangeRequests WHERE Type = @addGame AND Status = @pending AND json_extract(ProposedJson, '$.title') = @title COLLATE NOCASE;",
            new { addGame = ChangeRequestTypes.AddGame, pending = ChangeRequestStatuses.Pending, title }) > 0;
    }

    // Is this tile live (exists and not deleted)?
    public bool IsLiveTile(long tileId)
    {
        using var connection = db.Open();
        return connection.ExecuteScalar<long>("SELECT COUNT(*) FROM Tiles WHERE Id = @tileId AND IsDeleted = 0;", new { tileId }) > 0;
    }

    // Tile ids that are not live tiles (missing or deleted), for checking a game proposal's tile list.
    public IReadOnlyList<long> NotLiveTileIds(IEnumerable<long> tileIds)
    {
        var ids = tileIds.Distinct().ToList();
        using var connection = db.Open();
        var live = connection.Query<long>("SELECT Id FROM Tiles WHERE Id IN @ids AND IsDeleted = 0;", new { ids }).ToHashSet();
        return ids.Where(id => !live.Contains(id)).ToList();
    }

    // Which of these game ids do not exist?
    public IReadOnlyList<long> MissingGameIds(IEnumerable<long> gameIds)
    {
        var ids = gameIds.Distinct().ToList();
        using var connection = db.Open();
        var found = connection.Query<long>("SELECT Id FROM Games WHERE Id IN @ids AND IsDeleted = 0;", new { ids }).ToHashSet();
        return ids.Where(id => !found.Contains(id)).ToList();
    }

    // Another tile with the same Number, Color, and DefinitionCode would break the UNIQUE rule on Tiles (DESIGN.md section 8). Returns a message, or null.
    public string? FindConflict(TileContentDto content, long? exceptTileId)
    {
        using var connection = db.Open();
        return FindConflict(connection, null, content, exceptTileId);
    }

    // Who else uses this tile number: live tiles, and Pending requests that propose it (DESIGN.md section 7, display names). Used by the form to warn that a
    // new tile will become a variant. exceptTileId leaves out the tile being edited; userId marks the caller's own requests.
    public NumberCheckDto CheckNumber(string number, long? exceptTileId, string userId)
    {
        using var connection = db.Open();
        var tiles = connection.Query<TileSummaryDto>("""
            SELECT t.Id, t.Number, t.Color, t.DisplayName, t.DefinitionCode, t.HasCity, t.HasTown,
                   (SELECT COUNT(*) FROM GameTiles x WHERE x.TileId = t.Id) AS GameCount
            FROM Tiles t
            WHERE t.Number = @number AND t.IsDeleted = 0 AND (@exceptTileId IS NULL OR t.Id <> @exceptTileId);
            """, new { number, exceptTileId });
        // json_extract reads one field out of the stored ProposedJson text.
        var pending = connection.Query<PendingNumberUseDto>("""
            SELECT Id, Type, json_extract(ProposedJson, '$.variantName') AS VariantName, SubmittedBy = @userId AS IsMine
            FROM ChangeRequests
            WHERE Status = @pending AND json_extract(ProposedJson, '$.number') = @number
              AND (@exceptTileId IS NULL OR TileId IS NULL OR TileId <> @exceptTileId)
            ORDER BY Id;
            """, new { number, exceptTileId, userId, pending = ChangeRequestStatuses.Pending }).ToList();

        return new NumberCheckDto
        {
            Number = number,
            Tiles = TileSort.Apply(tiles).ToList(),
            PendingRequests = pending,
            DefaultDisplayName = DisplayNameFor(connection, null, number, exceptTileId, null),
        };
    }

    // Is "#N (variantName)" already the display name of another live tile with that number?
    public bool IsVariantNameTaken(string number, string variantName, long? exceptTileId)
    {
        using var connection = db.Open();
        return DisplayNamesInUse(connection, null, number, exceptTileId).Contains(VariantDisplayName(number, variantName));
    }

    // Approve a Pending request: apply it and mark it Approved, all in one transaction, so either both happen or neither does.
    public ReviewResult Approve(long id, string reviewerId, string? note)
    {
        using var connection = db.Open();
        using var transaction = connection.BeginTransaction();

        var request = connection.QuerySingleOrDefault<StoredRequest>(
            "SELECT Id, Type, Status, TileId, ProposedJson, SubmittedBy FROM ChangeRequests WHERE Id = @id;", new { id }, transaction);
        if (request is null)
        {
            return ReviewResult.NotFound;
        }
        if (request.Status != ChangeRequestStatuses.Pending)
        {
            return ReviewResult.Fail($"This request is already {request.Status}.");
        }
        if (request.Type == ChangeRequestTypes.AddGame)
        {
            return ApproveGame(connection, transaction, request, reviewerId, note);
        }

        var proposed = request.ProposedJson is null ? null : JsonSerializer.Deserialize<TileContentDto>(request.ProposedJson, Json);
        var now = Now();
        long? tileId = request.TileId;

        // Edits and deletes need the tile to still be live; it may have been deleted since the request was made.
        if (request.Type is ChangeRequestTypes.Edit or ChangeRequestTypes.Delete)
        {
            var live = connection.ExecuteScalar<long>(
                "SELECT COUNT(*) FROM Tiles WHERE Id = @tileId AND IsDeleted = 0;", new { tileId }, transaction) > 0;
            if (!live)
            {
                return ReviewResult.Fail("The tile no longer exists or has been deleted. Reject this request instead.");
            }
        }

        // Audit trail: keep the tile exactly as it was before an Edit or Delete, so its history can show before and after.
        string? beforeJson = request.Type is ChangeRequestTypes.Edit or ChangeRequestTypes.Delete
            ? JsonSerializer.Serialize(Snapshot(connection, transaction, tileId!.Value), Json)
            : null;

        // Re-check the UNIQUE rule at approval time; another change may have created the same tile since this request was made.
        if (proposed is not null && FindConflict(connection, transaction, proposed, tileId) is { } conflict)
        {
            return ReviewResult.Fail(conflict);
        }

        switch (request.Type)
        {
            case ChangeRequestTypes.Add:
                tileId = connection.ExecuteScalar<long>("""
                    INSERT INTO Tiles (Number, Color, DefinitionCode, DisplayName, HasCity, HasTown, Source, CreatedBy, CreatedUtc)
                    VALUES (@Number, @Color, @DefinitionCode, @DisplayName, @HasCity, @HasTown, 'user', @CreatedBy, @now)
                    RETURNING Id;
                    """,
                    new
                    {
                        proposed!.Number,
                        proposed.Color,
                        proposed.DefinitionCode,
                        DisplayName = DisplayNameFor(connection, transaction, proposed.Number, null, proposed.VariantName),
                        HasCity = TileDefinition.Has(proposed.DefinitionCode, "city"),
                        HasTown = TileDefinition.Has(proposed.DefinitionCode, "town"),
                        CreatedBy = request.SubmittedBy,
                        now,
                    },
                    transaction);
                ReplaceGameLinks(connection, transaction, tileId.Value, proposed.Games ?? []);
                break;

            case ChangeRequestTypes.Edit:
                // Keep the display name unless the number changed or a variant name was given.
                var oldNumber = connection.ExecuteScalar<string>("SELECT Number FROM Tiles WHERE Id = @tileId;", new { tileId }, transaction);
                var displayName = oldNumber == proposed!.Number && proposed.VariantName is null
                    ? connection.ExecuteScalar<string>("SELECT DisplayName FROM Tiles WHERE Id = @tileId;", new { tileId }, transaction)
                    : DisplayNameFor(connection, transaction, proposed.Number, tileId, proposed.VariantName);
                connection.Execute("""
                    UPDATE Tiles
                    SET Number = @Number, Color = @Color, DefinitionCode = @DefinitionCode, DisplayName = @displayName,
                        HasCity = @HasCity, HasTown = @HasTown, UpdatedUtc = @now, UpdatedBy = @reviewerId
                    WHERE Id = @tileId;
                    """,
                    new
                    {
                        proposed.Number,
                        proposed.Color,
                        proposed.DefinitionCode,
                        displayName,
                        HasCity = TileDefinition.Has(proposed.DefinitionCode, "city"),
                        HasTown = TileDefinition.Has(proposed.DefinitionCode, "town"),
                        now,
                        reviewerId,
                        tileId,
                    },
                    transaction);
                if (proposed.Games is not null)
                {
                    ReplaceGameLinks(connection, transaction, tileId!.Value, proposed.Games);
                }
                break;

            case ChangeRequestTypes.Delete:
                // Soft delete (DESIGN.md section 7): the row stays, so history and links are kept.
                connection.Execute(
                    "UPDATE Tiles SET IsDeleted = 1, UpdatedUtc = @now, UpdatedBy = @reviewerId WHERE Id = @tileId;",
                    new { now, reviewerId, tileId },
                    transaction);
                break;

            default:
                throw new InvalidOperationException($"Unknown change request type '{request.Type}'.");
        }

        // For an Add, also record the new tile's id on the request, so the audit row links to it.
        connection.Execute("""
            UPDATE ChangeRequests
            SET Status = @status, TileId = @tileId, BeforeJson = @beforeJson, ReviewedBy = @reviewerId, ReviewedUtc = @now, ReviewNote = @note
            WHERE Id = @id;
            """,
            new { status = ChangeRequestStatuses.Approved, tileId, beforeJson, reviewerId, now, note, id },
            transaction);

        transaction.Commit();
        return ReviewResult.Done;
    }

    // Approve a game proposal (inside Approve's transaction): add the game as a game made in the app, link the tiles that are still live (tiles deleted
    // since the proposal was made are left out), and mark the request Approved with the new game's id.
    private static ReviewResult ApproveGame(IDbConnection connection, IDbTransaction transaction, StoredRequest request, string reviewerId, string? note)
    {
        var game = JsonSerializer.Deserialize<StoredGame>(request.ProposedJson!, Json)!;
        // Re-check the title; a game with it may have been added or imported since the proposal was made.
        if (GamesRepository.TitleTaken(connection, transaction, game.Title, null))
        {
            return ReviewResult.Fail($"A game called \"{game.Title}\" now exists (or was deleted). Reject this request instead.");
        }
        var now = Now();
        var gameId = GamesRepository.InsertAppGame(connection, transaction, game.Title, game.Designer, game.Publisher, now);
        var tileIds = game.Tiles.Select(t => t.TileId).ToList();
        var live = connection.Query<long>("SELECT Id FROM Tiles WHERE Id IN @tileIds AND IsDeleted = 0;", new { tileIds }, transaction).ToHashSet();
        connection.Execute(
            "INSERT INTO GameTiles (GameId, TileId, Count, Notes) VALUES (@gameId, @TileId, @Count, @Notes);",
            game.Tiles.Where(t => live.Contains(t.TileId)).Select(t => new { gameId, t.TileId, t.Count, t.Notes }),
            transaction);
        connection.Execute(
            "UPDATE ChangeRequests SET Status = @status, GameId = @gameId, ReviewedBy = @reviewerId, ReviewedUtc = @now, ReviewNote = @note WHERE Id = @id;",
            new { status = ChangeRequestStatuses.Approved, gameId, reviewerId, now, note, id = request.Id },
            transaction);
        transaction.Commit();
        return ReviewResult.Done;
    }

    // Reject a Pending request. Nothing changes in Tiles.
    public ReviewResult Reject(long id, string reviewerId, string note)
    {
        using var connection = db.Open();
        var status = connection.ExecuteScalar<string?>("SELECT Status FROM ChangeRequests WHERE Id = @id;", new { id });
        if (status is null)
        {
            return ReviewResult.NotFound;
        }
        if (status != ChangeRequestStatuses.Pending)
        {
            return ReviewResult.Fail($"This request is already {status}.");
        }
        connection.Execute(
            "UPDATE ChangeRequests SET Status = @rejected, ReviewedBy = @reviewerId, ReviewedUtc = @now, ReviewNote = @note WHERE Id = @id;",
            new { rejected = ChangeRequestStatuses.Rejected, reviewerId, now = Now(), note, id });
        return ReviewResult.Done;
    }

    // A tile's history (DESIGN.md section 7, audit trail): who added it and when, its last change, and every change request about it, oldest first.
    // Works for deleted tiles too. Returns null if the tile never existed.
    public TileHistoryDto? GetHistory(long tileId)
    {
        using var connection = db.Open();
        var tile = connection.QuerySingleOrDefault<TileHistoryDto>("""
            SELECT t.Id AS TileId, t.DisplayName, t.Source, t.IsDeleted, t.CreatedUtc, cu.Email AS CreatedByEmail, t.UpdatedUtc, uu.Email AS UpdatedByEmail
            FROM Tiles t
            LEFT JOIN AspNetUsers cu ON cu.Id = t.CreatedBy
            LEFT JOIN AspNetUsers uu ON uu.Id = t.UpdatedBy
            WHERE t.Id = @tileId;
            """, new { tileId });
        return tile is null ? null : tile with { Requests = Read(SelectRequests + " WHERE cr.TileId = @tileId ORDER BY cr.Id;", new { tileId }) };
    }

    // ---- helpers ----

    // The tile as it is now, with its games: number, color, definition, display name, and game links (with titles).
    private static TileContentDto Snapshot(IDbConnection connection, IDbTransaction transaction, long tileId)
    {
        var tile = connection.QuerySingle<TileContentDto>(
            "SELECT Number, Color, DefinitionCode, DisplayName FROM Tiles WHERE Id = @tileId;", new { tileId }, transaction);
        var games = connection.Query<TileGameLinkDto>("""
            SELECT gt.GameId, gt.Count, gt.Notes, g.Title FROM GameTiles gt JOIN Games g ON g.Id = gt.GameId
            WHERE gt.TileId = @tileId ORDER BY g.Title COLLATE NOCASE;
            """, new { tileId }, transaction).ToList();
        return tile with { Games = games };
    }

    private static string Now() => DateTime.UtcNow.ToString("O");

    private static string? FindConflict(IDbConnection connection, IDbTransaction? transaction, TileContentDto content, long? exceptTileId)
    {
        var tile = connection.QueryFirstOrDefault<ConflictRow>("""
            SELECT Id, DisplayName, IsDeleted FROM Tiles
            WHERE Number = @Number AND Color = @Color AND DefinitionCode = @DefinitionCode AND (@exceptTileId IS NULL OR Id <> @exceptTileId)
            LIMIT 1;
            """,
            new { content.Number, content.Color, content.DefinitionCode, exceptTileId },
            transaction);
        if (tile is null)
        {
            return null;
        }
        return tile.IsDeleted
            ? $"A deleted tile ({tile.DisplayName}, id {tile.Id}) has the same number, color, and definition."
            : $"Tile {tile.DisplayName} (id {tile.Id}) already has the same number, color, and definition.";
    }

    // Display name for a user tile:
    // - with a variant name: "#N (name)"; if another live tile already has that name (taken since the request was made), "#N (name 2)", "#N (name 3)", ...
    // - without one: "#N" if no other live tile has that number, otherwise the first free "#N (variant k)".
    private static string DisplayNameFor(IDbConnection connection, IDbTransaction? transaction, string number, long? exceptTileId, string? variantName)
    {
        var taken = DisplayNamesInUse(connection, transaction, number, exceptTileId);
        if (variantName is not null)
        {
            var name = VariantDisplayName(number, variantName);
            for (var k = 2; taken.Contains(name); k++)
            {
                name = VariantDisplayName(number, $"{variantName} {k}");
            }
            return name;
        }
        if (taken.Count == 0)
        {
            return $"#{number}";
        }
        for (var k = 1; ; k++)
        {
            var name = VariantDisplayName(number, $"variant {k}");
            if (!taken.Contains(name))
            {
                return name;
            }
        }
    }

    public static string VariantDisplayName(string number, string variantName) => $"#{number} ({variantName})";

    private static HashSet<string> DisplayNamesInUse(IDbConnection connection, IDbTransaction? transaction, string number, long? exceptTileId) =>
        connection.Query<string>(
            "SELECT DisplayName FROM Tiles WHERE Number = @number AND IsDeleted = 0 AND (@exceptTileId IS NULL OR Id <> @exceptTileId);",
            new { number, exceptTileId },
            transaction).ToHashSet(StringComparer.Ordinal);

    private static void ReplaceGameLinks(IDbConnection connection, IDbTransaction transaction, long tileId, IEnumerable<TileGameLinkDto> games)
    {
        connection.Execute("DELETE FROM GameTiles WHERE TileId = @tileId;", new { tileId }, transaction);
        connection.Execute(
            "INSERT INTO GameTiles (GameId, TileId, Count, Notes) VALUES (@GameId, @tileId, @Count, @Notes);",
            games.Select(g => new { g.GameId, tileId, g.Count, g.Notes }),
            transaction);
    }

    private IReadOnlyList<ChangeRequestDto> Read(string sql, object parameters)
    {
        using var connection = db.Open();
        var rows = connection.Query<RequestRow>(sql, parameters).ToList();
        var titles = connection.Query<GameTitleRow>("SELECT Id, Title FROM Games;").ToDictionary(g => g.Id, g => g.Title);
        var games = rows.Where(r => r.Type == ChangeRequestTypes.AddGame && r.ProposedJson is not null)
            .ToDictionary(r => r.Id, r => JsonSerializer.Deserialize<StoredGame>(r.ProposedJson!, Json)!);
        // Every tile any game proposal names (deleted ones too), to draw them.
        var gameTileIds = games.Values.SelectMany(g => g.Tiles.Select(t => t.TileId)).Distinct().ToList();
        var gameTiles = connection.Query<GameTileDto>(
                "SELECT Id AS TileId, Number, Color, DisplayName, DefinitionCode FROM Tiles WHERE Id IN @gameTileIds;", new { gameTileIds })
            .ToDictionary(t => t.TileId);

        return rows.Select(row =>
        {
            if (games.TryGetValue(row.Id, out var game))
            {
                return ToDto(row, null, null, null) with { ProposedGame = game.ToDto(gameTiles) };
            }
            var proposed = row.ProposedJson is null ? null : JsonSerializer.Deserialize<TileContentDto>(row.ProposedJson, Json);
            var before = row.BeforeJson is null ? null : JsonSerializer.Deserialize<TileContentDto>(row.BeforeJson, Json);
            // Fill in game titles for display.
            if (proposed?.Games is { } links)
            {
                proposed = proposed with { Games = links.Select(g => g with { Title = titles.GetValueOrDefault(g.GameId) }).ToList() };
            }
            TileContentDto? current = null;
            if (row.TileId is long tileId && row.TileNumber is not null && row.Type != ChangeRequestTypes.Add)
            {
                var currentLinks = connection.Query<TileGameLinkDto>("""
                    SELECT gt.GameId, gt.Count, gt.Notes, g.Title FROM GameTiles gt JOIN Games g ON g.Id = gt.GameId
                    WHERE gt.TileId = @tileId ORDER BY g.Title COLLATE NOCASE;
                    """, new { tileId }).ToList();
                current = new TileContentDto
                {
                    Number = row.TileNumber,
                    Color = row.TileColor ?? "",
                    DefinitionCode = row.TileDefinitionCode ?? "",
                    Games = currentLinks,
                };
            }
            return ToDto(row, current, before, proposed);
        }).ToList();
    }

    private static ChangeRequestDto ToDto(RequestRow row, TileContentDto? current, TileContentDto? before, TileContentDto? proposed) => new()
    {
        Id = row.Id,
        Type = row.Type,
        Status = row.Status,
        TileId = row.TileId,
        TileDisplayName = row.TileDisplayName,
        Current = current,
        Before = before,
        Proposed = proposed,
        GameId = row.GameId,
        GameTitle = row.GameTitle,
        Reason = row.Reason,
        SubmittedByEmail = row.SubmittedByEmail,
        SubmittedUtc = row.SubmittedUtc,
        ReviewedByEmail = row.ReviewedByEmail,
        ReviewedUtc = row.ReviewedUtc,
        ReviewNote = row.ReviewNote,
    };

    // A game proposal as stored in ProposedJson: the details, and only each tile's id, count, and notes. The tile's drawing is read when the request is
    // shown, so a later change to the tile shows too.
    private sealed record StoredGame
    {
        public string Title { get; init; } = "";
        public string? Designer { get; init; }
        public string? Publisher { get; init; }
        public List<GameTileInputDto> Tiles { get; init; } = [];

        public static StoredGame From(GameProposalDto game) => new()
        {
            Title = game.Title,
            Designer = game.Designer,
            Publisher = game.Publisher,
            Tiles = game.Tiles.Select(t => new GameTileInputDto { TileId = t.TileId, Count = t.Count, Notes = t.Notes }).ToList(),
        };

        // In the usual tile order. A tile that no longer exists at all is shown as "tile N".
        public GameProposalDto ToDto(Dictionary<long, GameTileDto> tiles) => new()
        {
            Title = Title,
            Designer = Designer,
            Publisher = Publisher,
            Tiles = TileSort.Apply(Tiles.Select(t => new SortableTile(tiles.GetValueOrDefault(t.TileId) is { } tile
                    ? tile with { Count = t.Count, Notes = t.Notes }
                    : new GameTileDto { TileId = t.TileId, Number = "?", Color = "none", DisplayName = $"tile {t.TileId}", Count = t.Count, Notes = t.Notes })))
                .Select(s => s.Tile)
                .ToList(),
        };
    }

    // TileSort works on ISortableTile; this wraps a GameTileDto for it.
    private sealed record SortableTile(GameTileDto Tile) : ISortableTile
    {
        public long Id => Tile.TileId;
        public string Number => Tile.Number;
        public string Color => Tile.Color;
    }

    // Row shapes for Dapper (init properties so SQLite integers convert to C# types).
    private sealed record StoredRequest
    {
        public long Id { get; init; }
        public string Type { get; init; } = "";
        public string Status { get; init; } = "";
        public long? TileId { get; init; }
        public string? ProposedJson { get; init; }
        public string SubmittedBy { get; init; } = "";
    }

    private sealed record ConflictRow
    {
        public long Id { get; init; }
        public string DisplayName { get; init; } = "";
        public bool IsDeleted { get; init; }
    }

    private sealed record GameTitleRow
    {
        public long Id { get; init; }
        public string Title { get; init; } = "";
    }

    private sealed record RequestRow
    {
        public long Id { get; init; }
        public string Type { get; init; } = "";
        public string Status { get; init; } = "";
        public long? TileId { get; init; }
        public string? ProposedJson { get; init; }
        public string? BeforeJson { get; init; }
        public string? Reason { get; init; }
        public string SubmittedUtc { get; init; } = "";
        public string? ReviewedUtc { get; init; }
        public string? ReviewNote { get; init; }
        public string? SubmittedByEmail { get; init; }
        public string? ReviewedByEmail { get; init; }
        public string? TileDisplayName { get; init; }
        public string? TileNumber { get; init; }
        public string? TileColor { get; init; }
        public string? TileDefinitionCode { get; init; }
        public long? GameId { get; init; }
        public string? GameTitle { get; init; }
    }
}

