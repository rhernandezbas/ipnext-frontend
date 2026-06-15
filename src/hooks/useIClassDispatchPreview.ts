import { useQuery } from '@tanstack/react-query';
import { iclassDispatchPreviewApi } from '@/api/iclassDispatchPreview.api';

const KEY = ['iclass-dispatch-preview'] as const;

/**
 * Preview read-only de qué datos envía Prominense a IClass por proyecto.
 * Gate: iclass.read
 */
export function useIClassDispatchPreview() {
  return useQuery({
    queryKey: KEY,
    queryFn: iclassDispatchPreviewApi.list,
    staleTime: 5 * 60_000,
  });
}
