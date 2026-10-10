namespace Tiles18xx.Api.Domain;

// Allowed tile colors and their sort order (DESIGN.md sections 7 and 8).
public static class TileColors
{
    // These four come first, in this order. All other colors sort after them.
    private static readonly string[] MainOrder = ["yellow", "green", "brown", "gray"];

    private static readonly HashSet<string> Known = new(StringComparer.Ordinal)
    {
        "yellow", "green", "brown", "gray", "greenbrown", "browngray", "brownsepia", "none",
        "red", "blue", "purple", "white", "orange",
    };

    public static bool IsKnown(string color) => Known.Contains(color);

    // 0 to 3 for the main colors; 4 for every other color.
    public static int SortGroup(string color)
    {
        var index = Array.IndexOf(MainOrder, color);
        return index >= 0 ? index : MainOrder.Length;
    }
}