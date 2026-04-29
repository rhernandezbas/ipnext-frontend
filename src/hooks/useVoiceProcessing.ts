import { useQuery } from '@tanstack/react-query';
import { getVoiceCalls } from '@/api/voiceProcessing.api';

export function useVoiceProcessing() {
  return useQuery({
    queryKey: ['voice-processing'],
    queryFn: getVoiceCalls,
    staleTime: 60_000,
  });
}
