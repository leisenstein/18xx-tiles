namespace Tiles18xx.Api.Domain;

// Shared tile sort order (DESIGN.md section 8):
// color group, then the leading number ("57" in "57A"), then the rest ("A"), then Id.
// Numbers without a leading digit (e.g. "X20") sort after numbered ones.
public static class TileSort
{
    public static IEnumerable<T> Apply<T>(IEnumerable<T> tiles) where T : ISortableTile =>
        tiles
            .OrderBy(t => TileColors.SortGroup(t.Color))
            .ThenBy(t => t.Color, StringComparer.Ordinal)
            .ThenBy(t => LeadingNumber(t.Number) is null ? 1 : 0)
            .ThenBy(t => LeadingNumber(t.Number) ?? 0)
            .ThenBy(t => Suffix(t.Number), StringComparer.Ordinal)
            .ThenBy(t => t.Id);

    // "57A" -> 57; "X20" -> null
    private static long? LeadingNumber(string number)
    {
        var digits = CountLeadingDigits(number);
        return digits > 0 && long.TryParse(number.AsSpan(0, digits), out var value) ? value : null;
    }

    // "57A" -> "A"; "X20" -> "X20"
    private static string Suffix(string number) => number[CountLeadingDigits(number)..];

    private static int CountLeadingDigits(string number)
    {
        var count = 0;
        while (count < number.Length && char.IsAsciiDigit(number[count])) count++;
        return count;
    }
}