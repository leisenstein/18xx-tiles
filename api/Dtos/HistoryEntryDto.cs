namespace Tiles18xx.Api.Dtos;

// One line of the admin History page: either a change request or a data import. Exactly one of Change and Import is set, matching Kind.
public sealed record HistoryEntryDto
{
    public const string ChangeKind = "change";
    public const string ImportKind = "import";

    public string Kind { get; init; } = "";      // change or import
    public string WhenUtc { get; init; } = "";   // when it was submitted (change) or ran (import); the list is sorted by this, newest first
    public ChangeRequestDto? Change { get; init; }
    public ImportRunDto? Import { get; init; }
}
