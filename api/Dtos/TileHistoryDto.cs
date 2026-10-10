namespace Tiles18xx.Api.Dtos;

// A tile's history, as returned by GET /api/admin/tiles/{id}/history (admins only).
public sealed record TileHistoryDto
{
    public long TileId { get; init; }
    public string DisplayName { get; init; } = "";
    public string Source { get; init; } = ""; // generic, game-version, game-specific (imported), or user (added through the app)
    public bool IsDeleted { get; init; }

    // When the tile was added (imported tiles: when the database was seeded) and by whom (user tiles only).
    public string CreatedUtc { get; init; } = "";
    public string? CreatedByEmail { get; init; }

    // The last approved change, and the admin who made or approved it.
    public string? UpdatedUtc { get; init; }
    public string? UpdatedByEmail { get; init; }

    // Every change request about this tile, oldest first, with before/after content.
    public IReadOnlyList<ChangeRequestDto> Requests { get; init; } = [];
}
