namespace Tiles18xx.Api.Dtos;

// Query string for GET /api/tiles, e.g. ?game=25&color=yellow&kind=city&exits=2&q=57&page=1
public sealed record TileQueryDto
{
    public const int MaxPageSize = 200;
    public const int MaxSearchLength = 20;

    public long? Game { get; init; }
    public string? Color { get; init; }
    public string? Kind { get; init; }        // "city" or "town"
    public int? Exits { get; init; }          // 0 to 6: only tiles with track leaving exactly this many sides
    public string? Q { get; init; }           // text to find in the tile number
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 60;
}