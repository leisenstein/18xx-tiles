// One page of results, as returned by paged API calls (matches PagedResultDto in the API).
// <T> makes it reusable: PagedResult<TileSummary> is a page of tiles.
export interface PagedResult<T> {
  items: T[]
  page: number
  pageSize: number
  totalCount: number // matches across all pages
  totalPages: number
}
