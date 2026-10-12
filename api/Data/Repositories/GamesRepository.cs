using System.Text.Json;
using Dapper;
using Tiles18xx.Api.Dtos;

namespace Tiles18xx.Api.Data.Repositories;

// Reads games from the database with Dapper, and adds, edits, and deletes them for admins (DESIGN.md section 8). Deleted games (IsDeleted = 1) are
// never returned. Every add, edit, and delete is recorded in GameChanges (Kind 'created', 'edited', 'deleted'), so it shows on the History page.
public sealed class GamesRepository(SqliteConnectionFactory db)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    // SourceKey prefix of games added in the app (New game). Imports never use it, so they never match, change, or report these games.
    public const string AppKeyPrefix = "app:";

    public enum ChangeOutcome { Done, NotFound, TitleTaken, NothingChanged }

    // Shared SELECT: each game, how many (non-deleted) tiles it uses, and how many physical tiles are in the box. Counts of 999 mean unlimited and are
    // counted separately; links without a count are counted as unknown. Callers add the WHERE (always including g.IsDeleted = 0).
    private const string SelectGames = """
        SELECT g.Id, g.Title, g.Designer, g.Publisher,
               COUNT(t.Id) AS TileCount,
               COALESCE(SUM(CASE WHEN t.Id IS NOT NULL AND gt.Count <> 999 THEN gt.Count END), 0) AS PhysicalTileCount,
               COUNT(CASE WHEN t.Id IS NOT NULL AND gt.Count = 999 THEN 1 END) AS UnlimitedTileCount,
               COUNT(CASE WHEN t.Id IS NOT NULL AND gt.Count IS NULL THEN 1 END) AS UnknownCountTileCount
        FROM Games g
        LEFT JOIN GameTiles gt ON gt.GameId = g.Id
        LEFT JOIN Tiles t ON t.Id = gt.TileId AND t.IsDeleted = 0
        """;

    // Tile designs per game and color, for every color (yellow to gray, two-color tiles, and the game-specific red, blue, ...).
    private const string SelectColors = """
        SELECT gt.GameId, t.Color, COUNT(*) AS Count
        FROM GameTiles gt
        JOIN Tiles t ON t.Id = gt.TileId AND t.IsDeleted = 0
        """;

    // All games, sorted by title.
    public IReadOnlyList<GameSummaryDto> GetAll()
    {
        using var connection = db.Open();
        var games = connection.Query<GameSummaryDto>(SelectGames + " WHERE g.IsDeleted = 0 GROUP BY g.Id ORDER BY g.Title COLLATE NOCASE;").ToList();
        var colors = connection.Query<ColorRow>(SelectColors + " GROUP BY gt.GameId, t.Color;").ToLookup(c => c.GameId);
        return games.Select(g => g with { ColorCounts = ToDictionary(colors[g.Id]) }).ToList();
    }

    // One game, or null if the id does not exist or the game was deleted.
    public GameSummaryDto? GetById(long id)
    {
        using var connection = db.Open();
        var game = connection.QuerySingleOrDefault<GameSummaryDto>(SelectGames + " WHERE g.Id = @id AND g.IsDeleted = 0 GROUP BY g.Id;", new { id });
        if (game is null)
        {
            return null;
        }
        var colors = connection.Query<ColorRow>(SelectColors + " WHERE gt.GameId = @id GROUP BY gt.GameId, t.Color;", new { id });
        return game with { ColorCounts = ToDictionary(colors) };
    }

    // Add a game made in the app, with no tiles yet. Returns the new id, or null when any game (deleted ones included, which keep their title) already
    // has the title, compared without regard to case.
    public long? Create(string title, string? designer, string? publisher, string userId)
    {
        using var connection = db.Open();
        using var transaction = connection.BeginTransaction();
        if (TitleTaken(connection, transaction, title, null))
        {
            return null;
        }
        var now = DateTime.UtcNow.ToString("O");
        var id = connection.ExecuteScalar<long>(
            "INSERT INTO Games (Title, SourceKey, Designer, Publisher, CreatedUtc) VALUES (@title, @key, @designer, @publisher, @now) RETURNING Id;",
            new { title, key = AppKeyPrefix + Guid.NewGuid().ToString("N"), designer, publisher, now },
            transaction);
        AddChange(connection, transaction, id, userId, now, "created", null, "[]", "[]", null);
        transaction.Commit();
        return id;
    }

    // Change a game's title, designer, and publisher. Marks the game as edited in the app (UpdatedUtc), so imports keep these values from now on.
    public ChangeOutcome Update(long id, string title, string? designer, string? publisher, string? reason, string userId)
    {
        using var connection = db.Open();
        using var transaction = connection.BeginTransaction();
        var before = connection.QuerySingleOrDefault<GameDetailsDto>(
            "SELECT Title, Designer, Publisher FROM Games WHERE Id = @id AND IsDeleted = 0;", new { id }, transaction);
        if (before is null)
        {
            return ChangeOutcome.NotFound;
        }
        var after = new GameDetailsDto { Title = title, Designer = designer, Publisher = publisher };
        if (before == after)
        {
            return ChangeOutcome.NothingChanged;
        }
        if (TitleTaken(connection, transaction, title, id))
        {
            return ChangeOutcome.TitleTaken;
        }
        var now = DateTime.UtcNow.ToString("O");
        connection.Execute(
            "UPDATE Games SET Title = @title, Designer = @designer, Publisher = @publisher, UpdatedUtc = @now, UpdatedBy = @userId WHERE Id = @id;",
            new { title, designer, publisher, now, userId, id },
            transaction);
        var details = JsonSerializer.Serialize(new GameDetailsChangeDto { Before = before, After = after }, Json);
        AddChange(connection, transaction, id, userId, now, "edited", reason, "[]", "[]", details);
        transaction.Commit();
        return ChangeOutcome.Done;
    }

    // Delete a game: hide it everywhere and remove its tile links. The links are kept in the History entry (BeforeJson), and the row stays, so
    // imports recognize the game and never add it back. The tiles themselves are not touched.
    public ChangeOutcome Delete(long id, string? reason, string userId)
    {
        using var connection = db.Open();
        using var transaction = connection.BeginTransaction();
        if (connection.ExecuteScalar<long>("SELECT COUNT(*) FROM Games WHERE Id = @id AND IsDeleted = 0;", new { id }, transaction) == 0)
        {
            return ChangeOutcome.NotFound;
        }
        var links = connection.Query<GameTileInputDto>(
            "SELECT TileId, Count, Notes FROM GameTiles WHERE GameId = @id ORDER BY TileId;", new { id }, transaction).ToList();
        var now = DateTime.UtcNow.ToString("O");
        connection.Execute("DELETE FROM GameTiles WHERE GameId = @id;", new { id }, transaction);
        connection.Execute("UPDATE Games SET IsDeleted = 1, UpdatedUtc = @now, UpdatedBy = @userId WHERE Id = @id;", new { now, userId, id }, transaction);
        AddChange(connection, transaction, id, userId, now, "deleted", reason, JsonSerializer.Serialize(links, Json), "[]", null);
        transaction.Commit();
        return ChangeOutcome.Done;
    }

    private static bool TitleTaken(System.Data.IDbConnection connection, System.Data.IDbTransaction transaction, string title, long? exceptId) =>
        connection.ExecuteScalar<long>(
            "SELECT COUNT(*) FROM Games WHERE Title = @title COLLATE NOCASE AND (@exceptId IS NULL OR Id <> @exceptId);",
            new { title, exceptId },
            transaction) > 0;

    private static void AddChange(
        System.Data.IDbConnection connection, System.Data.IDbTransaction transaction, long gameId, string userId, string now, string kind, string? reason,
        string beforeJson, string afterJson, string? detailsJson) =>
        connection.Execute(
            """
            INSERT INTO GameChanges (GameId, ChangedBy, ChangedUtc, Reason, BeforeJson, AfterJson, Kind, DetailsJson)
            VALUES (@gameId, @userId, @now, @reason, @beforeJson, @afterJson, @kind, @detailsJson);
            """,
            new { gameId, userId, now, reason, beforeJson, afterJson, kind, detailsJson },
            transaction);

    private static Dictionary<string, long> ToDictionary(IEnumerable<ColorRow> rows) => rows.ToDictionary(c => c.Color, c => c.Count);

    private sealed record ColorRow
    {
        public long GameId { get; init; }
        public string Color { get; init; } = "";
        public long Count { get; init; }
    }
}
