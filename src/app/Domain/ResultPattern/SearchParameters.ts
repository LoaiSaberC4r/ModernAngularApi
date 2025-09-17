export type SortOrder = 'Newest' | 'Oldest';

export interface SearchParameters {
  searchText?: string | null;
  sortOrder?: SortOrder;
  page?: number;
  pageSize?: number;
}