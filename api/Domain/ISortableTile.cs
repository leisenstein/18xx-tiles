namespace Tiles18xx.Api.Domain;

// Anything that can be sorted with TileSort (tile DTOs implement this).
public interface ISortableTile
{
    long Id { get; }
    string Number { get; }
    string Color { get; }
}