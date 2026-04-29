import axiosClient from './axios-client';
import type { MonitoringDevice, MonitoringAlert, MonitoringStats } from '@/types/monitoring';

const BASE = '/monitoring';

export const getMonitoringStats = () =>
  axiosClient.get<MonitoringStats>(`${BASE}/stats`).then(r => r.data);

export const getMonitoringDevices = () =>
  axiosClient.get<MonitoringDevice[]>(`${BASE}/devices`).then(r => r.data);

export const getMonitoringAlerts = () =>
  axiosClient.get<MonitoringAlert[]>(`${BASE}/alerts`).then(r => r.data);

export const acknowledgeAlert = (id: string) =>
  axiosClient.put<MonitoringAlert>(`${BASE}/alerts/${id}/acknowledge`).then(r => r.data);
