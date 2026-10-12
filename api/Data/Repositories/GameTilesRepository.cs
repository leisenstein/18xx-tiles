using System.Text.Json;
using Dapper;
using Tiles18xx.Api.Domain;
using Tiles18xx.Api.Dtos;

namespace Tiles18xx.Api.Data.Repositories;

// A game's tile list as a whole, for admins (Edit game tiles page, DESIGN.md section 8): read it, and save a complete new list in one transaction with
// an audit row in GameChanges. Only live tiles are listed and changed; links to deleted tiles are left as they are.
public sealed class GameTilesRepository(SqliteConnectionFactory db)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private const string SelectLinks = """
        SELECT t.Id, t.Number, t.Color, t.DisplayName, t.DefinitionCode, gt.Count, gt.Notes
        FROM GameTiles gt JOIN Tiles t ON t.Id = gt.TileId
        WHERE gt.GameId = @gameId AND t.IsDeleted = 0
        """;

    // The game and its live tiles in the usual tile order, or null if the game does not exist or was deleted.
    public GameTilesDto? Get(long gameId)
    {
        using var connection = db.Open();
        var title = connection.ExecuteScalar<string?>("SELECT Title FROM Games WHERE Id = @gameId AND IsDeleted = 0;", new { gameId });
        if (title is null)
        {
            return null;
        }
        var tiles = TileSort.Apply(connection.Query<LinkRow>(SelectLinks, new { gameId })).Select(r => r.ToDto()).ToList();
        return new GameTilesDto(gameId, title, tiles);
    }

    // Tile ids that are not live tiles (missing or deleted). The controller rejects a save that names any.
    public IReadOnlyList<long> NotLiveTileIds(IEnumerable<long> tileIds)
    {
        var ids = tileIds.Distinct().ToList();
        using var connection = db.Open();
        var live = connection.Query<long>("SELECT Id FROM Tiles WHERE Id IN @ids AND IsDeleted = 0;", new { ids }).ToHashSet();
        return ids.Where(id => !live.Contains(id)).ToList();
    }

    // Replace the game's live tile links with this list: add new ones, remove missing ones, update changed counts and notes. Records a GameChanges row.
    // Fails (409) when nothing would change.
    public ReviewResult Save(long gameId, IReadOnlyList<GameTileInputDto> tiles, string userId, string? reason)
    {
        using var connection = db.Open();
        using var transaction = connection.BeginTransaction();
        if (connection.ExecuteScalar<long>("SELECT COUNT(*) FROM Games WHERE Id = @gameId AND IsDeleted = 0;", new { gameId }, transaction) == 0)
        {
            return ReviewResult.NotFound;
        }

        var before = connection.Query<LinkRow>(SelectLinks, new { gameId }, transaction).Select(r => r.ToInput()).OrderBy(l => l.TileId).ToList();
        var after = tiles.OrderBy(l => l.TileId).ToList();
        var oldById = before.ToDictionary(l => l.TileId);
        var newById = after.ToDictionary(l => l.TileId);
        if (before.SequenceEqual(after))
        {
            return ReviewResult.Fail("Nothing changed.");
        }

        foreach (var removed in before.Where(l => !newById.ContainsKey(l.TileId)))
        {
            connection.Execute("DELETE FROM GameTiles WHERE GameId = @gameId AND TileId = @TileId;", new { gameId, removed.TileId }, transaction);
        }
        foreach (var link in after)
        {
            if (!oldById.TryGetValue(link.TileId, out var old))
            {
                connection.Execute(
                    "INSERT INTO GameTiles (GameId, TileId, Count, Notes) VALUES (@gameId, @TileId, @Count, @Notes);",
                    new { gameId, link.TileId, link.Count, link.Notes },
                    transaction);
            }
            else if (old != link)
            {
                connection.Execute(
                    "UPDATE GameTiles SET Count = @Count, Notes = @Notes WHERE GameId = @gameId AND TileId = @TileId;",
                    new { gameId, link.TileId, link.Count, link.Notes },
                    transaction);
            }
        }

        connection.Execute(
            """
            INSERT INTO GameChanges (GameId, ChangedBy, ChangedUtc, Reason, BeforeJson, AfterJson)
            VALUES (@gameId, @userId, @now, @reason, @beforeJson, @afterJson);
            """,
            new
            {
                gameId,
                userId,
                now = DateTime.UtcNow.ToString("O"),
                reason,
                beforeJson = JsonSerializer.Serialize(before, Json),
                afterJson = JsonSerializer.Serialize(after, Json),
            },
            transaction);
        transaction.Commit();
        return ReviewResult.Done;
    }

    // Saved changes by id, for the History page: each tile added, removed, or changed, with its name and drawing data (deleted tiles included).
    public IReadOnlyList<GameChangeDto> GetChanges(IReadOnlyCollection<long> ids)
    {
        if (ids.Count == 0)
        {
            return [];
        }
        using var connection = db.Open();
        var rows = connection.Query<ChangeRow>(
                """
                SELECT gc.Id, gc.GameId, g.Title AS GameTitle, g.IsDeleted AS GameDeleted, u.Email AS ChangedByEmail, gc.ChangedUtc, gc.Reason,
                       gc.BeforeJson, gc.AfterJson, gc.Kind, gc.DetailsJson
                FROM GameChanges gc
                JOIN Games g ON g.Id = gc.GameId
                LEFT JOIN AspNetUsers u ON u.Id = gc.ChangedBy
                WHERE gc.Id IN @ids;
                """,
                new { ids })
            .ToList();
        var parsed = rows.Select(r => (Row: r, Before: Parse(r.BeforeJson), After: Parse(r.AfterJson))).ToList();
        var tileIds = parsed.SelectMany(p => p.Before.Concat(p.After)).Select(l => l.TileId).Distinct().ToList();
        var tiles = connection.Query<LinkRow>("SELECT Id, Number, Color, DisplayName, DefinitionCode FROM Tiles WHERE Id IN @tileIds;", new { tileIds })
            .ToDictionary(t => t.Id);

        return parsed.Select(p => new GameChangeDto
        {
            Id = p.Row.Id,
            GameId = p.Row.GameId,
            GameTitle = p.Row.GameTitle,
            GameDeleted = p.Row.GameDeleted,
            Kind = p.Row.Kind,
            Details = p.Row.DetailsJson is null ? null : JsonSerializer.Deserialize<GameDetailsChangeDto>(p.Row.DetailsJson, Json),
            ChangedByEmail = p.Row.ChangedByEmail,
            ChangedUtc = p.Row.ChangedUtc,
            Reason = p.Row.Reason,
            Changes = Diff(p.Before, p.After, tiles),
        }).ToList();
    }

    private static List<GameTileInputDto> Parse(string json) => JsonSerializer.Deserialize<List<GameTileInputDto>>(json, Json) ?? [];

    // Added, removed, and changed tiles between two lists, in the usual tile order.
    private static IReadOnlyList<GameTileChangeDto> Diff(List<GameTileInputDto> before, List<GameTileInputDto> after, Dictionary<long, LinkRow> tiles)
    {
        var oldById = before.ToDictionary(l => l.TileId);
        var newById = after.ToDictionary(l => l.TileId);
        var changes = new List<(LinkRow Tile, GameTileChangeDto Change)>();
        foreach (var id in oldById.Keys.Union(newById.Keys))
        {
            oldById.TryGetValue(id, out var old);
            newById.TryGetValue(id, out var now);
            if (old == now)
            {
                continue;
            }
            var tile = tiles.GetValueOrDefault(id) ?? new LinkRow { Id = id, Number = "?", Color = "none", DisplayName = $"tile {id}" };
            var kind = old is null ? GameTileChangeDto.Added : now is null ? GameTileChangeDto.Removed : GameTileChangeDto.Changed;
            changes.Add((tile, new GameTileChangeDto
            {
                Kind = kind,
                TileId = id,
                DisplayName = tile.DisplayName,
                Number = tile.Number,
                Color = tile.Color,
                DefinitionCode = tile.DefinitionCode,
                BeforeCount = old?.Count,
                BeforeNotes = old?.Notes,
                AfterCount = now?.Count,
                AfterNotes = now?.Notes,
            }));
        }
        var order = TileSort.Apply(changes.Select(c => c.Tile)).Select((t, i) => (t.Id, i)).ToDictionary(x => x.Id, x => x.i);
        return changes.OrderBy(c => order[c.Tile.Id]).Select(c => c.Change).ToList();
    }

    // Dapper rows: init-property records, so nullable columns map cleanly (DESIGN.md 5.1).
    private sealed record LinkRow : ISortableTile
    {
        public long Id { get; init; }
        public string Number { get; init; } = "";
        public string Color { get; init; } = "";
        public string DisplayName { get; init; } = "";
        public string DefinitionCode { get; init; } = "";
        public int? Count { get; init; }
        public string? Notes { get; init; }

        public GameTileDto ToDto() => new()
        {
            TileId = Id,
            Number = Number,
            Color = Color,
            DisplayName = DisplayName,
            DefinitionCode = DefinitionCode,
            Count = Count,
            Notes = Notes,
        };

        public GameTileInputDto ToInput() => new() { TileId = Id, Count = Count, Notes = Notes };
    }

    private sealed record ChangeRow
    {
        public long Id { get; init; }
        public long GameId { get; init; }
        public string GameTitle { get; init; } = "";
        public bool GameDeleted { get; init; }
        public string? ChangedByEmail { get; init; }
        public string ChangedUtc { get; init; } = "";
        public string? Reason { get; init; }
        public string BeforeJson { get; init; } = "[]";
        public string AfterJson { get; init; } = "[]";
        public string Kind { get; init; } = "tiles";
        public string? DetailsJson { get; init; }
    }
}
