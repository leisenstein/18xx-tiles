namespace Tiles18xx.Api.Data.Seeding.SeedModels;

// One entry in a game's tile manifest, keyed by tile number. Custom entries carry their own definition; others use the generic tile, so Code and Color are
// optional here and checked by the importer for custom entries. Count: tiles in the box, 999 = unlimited, null = not a plain number upstream.
public sealed record SeedGameTile(bool Custom, string? Code = null, string? Color = null, int? Count = null);
