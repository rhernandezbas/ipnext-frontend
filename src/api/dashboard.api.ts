import axiosClient from './axios-client';
import type { DashboardStats, DashboardShortcut, RecentActivity } from '@/types/dashboard';

const BASE = '/dashboard';

export const getDashboardStats = () =>
  axiosClient.get<DashboardStats>(`${BASE}/stats`).then(r => r.data);

export const getDashboardShortcuts = () =>
  axiosClient.get<DashboardShortcut[]>(`${BASE}/shortcuts`).then(r => r.data);

export const getRecentActivity = () =>
  axiosClient.get<RecentActivity[]>(`${BASE}/activity`).then(r => r.data);
