using Dapper;
using Tiles18xx.Api.Dtos;

namespace Tiles18xx.Api.Data.Repositories;

// The admin History page (DESIGN.md section 7, audit trail): change requests, data imports, and game tile list saves in one list, newest first.
// Step 1 finds one page of (kind, id) pairs with a UNION over the three tables, so filtering, sorting, and paging happen in SQL.
// Step 2 loads the full entries for that page from their own repositories, and puts them back in order.
public sealed class HistoryRepository(
    SqliteConnectionFactory db, ChangeRequestsRepository requests, ImportRunsRepository imports, GameTilesRepository gameTiles)
{
    // Search text matches (ignoring case): for changes, the tile's number or name, the proposed number, or the submitter's or reviewer's email; for
    // imports, the start of the commit hash; for game saves, the game's title or the admin's email. instr() is used instead of LIKE so % and _ in the
    // text are not wildcards.
    private const string Entries = """
        SELECT 'change' AS Kind, cr.Id, cr.SubmittedUtc AS WhenUtc
        FROM ChangeRequests cr
        LEFT JOIN AspNetUsers su ON su.Id = cr.SubmittedBy
        LEFT JOIN AspNetUsers ru ON ru.Id = cr.ReviewedBy
        LEFT JOIN Tiles t ON t.Id = cr.TileId
        WHERE @includeChanges = 1
          AND (@type IS NULL OR cr.Type = @type)
          AND (@status IS NULL OR cr.Status = @status)
          AND (@q IS NULL
               OR instr(lower(t.Number), @q) > 0 OR instr(lower(t.DisplayName), @q) > 0
               OR instr(lower(json_extract(cr.ProposedJson, '$.number')), @q) > 0
               OR instr(lower(su.Email), @q) > 0 OR instr(lower(ru.Email), @q) > 0)
        UNION ALL
        SELECT 'import', ir.Id, ir.ImportedUtc
        FROM ImportRuns ir
        WHERE @includeImports = 1 AND (@q IS NULL OR instr(lower(ir.SourceCommit), @q) = 1)
        UNION ALL
        SELECT 'game', gc.Id, gc.ChangedUtc
        FROM GameChanges gc
        JOIN Games g ON g.Id = gc.GameId
        LEFT JOIN AspNetUsers gu ON gu.Id = gc.ChangedBy
        WHERE @includeGames = 1 AND (@q IS NULL OR instr(lower(g.Title), @q) > 0 OR instr(lower(gu.Email), @q) > 0)
        """;

    public PagedResultDto<HistoryEntryDto> Search(HistoryQueryDto query)
    {
        var type = string.IsNullOrWhiteSpace(query.Type) ? null : query.Type;
        var status = string.IsNullOrWhiteSpace(query.Status) ? null : query.Status;
        var parameters = new
        {
            includeChanges = type is not (HistoryQueryDto.ImportType or HistoryQueryDto.GameType),
            includeImports = type is null or HistoryQueryDto.ImportType && status is null,
            includeGames = type is null or HistoryQueryDto.GameType && status is null,
            type = type is HistoryQueryDto.ImportType or HistoryQueryDto.GameType ? null : type,
            status,
            q = string.IsNullOrWhiteSpace(query.Q) ? null : query.Q.Trim().ToLowerInvariant(),
            limit = query.PageSize,
            offset = (query.Page - 1) * query.PageSize,
        };

        int total;
        List<EntryRow> page;
        using (var connection = db.Open())
        {
            total = connection.ExecuteScalar<int>($"SELECT COUNT(*) FROM ({Entries});", parameters);
            // Times are ISO 8601 UTC strings, so sorting them as text sorts them by time.
            page = connection.Query<EntryRow>($"SELECT Kind, Id, WhenUtc FROM ({Entries}) ORDER BY WhenUtc DESC, Kind, Id DESC LIMIT @limit OFFSET @offset;",
                parameters).ToList();
        }

        var changes = requests.GetByIds(page.Where(e => e.Kind == HistoryEntryDto.ChangeKind).Select(e => e.Id).ToList()).ToDictionary(c => c.Id);
        var runs = imports.GetByIds(page.Where(e => e.Kind == HistoryEntryDto.ImportKind).Select(e => e.Id).ToList()).ToDictionary(r => r.Id);
        var games = gameTiles.GetChanges(page.Where(e => e.Kind == HistoryEntryDto.GameKind).Select(e => e.Id).ToList()).ToDictionary(g => g.Id);
        var items = page.Select(e => new HistoryEntryDto
        {
            Kind = e.Kind,
            WhenUtc = e.WhenUtc,
            Change = e.Kind == HistoryEntryDto.ChangeKind ? changes.GetValueOrDefault(e.Id) : null,
            Import = e.Kind == HistoryEntryDto.ImportKind ? runs.GetValueOrDefault(e.Id) : null,
            Game = e.Kind == HistoryEntryDto.GameKind ? games.GetValueOrDefault(e.Id) : null,
        }).ToList();
        return new PagedResultDto<HistoryEntryDto>(items, query.Page, query.PageSize, total);
    }

    private sealed record EntryRow
    {
        public string Kind { get; init; } = "";
        public long Id { get; init; }
        public string WhenUtc { get; init; } = "";
    }
}
