import { useMutation } from '@tanstack/react-query';
import { iclassClosureApi } from '@/api/iclassClosure.api';

/** Run the on-demand closure backfill (reconcile in-flight tasks against IClass). */
export function useRunClosureBackfill() {
  return useMutation({ mutationFn: iclassClosureApi.backfill });
}
