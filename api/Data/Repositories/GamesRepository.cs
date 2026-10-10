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
               COUNT(CASE WHEN t.Id IS NOT NULL AND gt.Count IS NULL THEN 1 END) AS UnknownCountTileCount,
               COUNT(CASE WHEN t.Color = 'yellow' THEN 1 END) AS YellowTileCount,
               COUNT(CASE WHEN t.Color = 'green' THEN 1 END) AS GreenTileCount,
               COUNT(CASE WHEN t.Color = 'brown' THEN 1 END) AS BrownTileCount,
               COUNT(CASE WHEN t.Color = 'gray' THEN 1 END) AS GrayTileCount
        FROM Games g
        LEFT JOIN GameTiles gt ON gt.GameId = g.Id
        LEFT JOIN Tiles t ON t.Id = gt.TileId AND t.IsDeleted = 0
        """;

    // All games, sorted by title.
    public IReadOnlyList<GameSummaryDto> GetAll()
    {
        using var connection = db.Open();
        return connection.Query<GameSummaryDto>(SelectGames + " GROUP BY g.Id ORDER BY g.Title COLLATE NOCASE;").ToList();
    }

    // One game, or null if the id does not exist.
    public GameSummaryDto? GetById(long id)
    {
        using var connection = db.Open();
        return connection.QuerySingleOrDefault<GameSummaryDto>(SelectGames + " WHERE g.Id = @id GROUP BY g.Id;", new { id });
    }
}