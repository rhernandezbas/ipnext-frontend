import axiosClient from './axios-client';
import type { MeResponse } from '@/types/myPermissions';

export const myPermissionsApi = {
  me: (): Promise<MeResponse> =>
    axiosClient.get<MeResponse>('/auth/me').then(r => r.data),
};
