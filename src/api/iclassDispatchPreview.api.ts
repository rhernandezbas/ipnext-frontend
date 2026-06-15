import axiosClient from './axios-client';
import type { DispatchPreviewRow } from '@/types/iclassDispatchPreview';

const BASE = '/admin/iclass/dispatch-preview';

export const iclassDispatchPreviewApi = {
  list: (): Promise<DispatchPreviewRow[]> =>
    axiosClient
      .get<{ items: DispatchPreviewRow[] }>(BASE)
      .then(r => r.data.items),
};
