import axiosClient from './axios-client';
import type {
  SystemSettings,
  EmailSettings,
  MessageTemplate,
  ApiToken,
  FinanceSettings,
  PaymentMethod,
  Webhook,
  BackupRecord,
  ClientPortalSettings,
} from '../types/settings';

const BASE = '/settings';

export const getSystemSettings = () =>
  axiosClient.get<SystemSettings>(`${BASE}/system`).then(r => r.data);

export const updateSystemSettings = (data: Partial<SystemSettings>) =>
  axiosClient.put<SystemSettings>(`${BASE}/system`, data).then(r => r.data);

export const getEmailSettings = () =>
  axiosClient.get<EmailSettings>(`${BASE}/email`).then(r => r.data);

export const updateEmailSettings = (data: Partial<EmailSettings>) =>
  axiosClient.put<EmailSettings>(`${BASE}/email`, data).then(r => r.data);

export const sendTestEmail = () =>
  axiosClient.post<{ success: boolean; message: string }>(`${BASE}/email/test`).then(r => r.data);

export const getTemplates = () =>
  axiosClient.get<MessageTemplate[]>(`${BASE}/templates`).then(r => r.data);

export const updateTemplate = (id: string, data: Partial<MessageTemplate>) =>
  axiosClient.put<MessageTemplate>(`${BASE}/templates/${id}`, data).then(r => r.data);

export const getApiTokens = () =>
  axiosClient.get<ApiToken[]>(`${BASE}/api-tokens`).then(r => r.data);

export const createApiToken = (payload: { name: string; permissions: string[] }) =>
  axiosClient.post<ApiToken>(`${BASE}/api-tokens`, payload).then(r => r.data);

export const revokeApiToken = (id: string) =>
  axiosClient.delete(`${BASE}/api-tokens/${id}`);

export const getFinanceSettings = () =>
  axiosClient.get<FinanceSettings>(`${BASE}/finance`).then(r => r.data);

export const updateFinanceSettings = (data: Partial<FinanceSettings>) =>
  axiosClient.put<FinanceSettings>(`${BASE}/finance`, data).then(r => r.data);

export const getPaymentMethods = () =>
  axiosClient.get<PaymentMethod[]>(`${BASE}/payment-methods`).then(r => r.data);

export const createPaymentMethod = (data: Omit<PaymentMethod, 'id'>) =>
  axiosClient.post<PaymentMethod>(`${BASE}/payment-methods`, data).then(r => r.data);

// Webhooks
export const getWebhooks = () =>
  axiosClient.get<Webhook[]>(`${BASE}/webhooks`).then(r => r.data);

export const createWebhook = (data: Omit<Webhook, 'id' | 'createdAt' | 'lastTriggered' | 'lastStatus'>) =>
  axiosClient.post<Webhook>(`${BASE}/webhooks`, data).then(r => r.data);

export const deleteWebhook = (id: string) =>
  axiosClient.delete(`${BASE}/webhooks/${id}`);

export const testWebhook = (id: string) =>
  axiosClient.post<{ success: boolean }>(`${BASE}/webhooks/${id}/test`).then(r => r.data);

// Backups
export const getBackups = () =>
  axiosClient.get<BackupRecord[]>(`${BASE}/backups`).then(r => r.data);

export const createBackup = () =>
  axiosClient.post<BackupRecord>(`${BASE}/backups`).then(r => r.data);

export const deleteBackup = (id: string) =>
  axiosClient.delete(`${BASE}/backups/${id}`);

// Client Portal
export const getClientPortalSettings = () =>
  axiosClient.get<ClientPortalSettings>(`${BASE}/client-portal`).then(r => r.data);

export const updateClientPortalSettings = (data: Partial<ClientPortalSettings>) =>
  axiosClient.put<ClientPortalSettings>(`${BASE}/client-portal`, data).then(r => r.data);
