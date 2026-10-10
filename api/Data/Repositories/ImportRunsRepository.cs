using Dapper;
using Tiles18xx.Api.Data.Seeding;
using Tiles18xx.Api.Dtos;

namespace Tiles18xx.Api.Data.Repositories;

// Reads the import history written by DataImporter (DESIGN.md section 6.4).
public sealed class ImportRunsRepository(SqliteConnectionFactory db)
{
    private const string SelectRuns = """
        SELECT Id, SourceCommit, CommittedUtc, ImportedUtc, Mode, GamesAdded, TilesAdded, LinksAdded, CountsFilled, NotesJson FROM ImportRuns
        """;

    // Every import, newest first, with its report. Sorted by time, not id: a backfilled first import (script 0009) has a higher id than later runs.
    public IReadOnlyList<ImportRunDto> GetAll() => Query(SelectRuns + " ORDER BY ImportedUtc DESC, Id DESC;", null);

    // Several imports by id (the admin History page), in no particular order.
    public IReadOnlyList<ImportRunDto> GetByIds(IReadOnlyCollection<long> ids) => ids.Count == 0 ? [] : Query(SelectRuns + " WHERE Id IN @ids;", new { ids });

    private IReadOnlyList<ImportRunDto> Query(string sql, object? parameters)
    {
        using var connection = db.Open();
        return connection.Query<ImportRunRow>(sql, parameters)
            .Select(r => new ImportRunDto
            {
                Id = r.Id,
                SourceCommit = r.SourceCommit,
                CommittedUtc = r.CommittedUtc,
                ImportedUtc = r.ImportedUtc,
                Mode = r.Mode,
                GamesAdded = r.GamesAdded,
                TilesAdded = r.TilesAdded,
                LinksAdded = r.LinksAdded,
                CountsFilled = r.CountsFilled,
                Notes = DataImporter.ReadNotes(r.NotesJson),
            })
            .ToList();
    }

    private sealed record ImportRunRow
    {
        public long Id { get; init; }
        public string SourceCommit { get; init; } = "";
        public string? CommittedUtc { get; init; }
        public string ImportedUtc { get; init; } = "";
        public string Mode { get; init; } = "";
        public long GamesAdded { get; init; }
        public long TilesAdded { get; init; }
        public long LinksAdded { get; init; }
        public long CountsFilled { get; init; }
        public string NotesJson { get; init; } = "[]";
    }
}
