namespace Tiles18xx.Api.Dtos;

// A Pending change request that proposes a tile number (part of NumberCheckDto). Other users' emails are not included.
public sealed record PendingNumberUseDto
{
    public long Id { get; init; }
    public string Type { get; init; } = "";
    public string? VariantName { get; init; }
    public bool IsMine { get; init; } // submitted by the user who is asking
}
