namespace Tiles18xx.Api.Db;

// Shapes of the embedded seed files (Db/Seed/*.json), produced by the
// planning-session prototype from tobymao/18xx. Properties not listed here
// (alias, aliased, games, variants, vgroups) are ignored.

// games.json: object keyed by module name (e.g. "G1830").
public sealed record SeedGame(
    string Title,
    string? Stage,
    string Dir,
    Dictionary<string, SeedGameTile> Tiles);

// One entry in a game's tile manifest, keyed by tile number.
// Custom entries carry their own definition; others use the generic tile,
// so Code and Color are optional here and checked by the seeder for custom entries.
public sealed record SeedGameTile(
    bool Custom,
    string? Code = null,
    string? Color = null);

// tiles.json: array of generic numbered tiles.
public sealed record SeedGenericTile(
    string Name,
    string Color,
    string Code);
