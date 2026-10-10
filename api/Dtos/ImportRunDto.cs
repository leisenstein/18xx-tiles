namespace Tiles18xx.Api.Dtos;

// One import of the seed files, as returned by GET /api/admin/imports (admins only).
public sealed record ImportRunDto
{
    public long Id { get; init; }
    public string SourceCommit { get; init; } = "";
    public string? CommittedUtc { get; init; }
    public string ImportedUtc { get; init; } = "";
    public string Mode { get; init; } = ""; // seed or merge
    public long GamesAdded { get; init; }
    public long TilesAdded { get; init; }
    public long LinksAdded { get; init; }
    public long CountsFilled { get; init; }
    public IReadOnlyList<ImportNoteDto> Notes { get; init; } = [];
}
