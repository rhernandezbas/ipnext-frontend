import axiosClient from './axios-client';
import type { SearchResponse } from '@/types/search';

export const search = (query: string) =>
  axiosClient.get<SearchResponse>('/search', { params: { q: query } }).then(r => r.data);
