export type SearchResultType = 'client' | 'ticket' | 'invoice' | 'device' | 'lead' | 'admin';

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  href: string;
  icon: string;
}

export interface SearchResponse {
  query: string;
  total: number;
  results: SearchResult[];
}
