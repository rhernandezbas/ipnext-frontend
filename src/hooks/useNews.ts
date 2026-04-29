import { useQuery } from '@tanstack/react-query';
import { getNews } from '@/api/news.api';

export function useNews() {
  return useQuery({
    queryKey: ['news'],
    queryFn: getNews,
    staleTime: 60_000,
  });
}
