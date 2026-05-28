import axiosClient from './axios-client';
import type { FeatureFlag } from '@/types/featureFlag';

const BASE = '/admin/feature-flags';

export const featureFlagsApi = {
  get: (key: string) =>
    axiosClient.get<FeatureFlag>(`${BASE}/${key}`).then(r => r.data),
  set: (key: string, enabled: boolean) =>
    axiosClient.patch<FeatureFlag>(`${BASE}/${key}`, { enabled }).then(r => r.data),
};
