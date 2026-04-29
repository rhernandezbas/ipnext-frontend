import { useQuery } from '@tanstack/react-query';
import { getVoiceRateTables } from '@/api/voiceRateTable.api';

export function useVoiceRateTables() {
  return useQuery({
    queryKey: ['voice-rate-tables'],
    queryFn: getVoiceRateTables,
    staleTime: 60_000,
  });
}
