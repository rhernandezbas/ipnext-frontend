import axiosClient from './axios-client';

export interface ZonePoint {
  lat: number;
  lng: number;
}

export interface Zone {
  id: string;
  name: string;
  color: string;
  points: ZonePoint[];
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateZoneInput {
  name: string;
  color: string;
  points: ZonePoint[];
  description?: string | null;
}

export interface UpdateZoneInput {
  name?: string;
  color?: string;
  points?: ZonePoint[];
  description?: string | null;
}

export const zonesApi = {
  list: (): Promise<Zone[]> =>
    axiosClient.get<Zone[]>('/zones').then(r => r.data),

  get: (id: string): Promise<Zone> =>
    axiosClient.get<Zone>(`/zones/${id}`).then(r => r.data),

  create: (input: CreateZoneInput): Promise<Zone> =>
    axiosClient.post<Zone>('/zones', input).then(r => r.data),

  update: (id: string, patch: UpdateZoneInput): Promise<Zone> =>
    axiosClient.put<Zone>(`/zones/${id}`, patch).then(r => r.data),

  remove: (id: string): Promise<void> =>
    axiosClient.delete(`/zones/${id}`).then(() => undefined),
};
