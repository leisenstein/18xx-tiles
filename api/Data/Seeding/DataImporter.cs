using System.Data;
using System.Reflection;
using System.Text.Json;
using Dapper;
using Tiles18xx.Api.Data.Repositories;
using Tiles18xx.Api.Data.Seeding.SeedModels;
using Tiles18xx.Api.Domain;
using Tiles18xx.Api.Dtos;

namespace Tiles18xx.Api.Data.Seeding;

// Applies the embedded seed files (games.json, tiles.json, source.json from tools/import/update_data.py) at startup. DESIGN.md section 6.4.
// - Each tobymao/18xx commit is applied once: ImportRuns records it, and later starts skip it.
// - Empty database: "seed" mode loads everything.
// - Existing data: "merge" mode only ADDS (new games, tiles, and game links) and FILLS empty counts. It never overwrites or deletes anything edited in the
//   app; upstream changes it cannot apply safely become notes in the import report (Admin > Imports), so an admin can apply them by hand.
// To start over in development, stop the API and delete data/tiles.db*.
public static class DataImporter
{
    public const string CountNote = "Count from 18xx.games manifest";

    private const string SourceGeneric = "generic";
    private const string SourceGameVersion = "game-version";
    private const string SourceGameSpecific = "game-specific";

    // Kinds of notes in the import report.
    public static class NoteKinds
    {
        public const string GameRenamed = "game-renamed";              // applied: games are not editable in the app
        public const string GameNotRenamed = "game-not-renamed";       // the new title belongs to another game
        public const string GameNotUpstream = "game-not-upstream";     // kept
        public const string GenericChanged = "generic-changed";        // not applied
        public const string DefinitionChanged = "definition-changed";  // not applied
        public const string DeletedInApp = "deleted-in-app";           // not linked again
        public const string CountDiffers = "count-differs";            // the app's count kept
        public const string NotUpstream = "not-upstream";              // link kept
    }

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        RespectNullableAnnotations = true,
        RespectRequiredConstructorParameters = true,
    };

    private static readonly JsonSerializerOptions NotesJsonOptions = new(JsonSerializerDefaults.Web);

    public static void Run(SqliteConnectionFactory db, ILogger logger)
    {
        var source = ReadResource<SeedSource>("Seed.source.json");
        using var connection = db.Open();

        if (connection.ExecuteScalar<long>("SELECT COUNT(*) FROM ImportRuns WHERE SourceCommit = @Commit;", new { source.Commit }) > 0)
        {
            logger.LogInformation("Import skipped: commit {Commit} was already applied.", source.Commit);
            return;
        }

        var games = ReadResource<Dictionary<string, SeedGame>>("Seed.games.json").OrderBy(g => g.Key, StringComparer.Ordinal).ToList();
        var genericTiles = ReadResource<List<SeedGenericTile>>("Seed.tiles.json");
        var (tiles, links) = BuildPlan(games, genericTiles, logger);
        AssignDisplayNames(tiles);

        using var transaction = connection.BeginTransaction();
        var import = new Import(connection, transaction, $"18xx.games commit {source.Commit}", DateTime.UtcNow.ToString("O"));
        var empty = connection.ExecuteScalar<long>("SELECT COUNT(*) FROM Tiles;", transaction: transaction) == 0;
        if (empty)
        {
            import.Seed(games, tiles, links);
        }
        else
        {
            import.Merge(games, tiles, links);
        }

        connection.Execute(
            """
            INSERT INTO ImportRuns (SourceCommit, CommittedUtc, ImportedUtc, Mode, GamesAdded, TilesAdded, LinksAdded, CountsFilled, NotesJson)
            VALUES (@Commit, @CommittedUtc, @Now, @Mode, @GamesAdded, @TilesAdded, @LinksAdded, @CountsFilled, @NotesJson);
            """,
            new
            {
                source.Commit,
                source.CommittedUtc,
                import.Now,
                Mode = empty ? "seed" : "merge",
                import.GamesAdded,
                import.TilesAdded,
                import.LinksAdded,
                import.CountsFilled,
                NotesJson = JsonSerializer.Serialize(import.Notes, NotesJsonOptions),
            },
            transaction);
        transaction.Commit();

        logger.LogInformation(
            "Imported commit {Commit} ({Mode}): {Games} games, {Tiles} tiles, {Links} game-tile links added; {Counts} counts filled; {Notes} notes for review.",
            source.Commit, empty ? "seed" : "merge", import.GamesAdded, import.TilesAdded, import.LinksAdded, import.CountsFilled, import.Notes.Count);
    }

    // Reads the report back for GET /api/admin/imports.
    public static IReadOnlyList<ImportNoteDto> ReadNotes(string json) => JsonSerializer.Deserialize<List<ImportNoteDto>>(json, NotesJsonOptions) ?? [];

    // ---- The plan: every distinct tile in the seed files, and every (game, tile) link, before touching the database ----

    private static (List<PlannedTile> Tiles, List<PlannedLink> Links) BuildPlan(
        List<KeyValuePair<string, SeedGame>> games, List<SeedGenericTile> genericTiles, ILogger logger)
    {
        var tiles = new List<PlannedTile>();
        var tilesByKey = new Dictionary<(string Number, string Color, string SortedCode), PlannedTile>();
        var genericByNumber = new Dictionary<string, PlannedTile>(StringComparer.Ordinal);

        foreach (var generic in genericTiles)
        {
            RequireKnownColor(generic.Color, $"generic tile {generic.Name}");

            var tile = new PlannedTile(generic.Name, generic.Color, generic.Code.Trim(), SourceGeneric);
            if (!genericByNumber.TryAdd(tile.Number, tile))
            {
                throw new InvalidOperationException($"Duplicate generic tile number '{tile.Number}'.");
            }
            tilesByKey.Add(tile.Key, tile);
            tiles.Add(tile);
        }

        var links = new List<PlannedLink>();

        foreach (var (gameKey, game) in games)
        {
            foreach (var (number, entry) in game.Tiles.OrderBy(t => t.Key, StringComparer.Ordinal))
            {
                PlannedTile? tile;

                if (!entry.Custom)
                {
                    if (!genericByNumber.TryGetValue(number, out tile))
                    {
                        logger.LogWarning("Import: {Game} refers to generic tile '{Number}', which does not exist. Skipped.", gameKey, number);
                        continue;
                    }
                }
                else
                {
                    if (entry.Code is null || entry.Color is null)
                    {
                        throw new InvalidOperationException($"Custom tile '{number}' in {gameKey} is missing its code or color.");
                    }
                    RequireKnownColor(entry.Color, $"tile '{number}' in {gameKey}");

                    var key = Key(number, entry.Color, entry.Code);
                    if (!tilesByKey.TryGetValue(key, out tile))
                    {
                        var source = genericByNumber.ContainsKey(number) ? SourceGameVersion : SourceGameSpecific;
                        tile = new PlannedTile(number, entry.Color, entry.Code.Trim(), source);
                        tilesByKey.Add(key, tile);
                        tiles.Add(tile);
                    }
                }

                tile.GameTitles.Add(game.Title);
                // Counts outside the app's rules (Domain/TileCounts) are stored as unknown.
                links.Add(new PlannedLink(gameKey, game.Title, tile, TileCounts.IsValid(entry.Count) ? entry.Count : null));
            }
        }

        return (tiles, links);
    }

    // "#N" when the number has one row (or for the generic tile); "#N (Game)" for a version used by one game; "#N (variant k)" for a version shared by several.
    private static void AssignDisplayNames(List<PlannedTile> tiles)
    {
        var rowsPerNumber = tiles.GroupBy(t => t.Number, StringComparer.Ordinal).ToDictionary(g => g.Key, g => g.Count(), StringComparer.Ordinal);
        var variantCounters = new Dictionary<string, int>(StringComparer.Ordinal);

        foreach (var tile in tiles)
        {
            if (tile.Source == SourceGeneric || rowsPerNumber[tile.Number] == 1)
            {
                tile.DisplayName = $"#{tile.Number}";
            }
            else if (tile.GameTitles.Count == 1)
            {
                tile.DisplayName = ChangeRequestsRepository.VariantDisplayName(tile.Number, tile.GameTitles[0]);
            }
            else
            {
                var k = variantCounters.GetValueOrDefault(tile.Number) + 1;
                variantCounters[tile.Number] = k;
                tile.DisplayName = ChangeRequestsRepository.VariantDisplayName(tile.Number, $"variant {k}");
            }
        }
    }

    // ---- Applying the plan, inside one transaction ----

    private sealed class Import(IDbConnection connection, IDbTransaction transaction, string sourceRef, string now)
    {
        public string Now { get; } = now;
        public int GamesAdded { get; private set; }
        public int TilesAdded { get; private set; }
        public int LinksAdded { get; private set; }
        public int CountsFilled { get; private set; }
        public List<ImportNoteDto> Notes { get; } = [];

        // Empty database: insert everything.
        public void Seed(List<KeyValuePair<string, SeedGame>> games, List<PlannedTile> tiles, List<PlannedLink> links)
        {
            var gameIds = games.ToDictionary(g => g.Key, g => InsertGame(g.Value), StringComparer.Ordinal);
            foreach (var tile in tiles)
            {
                InsertTile(tile, tile.DisplayName);
            }
            foreach (var link in links)
            {
                InsertLink(gameIds[link.GameKey], link.Tile.Id, link.Count);
            }
        }

        // Existing data: add what is new, fill empty counts, and note everything else.
        public void Merge(List<KeyValuePair<string, SeedGame>> games, List<PlannedTile> tiles, List<PlannedLink> links)
        {
            // Games, matched by folder name (SourceKey), which does not change when a title does.
            var dbGames = connection.Query<GameRow>("SELECT Id, Title, SourceKey FROM Games;", transaction: transaction)
                .ToDictionary(g => g.SourceKey, StringComparer.Ordinal);
            var titles = dbGames.Values.Select(g => g.Title).ToHashSet(StringComparer.Ordinal);
            var gameIds = new Dictionary<string, long>(StringComparer.Ordinal);
            foreach (var (gameKey, game) in games)
            {
                if (!dbGames.TryGetValue(game.Dir, out var row))
                {
                    gameIds[gameKey] = InsertGame(game);
                    titles.Add(game.Title);
                    continue;
                }
                gameIds[gameKey] = row.Id;
                if (row.Title == game.Title)
                {
                    continue;
                }
                if (titles.Contains(game.Title))
                {
                    Note(NoteKinds.GameNotRenamed, $"{row.Title}: the title upstream is now \"{game.Title}\", which another game already uses. Not renamed.");
                    continue;
                }
                connection.Execute("UPDATE Games SET Title = @Title WHERE Id = @Id;", new { game.Title, row.Id }, transaction);
                titles.Remove(row.Title);
                titles.Add(game.Title);
                Note(NoteKinds.GameRenamed, $"Renamed \"{row.Title}\" to \"{game.Title}\", as upstream.");
            }
            var upstreamDirs = games.Select(g => g.Value.Dir).ToHashSet(StringComparer.Ordinal);
            foreach (var row in dbGames.Values.Where(g => !upstreamDirs.Contains(g.SourceKey)).OrderBy(g => g.Title, StringComparer.OrdinalIgnoreCase))
            {
                Note(NoteKinds.GameNotUpstream, $"{row.Title} is no longer in the upstream repository. Kept.");
            }

            // Tiles already in the database, matched by number, color, and definition (parts in any order). Live rows win over deleted ones.
            var dbTiles = connection.Query<TileRow>("SELECT Id, Number, Color, DefinitionCode, DisplayName, IsDeleted FROM Tiles;", transaction: transaction)
                .GroupBy(t => Key(t.Number, t.Color, t.DefinitionCode))
                .ToDictionary(g => g.Key, g => g.OrderBy(t => t.IsDeleted).First());

            // A generic tile whose definition changed upstream would duplicate the app's generic tile, so it is noted and not added.
            var liveGenericNumbers = connection.Query<string>(
                "SELECT Number FROM Tiles WHERE Source = @SourceGeneric AND IsDeleted = 0;", new { SourceGeneric }, transaction).ToHashSet(StringComparer.Ordinal);
            foreach (var tile in tiles.Where(t => t.Source == SourceGeneric))
            {
                if (dbTiles.ContainsKey(tile.Key))
                {
                    continue;
                }
                if (liveGenericNumbers.Contains(tile.Number))
                {
                    tile.ChangedUpstream = true;
                    Note(NoteKinds.GenericChanged,
                        $"Generic tile #{tile.Number} has a new definition upstream ({tile.Color}: {tile.DefinitionCode}). Not applied; edit the tile to update it.");
                }
                else
                {
                    dbTiles[tile.Key] = AddTile(tile);
                }
            }

            // The app's live game links, by (game, tile number).
            var dbLinks = connection.Query<LinkRow>(
                """
                SELECT gt.GameId, gt.TileId, gt.Count, t.Number, t.DisplayName
                FROM GameTiles gt JOIN Tiles t ON t.Id = gt.TileId
                WHERE t.IsDeleted = 0;
                """,
                transaction: transaction).ToLookup(l => (l.GameId, l.Number));

            var upstreamLinks = new HashSet<(long GameId, string Number)>();
            foreach (var link in links)
            {
                var gameId = gameIds[link.GameKey];
                upstreamLinks.Add((gameId, link.Tile.Number));
                var existing = dbLinks[(gameId, link.Tile.Number)].ToList();

                // Generic tile changed upstream: the game keeps the app's version; only its count can be filled.
                if (link.Tile.ChangedUpstream)
                {
                    if (existing.Count == 1)
                    {
                        FillCount(existing[0], link);
                    }
                    continue;
                }

                dbTiles.TryGetValue(link.Tile.Key, out var match);
                if (match is { IsDeleted: true })
                {
                    if (existing.Count == 0)
                    {
                        Note(NoteKinds.DeletedInApp, $"{link.GameTitle}: {match.DisplayName} was deleted in the app. Not added back.");
                    }
                    continue;
                }

                var same = existing.FirstOrDefault(l => match is not null && l.TileId == match.Id);
                if (same is not null)
                {
                    FillCount(same, link);
                    continue;
                }
                if (existing.Count > 0)
                {
                    Note(NoteKinds.DefinitionChanged,
                        $"{link.GameTitle}: tile {link.Tile.Number} upstream is {link.Tile.Color}: {link.Tile.DefinitionCode}. The game uses "
                        + $"{string.Join(", ", existing.Select(l => l.DisplayName))} in the app. Not applied.");
                    continue;
                }

                match ??= dbTiles[link.Tile.Key] = AddTile(link.Tile);
                InsertLink(gameId, match.Id, link.Count);
            }

            // Links in the app that the upstream manifest does not have (removed upstream, or added by an admin): kept, and listed.
            var titlesById = games.ToDictionary(g => gameIds[g.Key], g => g.Value.Title);
            foreach (var group in dbLinks.Where(g => titlesById.ContainsKey(g.Key.GameId) && !upstreamLinks.Contains(g.Key)))
            {
                foreach (var row in group)
                {
                    Note(NoteKinds.NotUpstream, $"{titlesById[row.GameId]}: {row.DisplayName} is not in the upstream manifest. Kept.");
                }
            }
        }

        // Fill an empty count from the manifest; never replace a count someone entered.
        private void FillCount(LinkRow row, PlannedLink link)
        {
            if (link.Count is null || row.Count == link.Count)
            {
                return;
            }
            if (row.Count is not null)
            {
                Note(NoteKinds.CountDiffers,
                    $"{link.GameTitle}: {row.DisplayName} count is {CountText(row.Count.Value)} in the app and {CountText(link.Count.Value)} upstream. Kept.");
                return;
            }
            connection.Execute(
                "UPDATE GameTiles SET Count = @Count, Notes = COALESCE(Notes, @CountNote) WHERE GameId = @GameId AND TileId = @TileId AND Count IS NULL;",
                new { link.Count, CountNote, row.GameId, row.TileId },
                transaction);
            CountsFilled++;
        }

        // A new tile during a merge: keep the planned display name unless the app already uses it for another tile.
        private TileRow AddTile(PlannedTile tile)
        {
            var taken = connection.Query<string>(
                "SELECT DisplayName FROM Tiles WHERE Number = @Number AND IsDeleted = 0;", new { tile.Number }, transaction).ToHashSet(StringComparer.Ordinal);
            var candidates = new List<string> { tile.DisplayName };
            if (tile.GameTitles.Count == 1)
            {
                candidates.Add(ChangeRequestsRepository.VariantDisplayName(tile.Number, tile.GameTitles[0]));
            }
            var name = candidates.FirstOrDefault(c => !taken.Contains(c))
                ?? Enumerable.Range(1, int.MaxValue).Select(k => ChangeRequestsRepository.VariantDisplayName(tile.Number, $"variant {k}")).First(c => !taken.Contains(c));
            InsertTile(tile, name);
            return new TileRow { Id = tile.Id, Number = tile.Number, Color = tile.Color, DefinitionCode = tile.DefinitionCode, DisplayName = name };
        }

        private long InsertGame(SeedGame game)
        {
            GamesAdded++;
            return connection.ExecuteScalar<long>(
                "INSERT INTO Games (Title, SourceKey, CreatedUtc) VALUES (@Title, @SourceKey, @Now) RETURNING Id;",
                new { game.Title, SourceKey = game.Dir, Now },
                transaction);
        }

        private void InsertTile(PlannedTile tile, string displayName)
        {
            TilesAdded++;
            tile.Id = connection.ExecuteScalar<long>(
                """
                INSERT INTO Tiles (Number, Color, DefinitionCode, DisplayName, HasCity, HasTown, Source, SourceRef, CreatedUtc)
                VALUES (@Number, @Color, @DefinitionCode, @displayName, @HasCity, @HasTown, @Source, @sourceRef, @Now)
                RETURNING Id;
                """,
                new
                {
                    tile.Number,
                    tile.Color,
                    tile.DefinitionCode,
                    displayName,
                    HasCity = TileDefinition.Has(tile.DefinitionCode, "city"),
                    HasTown = TileDefinition.Has(tile.DefinitionCode, "town"),
                    tile.Source,
                    sourceRef,
                    Now,
                },
                transaction);
        }

        private void InsertLink(long gameId, long tileId, int? count)
        {
            LinksAdded++;
            if (count is not null)
            {
                CountsFilled++;
            }
            connection.Execute(
                "INSERT INTO GameTiles (GameId, TileId, Count, Notes) VALUES (@gameId, @tileId, @count, @notes);",
                new { gameId, tileId, count, notes = count is null ? null : CountNote },
                transaction);
        }

        private void Note(string kind, string message) => Notes.Add(new ImportNoteDto(kind, message));

        private static string CountText(int count) => count == TileCounts.Unlimited ? "unlimited" : count.ToString();
    }

    // Design doc rule 6.3.7: compare definitions by their trimmed parts in sorted order.
    private static (string, string, string) Key(string number, string color, string code) =>
        (number, color, string.Join(";", code.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Order(StringComparer.Ordinal)));

    private static void RequireKnownColor(string color, string context)
    {
        if (!TileColors.IsKnown(color))
        {
            throw new InvalidOperationException($"Unknown color '{color}' for {context}.");
        }
    }

    private static T ReadResource<T>(string name)
    {
        using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(name)
            ?? throw new InvalidOperationException($"Embedded seed file '{name}' was not found. Run tools/import/update_data.py, then rebuild.");
        return JsonSerializer.Deserialize<T>(stream, JsonOptions) ?? throw new InvalidOperationException($"Embedded seed file '{name}' is empty.");
    }

    private sealed class PlannedTile(string number, string color, string definitionCode, string source)
    {
        public string Number { get; } = number;
        public string Color { get; } = color;
        public string DefinitionCode { get; } = definitionCode;
        public string Source { get; } = source;
        public (string, string, string) Key { get; } = DataImporter.Key(number, color, definitionCode);
        public List<string> GameTitles { get; } = [];
        public string DisplayName { get; set; } = "";
        public long Id { get; set; }
        public bool ChangedUpstream { get; set; }
    }

    private sealed record PlannedLink(string GameKey, string GameTitle, PlannedTile Tile, int? Count);

    // Dapper rows: init-property records, so bool and nullable columns map cleanly (DESIGN.md 5.1).
    private sealed record GameRow
    {
        public long Id { get; init; }
        public string Title { get; init; } = "";
        public string SourceKey { get; init; } = "";
    }

    private sealed record TileRow
    {
        public long Id { get; init; }
        public string Number { get; init; } = "";
        public string Color { get; init; } = "";
        public string DefinitionCode { get; init; } = "";
        public string DisplayName { get; init; } = "";
        public bool IsDeleted { get; init; }
    }

    private sealed record LinkRow
    {
        public long GameId { get; init; }
        public long TileId { get; init; }
        public int? Count { get; init; }
        public string Number { get; init; } = "";
        public string DisplayName { get; init; } = "";
    }
}
