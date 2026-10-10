using Dapper;
using Tiles18xx.Api.Domain;
using Tiles18xx.Api.Dtos;

namespace Tiles18xx.Api.Data.Repositories;

// Reads tiles from the database with Dapper.
public sealed class TilesRepository(SqliteConnectionFactory db)
{
    // Filtered tile list. Each filter is skipped when its parameter is NULL.
    private const string SearchSql = """
        SELECT t.Id, t.Number, t.Color, t.DisplayName, t.DefinitionCode, t.HasCity, t.HasTown,
               (SELECT COUNT(*) FROM GameTiles x WHERE x.TileId = t.Id) AS GameCount,
               gt.Count AS CountInGame
        FROM Tiles t
        LEFT JOIN GameTiles gt ON gt.TileId = t.Id AND gt.GameId = @Game
        WHERE t.IsDeleted = 0
          AND (@Game IS NULL OR gt.GameId IS NOT NULL)
          AND (@Color IS NULL OR t.Color = @Color)
          AND (@Kind IS NULL
               OR (@Kind = 'city' AND t.HasCity = 1)
               OR (@Kind = 'town' AND t.HasTown = 1))
          AND (@Pattern IS NULL OR t.Number LIKE @Pattern ESCAPE '\');
        """;

    // Inputs are already validated by the controller.
    public PagedResultDto<TileSummaryDto> Search(TileQueryDto query)
    {
        var search = string.IsNullOrWhiteSpace(query.Q) ? null : query.Q.Trim();
        var pattern = search is null ? null : "%" + EscapeLike(search) + "%";

        using var connection = db.Open();
        var rows = connection.Query<TileSummaryDto>(
            SearchSql, new { query.Game, query.Color, query.Kind, Pattern = pattern });

        // Sort in C# (numeric-part ordering is awkward in SQL). At about 2,000 tiles,
        // loading all matches and then paging is fast enough.
        var sorted = TileSort.Apply(rows).ToList();
        var items = sorted.Skip((query.Page - 1) * query.PageSize).Take(query.PageSize).ToList();

        return new PagedResultDto<TileSummaryDto>(items, query.Page, query.PageSize, sorted.Count);
    }

    // Live tiles used by at least minGames games, in the shared tile sort order (DESIGN.md 9.3).
    // Input is already validated by the controller.
    public IReadOnlyList<TileSummaryDto> GetCommon(int minGames)
    {
        using var connection = db.Open();
        var rows = connection.Query<TileSummaryDto>("""
            SELECT t.Id, t.Number, t.Color, t.DisplayName, t.DefinitionCode, t.HasCity, t.HasTown,
                   COUNT(DISTINCT gt.GameId) AS GameCount
            FROM Tiles t
            JOIN GameTiles gt ON gt.TileId = t.Id
            WHERE t.IsDeleted = 0
            GROUP BY t.Id
            HAVING COUNT(DISTINCT gt.GameId) >= @minGames;
            """, new { minGames });

        return TileSort.Apply(rows).ToList();
    }

    // One tile with its games and other versions, or null if it does not exist or is deleted.
    public TileDetailDto? GetById(long id)
    {
        using var connection = db.Open();

        var tile = connection.QuerySingleOrDefault<TileDetailDto>("""
            SELECT Id, Number, Color, DisplayName, DefinitionCode, HasCity, HasTown, Source, SourceRef
            FROM Tiles
            WHERE Id = @id AND IsDeleted = 0;
            """, new { id });
        if (tile is null)
        {
            return null;
        }

        var games = connection.Query<TileGameDto>("""
            SELECT g.Id AS GameId, g.Title, gt.Count, gt.Notes
            FROM GameTiles gt
            JOIN Games g ON g.Id = gt.GameId
            WHERE gt.TileId = @id
            ORDER BY g.Title COLLATE NOCASE;
            """, new { id }).ToList();

        var otherVersions = connection.Query<TileSummaryDto>("""
            SELECT t.Id, t.Number, t.Color, t.DisplayName, t.DefinitionCode, t.HasCity, t.HasTown,
                   (SELECT COUNT(*) FROM GameTiles x WHERE x.TileId = t.Id) AS GameCount
            FROM Tiles t
            WHERE t.Number = @number AND t.Id <> @id AND t.IsDeleted = 0;
            """, new { number = tile.Number, id });

        // "with" copies the record and fills in the two lists.
        return tile with { Games = games, OtherVersions = TileSort.Apply(otherVersions).ToList() };
    }

    // Make %, _ and \ in user input match literally in LIKE.
    private static string EscapeLike(string text) =>
        text.Replace(@"\", @"\\").Replace("%", @"\%").Replace("_", @"\_");
}