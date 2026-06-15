import axiosClient from './axios-client';
import type { TechnicianTeamMappingItem, SetTechnicianTeamMappingResponse } from '@/types/technicianTeamMapping';

const BASE = '/admin/iclass/technician-teams';

export const iclassTechnicianTeamsApi = {
  list: (): Promise<TechnicianTeamMappingItem[]> =>
    axiosClient
      .get<{ items: TechnicianTeamMappingItem[] }>(BASE)
      .then(r => r.data.items),

  setMapping: (
    userId: string,
    iclassTeamLogin: string | null,
  ): Promise<SetTechnicianTeamMappingResponse> =>
    axiosClient
      .patch<SetTechnicianTeamMappingResponse>(`${BASE}/${userId}`, { iclassTeamLogin })
      .then(r => r.data),
};
