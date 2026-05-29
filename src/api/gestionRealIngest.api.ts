import axiosClient from './axios-client';
import type {
  IngestConfigDTO,
  IngestStatusDTO,
  NeedsReviewTaskDTO,
  UpdateIngestConfigPayload,
} from '@/types/gestionRealIngest';

const BASE = '/gestion-real-ingest';

export const gestionRealIngestApi = {
  async getConfig(): Promise<IngestConfigDTO> {
    const r = await axiosClient.get<IngestConfigDTO>(`${BASE}/config`);
    return r.data;
  },

  async updateConfig(body: UpdateIngestConfigPayload): Promise<IngestConfigDTO> {
    const r = await axiosClient.put<IngestConfigDTO>(`${BASE}/config`, body);
    return r.data;
  },

  async getStatus(): Promise<IngestStatusDTO> {
    const r = await axiosClient.get<IngestStatusDTO>(`${BASE}/status`);
    return r.data;
  },

  async getNeedsReview(): Promise<NeedsReviewTaskDTO[]> {
    const r = await axiosClient.get<NeedsReviewTaskDTO[]>(`${BASE}/needs-review`);
    return r.data;
  },
};
