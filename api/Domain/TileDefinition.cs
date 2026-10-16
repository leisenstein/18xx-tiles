using System.Globalization;

namespace Tiles18xx.Api.Domain;

// Checks and reads tile definition strings such as "city=revenue:20;path=a:0,b:_0" (tobymao/18xx TILES.md "Tile language"; DESIGN.md section 8:
// "known part types only, edges 0 to 5, node references in range").
public static class TileDefinition
{
    // Parts that are "nodes": paths refer to them by position, "_0" being the first node, "_1" the second, and so on.
    private static readonly HashSet<string> NodeTypes = new(StringComparer.Ordinal) { "city", "town", "junction", "offboard", "pass", "halt" };

    // Every other part type found in the imported data.
    private static readonly HashSet<string> OtherTypes = new(StringComparer.Ordinal)
    {
        "path", "label", "frame", "upgrade", "icon", "future_label", "border", "stripes",
    };

    public const int MaxLength = 2000;

    // Problems with a definition, as plain-language messages; an empty list means it is valid. An empty definition (a blank tile) is allowed.
    public static List<string> Validate(string code)
    {
        var errors = new List<string>();
        if (code.Length > MaxLength)
        {
            errors.Add($"The definition must be {MaxLength} characters or fewer.");
            return errors;
        }

        var parts = Split(code);
        var nodeCount = parts.Count(p => NodeTypes.Contains(p.Type));

        foreach (var part in parts)
        {
            if (!NodeTypes.Contains(part.Type) && !OtherTypes.Contains(part.Type))
            {
                errors.Add($"Unknown part type '{part.Type}'.");
                continue;
            }
            if (part.Type != "path")
            {
                continue;
            }
            // A path joins two ends, a and b. Each end is an edge (0 to 5) or a node ("_0" up to "_" + (nodeCount - 1)).
            foreach (var end in new[] { "a", "b" })
            {
                if (!part.Values.TryGetValue(end, out var value) || value == "")
                {
                    errors.Add($"A path is missing its '{end}' end.");
                }
                else if (value.StartsWith('_'))
                {
                    if (!int.TryParse(value.AsSpan(1), NumberStyles.None, CultureInfo.InvariantCulture, out var node) || node >= nodeCount)
                    {
                        errors.Add($"Path end '{value}' refers to a node that does not exist (this definition has {nodeCount}).");
                    }
                }
                else if (!int.TryParse(value, NumberStyles.None, CultureInfo.InvariantCulture, out var edge) || edge > 5)
                {
                    errors.Add($"Path end '{value}' must be an edge from 0 to 5, or a node such as _0.");
                }
            }
        }
        return errors.Distinct().ToList();
    }

    // Does the definition have a part of this type? Used for Tiles.HasCity and Tiles.HasTown, which are derived on save.
    public static bool Has(string code, string partType) => Split(code).Any(p => p.Type == partType);

    // How many of the hex's six sides track leaves from (0 to 6): the distinct edges named by any path end ("a:3", not node ends like "_0").
    // Used by the Exits filter on the Tiles page. Billings-c (one path to edge 5) has 1; tile 9 (edge 0 to edge 3) has 2.
    public static int ExitCount(string code) =>
        Split(code)
            .Where(p => p.Type == "path")
            .SelectMany(p => new[] { p.Values.GetValueOrDefault("a"), p.Values.GetValueOrDefault("b") })
            .Where(end => end is { Length: > 0 } && !end.StartsWith('_') && int.TryParse(end, NumberStyles.None, CultureInfo.InvariantCulture, out var edge) && edge <= 5)
            .Distinct()
            .Count();

    public const int MaxExits = 6;

    // Parts that can pay revenue: cities, towns, and the off-board, halt, and pass nodes.
    private static readonly HashSet<string> RevenueTypes = new(StringComparer.Ordinal) { "city", "town", "offboard", "halt", "pass" };

    // Every revenue amount the tile can pay, for the Revenue filter on the Tiles page. "revenue:20" -> 20. Phase revenues such as
    // "yellow_30|green_40|brown_50" give each phase's amount (30, 40, 50); the text before the last "_" is a color, sometimes written as "#cb7743",
    // so only the number after it counts. A tile with no city, town, or off-board area has none.
    public static IReadOnlySet<int> Revenues(string code) =>
        Split(code)
            .Where(p => RevenueTypes.Contains(p.Type) && p.Values.ContainsKey("revenue"))
            .SelectMany(p => p.Values["revenue"].Split('|'))
            .Select(phase => phase[(phase.LastIndexOf('_') + 1)..])
            .Select(text => int.TryParse(text, NumberStyles.None, CultureInfo.InvariantCulture, out var amount) ? amount : -1)
            .Where(amount => amount >= 0)
            .ToHashSet();

    private sealed record Part(string Type, Dictionary<string, string> Values);

    // "city=revenue:20,slots:2" -> Part("city", { revenue: "20", slots: "2" }). Same rules as the frontend's parse.ts.
    private static List<Part> Split(string code) =>
        code.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(text =>
            {
                var eq = text.IndexOf('=');
                var type = eq < 0 ? text : text[..eq];
                var values = new Dictionary<string, string>(StringComparer.Ordinal);
                if (eq >= 0)
                {
                    foreach (var setting in text[(eq + 1)..].Split(','))
                    {
                        var colon = setting.IndexOf(':');
                        values[colon < 0 ? setting : setting[..colon]] = colon < 0 ? "" : setting[(colon + 1)..];
                    }
                }
                return new Part(type, values);
            })
            .ToList();
}
