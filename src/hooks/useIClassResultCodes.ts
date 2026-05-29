import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { iclassResultCodesApi } from '@/api/iclassResultCodes.api';

const KEY = ['iclassResultCodes'] as const;

export function useIClassResultCodes(mapped?: boolean) {
  return useQuery({
    queryKey: [...KEY, mapped ?? 'all'],
    queryFn: () => iclassResultCodesApi.list(mapped),
    staleTime: 60_000,
  });
}

export function useSyncIClassResultCodes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: iclassResultCodesApi.sync,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useAssignResultCodeStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stageId }: { id: string; stageId: string | null }) =>
      iclassResultCodesApi.assignStage(id, stageId),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
