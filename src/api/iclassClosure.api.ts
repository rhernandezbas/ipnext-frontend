import axiosClient from './axios-client';

export interface ClosureBackfillResult {
  mirrored: number;
  transitioned: number;
  skippedNotClosed: number;
  skippedNotOurs: number;
  skippedUnchanged: number;
}

export const iclassClosureApi = {
  backfill: () =>
    axiosClient.post<ClosureBackfillResult>('/admin/iclass/closure/backfill').then(r => r.data),
};
