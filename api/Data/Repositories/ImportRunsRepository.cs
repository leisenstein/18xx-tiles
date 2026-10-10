using Dapper;
using Tiles18xx.Api.Data.Seeding;
using Tiles18xx.Api.Dtos;

namespace Tiles18xx.Api.Data.Repositories;

// Reads the import history written by DataImporter (DESIGN.md section 6.4).
public sealed class ImportRunsRepository(SqliteConnectionFactory db)
{
    // Every import, newest first, with its report.
    public IReadOnlyList<ImportRunDto> GetAll()
    {
        using var connection = db.Open();
        return connection.Query<ImportRunRow>(
                """
                SELECT Id, SourceCommit, CommittedUtc, ImportedUtc, Mode, GamesAdded, TilesAdded, LinksAdded, CountsFilled, NotesJson
                FROM ImportRuns ORDER BY Id DESC;
                """)
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
