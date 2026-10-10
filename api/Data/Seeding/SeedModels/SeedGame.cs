namespace Tiles18xx.Api.Data.Seeding.SeedModels;

// One game in games.json, which is an object keyed by module name (e.g. "G1830"). Properties not listed here (stage, alias, aliased) are ignored.
public sealed record SeedGame(string Title, string Dir, Dictionary<string, SeedGameTile> Tiles);
