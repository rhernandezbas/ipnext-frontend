import { useQuery } from '@tanstack/react-query';
import { getMessengers } from '@/api/messenger.api';

export function useMessengers() {
  return useQuery({
    queryKey: ['messengers'],
    queryFn: getMessengers,
    staleTime: 60_000,
  });
}
