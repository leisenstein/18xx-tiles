namespace Tiles18xx.Api.Dtos;

// A game's title, designer, and publisher: one side of an edit (GameDetailsChangeDto).
public sealed record GameDetailsDto
{
    public string Title { get; init; } = "";
    public string? Designer { get; init; }
    public string? Publisher { get; init; }
}

// An edit of a game's details, as stored in GameChanges.DetailsJson and shown on the History page.
public sealed record GameDetailsChangeDto
{
    public GameDetailsDto Before { get; init; } = new();
    public GameDetailsDto After { get; init; } = new();
}
