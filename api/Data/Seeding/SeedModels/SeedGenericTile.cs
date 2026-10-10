namespace Tiles18xx.Api.Data.Seeding.SeedModels;

// One generic numbered tile in tiles.json (an array). Properties not listed here (games, variants, vgroups) are ignored.
public sealed record SeedGenericTile(string Name, string Color, string Code);
