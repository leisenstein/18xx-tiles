namespace Tiles18xx.Api.Domain;

// Rules for GameTiles.Count, the number of a tile in a game's box (DESIGN.md section 7).
// NULL = unknown; 999 = unlimited; anything else must be 1 to MaxCount, so a typo such as 99 or 9999 cannot be mistaken for "unlimited".
public static class TileCounts
{
    public const int Unlimited = 999;
    public const int MaxCount = 100;

    public static bool IsValid(int? count) => count is null or Unlimited or (>= 1 and <= MaxCount);
}
