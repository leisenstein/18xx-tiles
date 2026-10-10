using System.Reflection;
using System.Text.Json;
using Dapper;
using Tiles18xx.Api.Data;
using Tiles18xx.Api.Data.Seeding.SeedModels;

namespace Tiles18xx.Api.Data.Seeding;

// Loads games and tiles from the embedded seed files into an empty database.
// Runs only when Tiles has no rows. To re-seed in development, stop the API
// and delete data/tiles.db* so DbUp and this seeder start from scratch.
public static class DataSeeder
{
    private const string SourceRef = "18xx.games commit 46a592e40494368390c9a731978a577ac4ecb1e0";

    private const string SourceGeneric = "generic";
    private const string SourceGameVersion = "game-version";
    private const string SourceGameSpecific = "game-specific";

    private static readonly HashSet<string> KnownColors = new(StringComparer.Ordinal)
    {
        "yellow", "green", "brown", "gray", "greenbrown", "browngray", "brownsepia", "none",
        "red", "blue", "purple", "white", "orange",
    };

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        RespectNullableAnnotations = true,
        RespectRequiredConstructorParameters = true,
    };

    public static void SeedIfEmpty(SqliteConnectionFactory db, ILogger logger)
    {
        using var connection = db.Open();

        var existingTiles = connection.ExecuteScalar<long>("SELECT COUNT(*) FROM Tiles;");
        if (existingTiles > 0)
        {
            logger.LogInformation("Seed skipped: Tiles already has {Count} rows.", existingTiles);
            return;
        }

        var games = ReadResource<Dictionary<string, SeedGame>>("Seed.games.json")
            .OrderBy(g => g.Key, StringComparer.Ordinal)
            .ToList();
        var genericTiles = ReadResource<List<SeedGenericTile>>("Seed.tiles.json");

        var (tiles, links) = BuildPlan(games, genericTiles, logger);
        AssignDisplayNames(tiles);

        var now = DateTime.UtcNow.ToString("O");
        using var transaction = connection.BeginTransaction();

        var gameIds = new Dictionary<string, long>(StringComparer.Ordinal);
        foreach (var (gameKey, game) in games)
        {
            gameIds[gameKey] = connection.ExecuteScalar<long>(
                """
                INSERT INTO Games (Title, SourceKey, DevStage, CreatedUtc)
                VALUES (@Title, @SourceKey, @DevStage, @CreatedUtc)
                RETURNING Id;
                """,
                new
                {
                    game.Title,
                    SourceKey = game.Dir,
                    DevStage = ToDevStage(game.Stage, gameKey),
                    CreatedUtc = now,
                },
                transaction);
        }

        foreach (var tile in tiles)
        {
            var partNames = PartNames(tile.DefinitionCode).ToHashSet(StringComparer.Ordinal);
            tile.Id = connection.ExecuteScalar<long>(
                """
                INSERT INTO Tiles (Number, Color, DefinitionCode, DisplayName, HasCity, HasTown,
                                   Source, SourceRef, CreatedUtc)
                VALUES (@Number, @Color, @DefinitionCode, @DisplayName, @HasCity, @HasTown,
                        @Source, @SourceRef, @CreatedUtc)
                RETURNING Id;
                """,
                new
                {
                    tile.Number,
                    tile.Color,
                    tile.DefinitionCode,
                    tile.DisplayName,
                    HasCity = partNames.Contains("city"),
                    HasTown = partNames.Contains("town"),
                    tile.Source,
                    SourceRef,
                    CreatedUtc = now,
                },
                transaction);
        }

        // GameTiles.Count and Notes stay NULL: the snapshot has no per-game counts.
        connection.Execute(
            "INSERT INTO GameTiles (GameId, TileId) VALUES (@GameId, @TileId);",
            links.Select(l => new { GameId = gameIds[l.GameKey], TileId = l.Tile.Id }),
            transaction);

        transaction.Commit();

        logger.LogInformation(
            "Seeded {Games} games, {Tiles} tiles, {Links} game-tile links.",
            games.Count, tiles.Count, links.Count);
    }

    private static (List<PlannedTile> Tiles, List<(string GameKey, PlannedTile Tile)> Links) BuildPlan(
        List<KeyValuePair<string, SeedGame>> games,
        List<SeedGenericTile> genericTiles,
        ILogger logger)
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
            tilesByKey.Add(Key(tile.Number, tile.Color, tile.DefinitionCode), tile);
            tiles.Add(tile);
        }

        var links = new List<(string GameKey, PlannedTile Tile)>();

        foreach (var (gameKey, game) in games)
        {
            foreach (var (number, entry) in game.Tiles.OrderBy(t => t.Key, StringComparer.Ordinal))
            {
                PlannedTile? tile;

                if (!entry.Custom)
                {
                    if (!genericByNumber.TryGetValue(number, out tile))
                    {
                        logger.LogWarning(
                            "Seed: {Game} refers to generic tile '{Number}', which does not exist. Skipped.",
                            gameKey, number);
                        continue;
                    }
                }
                else
                {
                    if (entry.Code is null || entry.Color is null)
                    {
                        throw new InvalidOperationException(
                            $"Custom tile '{number}' in {gameKey} is missing its code or color.");
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
                links.Add((gameKey, tile));
            }
        }

        return (tiles, links);
    }

    // "#N" when the number has one row (or for the generic tile);
    // "#N (Game)" for a version used by one game; "#N (variant k)" for a version shared by several.
    private static void AssignDisplayNames(List<PlannedTile> tiles)
    {
        var rowsPerNumber = tiles
            .GroupBy(t => t.Number, StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.Count(), StringComparer.Ordinal);
        var variantCounters = new Dictionary<string, int>(StringComparer.Ordinal);

        foreach (var tile in tiles)
        {
            if (tile.Source == SourceGeneric || rowsPerNumber[tile.Number] == 1)
            {
                tile.DisplayName = $"#{tile.Number}";
            }
            else if (tile.GameTitles.Count == 1)
            {
                tile.DisplayName = $"#{tile.Number} ({tile.GameTitles[0]})";
            }
            else
            {
                var k = variantCounters.GetValueOrDefault(tile.Number) + 1;
                variantCounters[tile.Number] = k;
                tile.DisplayName = $"#{tile.Number} (variant {k})";
            }
        }
    }

    // Design doc rule 6.3.7: compare definitions by their trimmed parts in sorted order.
    private static (string, string, string) Key(string number, string color, string code) =>
        (number, color, string.Join(";", SplitParts(code).Order(StringComparer.Ordinal)));

    private static string[] SplitParts(string code) =>
        code.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    // Part type is the text before '=' ("city=revenue:30" -> "city"; "junction" -> "junction").
    private static IEnumerable<string> PartNames(string code) =>
        SplitParts(code).Select(p => p.IndexOf('=') is var i and >= 0 ? p[..i] : p);

    private static void RequireKnownColor(string color, string context)
    {
        if (!KnownColors.Contains(color))
        {
            throw new InvalidOperationException($"Unknown color '{color}' for {context}.");
        }
    }

    private static string? ToDevStage(string? stage, string gameKey) => stage switch
    {
        "production" or "beta" or "alpha" or "prealpha" => stage,
        "?" or null => null,
        _ => throw new InvalidOperationException($"Unknown stage '{stage}' for {gameKey}."),
    };

    private static T ReadResource<T>(string name)
    {
        using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(name)
            ?? throw new InvalidOperationException($"Embedded seed file '{name}' was not found.");
        return JsonSerializer.Deserialize<T>(stream, JsonOptions)
            ?? throw new InvalidOperationException($"Embedded seed file '{name}' is empty.");
    }

    private sealed class PlannedTile(string number, string color, string definitionCode, string source)
    {
        public string Number { get; } = number;
        public string Color { get; } = color;
        public string DefinitionCode { get; } = definitionCode;
        public string Source { get; } = source;
        public List<string> GameTitles { get; } = [];
        public string DisplayName { get; set; } = "";
        public long Id { get; set; }
    }
}
