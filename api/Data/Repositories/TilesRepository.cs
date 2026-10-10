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

    // Make %, _ and \ in user input match literally in LIKE.
    private static string EscapeLike(string text) =>
        text.Replace(@"\", @"\\").Replace("%", @"\%").Replace("_", @"\_");
}