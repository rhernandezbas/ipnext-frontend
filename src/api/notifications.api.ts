import axiosClient from './axios-client';
import type { Notification } from '@/types/notification';

const BASE = '/notifications';

export const getNotifications = (unreadOnly?: boolean) =>
  axiosClient.get<Notification[]>(BASE, { params: unreadOnly ? { unread: 'true' } : {} }).then(r => r.data);

export const markNotificationRead = (id: string) =>
  axiosClient.put<Notification>(`${BASE}/${id}/read`).then(r => r.data);

export const markAllNotificationsRead = () =>
  axiosClient.put(`${BASE}/read-all`).then(r => r.data);

export const deleteNotification = (id: string) =>
  axiosClient.delete(`${BASE}/${id}`);
