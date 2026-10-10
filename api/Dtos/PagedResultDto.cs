namespace Tiles18xx.Api.Dtos;

// One page of results plus the information needed to show paging controls.
public sealed record PagedResultDto<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalCount)
{
    public int TotalPages => (TotalCount + PageSize - 1) / PageSize;
}