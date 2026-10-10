namespace Tiles18xx.Api.Dtos;

// One line of the admin History page: a change request, a data import, or a game tile list save. Exactly one of Change, Import, and Game is set,
// matching Kind.
public sealed record HistoryEntryDto
{
    public const string ChangeKind = "change";
    public const string ImportKind = "import";
    public const string GameKind = "game";

    public string Kind { get; init; } = "";      // change, import, or game
    public string WhenUtc { get; init; } = "";   // when it was submitted (change) or ran (import); the list is sorted by this, newest first
    public ChangeRequestDto? Change { get; init; }
    public ImportRunDto? Import { get; init; }
    public GameChangeDto? Game { get; init; }
}
