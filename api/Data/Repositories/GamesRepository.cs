using Dapper;
using Tiles18xx.Api.Dtos;

namespace Tiles18xx.Api.Data.Repositories;

// Reads games from the database with Dapper.
public sealed class GamesRepository(SqliteConnectionFactory db)
{
    // Shared SELECT: each game plus how many (non-deleted) tiles it uses.
    private const string SelectGames = """
        SELECT g.Id, g.Title, g.Designer, g.Publisher,
               COUNT(t.Id) AS TileCount
        FROM Games g
        LEFT JOIN GameTiles gt ON gt.GameId = g.Id
        LEFT JOIN Tiles t ON t.Id = gt.TileId AND t.IsDeleted = 0
        """;

    // All games, sorted by title.
    public IReadOnlyList<GameSummaryDto> GetAll()
    {
        using var connection = db.Open();
        return connection.Query<GameSummaryDto>(
            SelectGames + " GROUP BY g.Id ORDER BY g.Title COLLATE NOCASE;").ToList();
    }

    // One game, or null if the id does not exist.
    public GameSummaryDto? GetById(long id)
    {
        using var connection = db.Open();
        return connection.QuerySingleOrDefault<GameSummaryDto>(
            SelectGames + " WHERE g.Id = @id GROUP BY g.Id;", new { id });
    }
}