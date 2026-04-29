import axiosClient from './axios-client';
import type { Admin, AdminActivityLog, Admin2FA } from '../types/admin';

const BASE = '/admins';

export const getAdmins = () => axiosClient.get<Admin[]>(BASE).then(r => r.data);
export const getAdmin = (id: string) => axiosClient.get<Admin>(`${BASE}/${id}`).then(r => r.data);
export const createAdmin = (data: Omit<Admin, 'id' | 'createdAt' | 'lastLogin'>) =>
  axiosClient.post<Admin>(BASE, data).then(r => r.data);
export const updateAdmin = (id: string, data: Partial<Admin>) =>
  axiosClient.patch<Admin>(`${BASE}/${id}`, data).then(r => r.data);
export const deleteAdmin = (id: string) => axiosClient.delete(`${BASE}/${id}`);
export const getActivityLog = () =>
  axiosClient.get<AdminActivityLog[]>(`${BASE}/activity-log`).then(r => r.data);
export const get2FAStatus = (adminId: string) =>
  axiosClient.get<Admin2FA>(`${BASE}/${adminId}/2fa`).then(r => r.data);
export const enable2FA = (adminId: string, method: 'totp' | 'sms') =>
  axiosClient.post<{ qrCode: string; backupCodes: string[] }>(`${BASE}/${adminId}/2fa/enable`, { method }).then(r => r.data);
export const disable2FA = (adminId: string) =>
  axiosClient.delete(`${BASE}/${adminId}/2fa`);
