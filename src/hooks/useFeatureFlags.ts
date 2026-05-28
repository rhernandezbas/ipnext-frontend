import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { featureFlagsApi } from '@/api/featureFlags.api';
import type { FeatureFlag } from '@/types/featureFlag';

const KEY = ['featureFlags'] as const;

/**
 * Reads a feature flag by key. If the key doesn't exist (404), returns
 * `{ key, enabled: false }` instead of erroring — feature flags are
 * opt-in, so absence == disabled. Other errors propagate as `isError`.
 */
export function useFeatureFlag(key: string) {
  return useQuery<FeatureFlag>({
    queryKey: [...KEY, key],
    queryFn: async () => {
      try {
        return await featureFlagsApi.get(key);
      } catch (err: unknown) {
        const e = err as { response?: { status?: number } };
        if (e.response?.status === 404) {
          return { key, enabled: false };
        }
        throw err;
      }
    },
    staleTime: 60_000,
  });
}

export function useSetFeatureFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) =>
      featureFlagsApi.set(key, enabled),
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: [...KEY, vars.key] }),
  });
}
