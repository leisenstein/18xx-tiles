namespace Tiles18xx.Api.Data.Seeding.SeedModels;

// One entry in a game's tile manifest, keyed by tile number.
// Custom entries carry their own definition; others use the generic tile,
// so Code and Color are optional here and checked by the seeder for custom entries.
public sealed record SeedGameTile(
    bool Custom,
    string? Code = null,
    string? Color = null);
