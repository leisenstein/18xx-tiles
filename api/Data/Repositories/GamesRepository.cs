using Dapper;
using Tiles18xx.Api.Dtos;

namespace Tiles18xx.Api.Data.Repositories;

// Reads games from the database with Dapper.
public sealed class GamesRepository(SqliteConnectionFactory db)
{
    // Shared SELECT: each game, how many (non-deleted) tiles it uses, and how many physical tiles are in the box. Counts of 999 mean unlimited and are
    // counted separately; links without a count are counted as unknown.
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
        var games = connection.Query<GameSummaryDto>(SelectGames + " GROUP BY g.Id ORDER BY g.Title COLLATE NOCASE;").ToList();
        var colors = connection.Query<ColorRow>(SelectColors + " GROUP BY gt.GameId, t.Color;").ToLookup(c => c.GameId);
        return games.Select(g => g with { ColorCounts = ToDictionary(colors[g.Id]) }).ToList();
    }

    // One game, or null if the id does not exist.
    public GameSummaryDto? GetById(long id)
    {
        using var connection = db.Open();
        var game = connection.QuerySingleOrDefault<GameSummaryDto>(SelectGames + " WHERE g.Id = @id GROUP BY g.Id;", new { id });
        if (game is null)
        {
            return null;
        }
        var colors = connection.Query<ColorRow>(SelectColors + " WHERE gt.GameId = @id GROUP BY gt.GameId, t.Color;", new { id });
        return game with { ColorCounts = ToDictionary(colors) };
    }

    private static Dictionary<string, long> ToDictionary(IEnumerable<ColorRow> rows) => rows.ToDictionary(c => c.Color, c => c.Count);

    private sealed record ColorRow
    {
        public long GameId { get; init; }
        public string Color { get; init; } = "";
        public long Count { get; init; }
    }
}
