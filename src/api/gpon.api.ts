import axiosClient from './axios-client';
import type { OltDevice, OnuDevice } from '../types/gpon';

export const getOlts = () =>
  axiosClient.get<OltDevice[]>('/gpon/olts').then(r => r.data);

export const getOnus = (oltId?: string) => {
  const url = oltId ? `/gpon/onus?oltId=${oltId}` : '/gpon/onus';
  return axiosClient.get<OnuDevice[]>(url).then(r => r.data);
};
