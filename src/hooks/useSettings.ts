import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SystemSettings, EmailSettings, MessageTemplate, FinanceSettings, PaymentMethod, Webhook, ClientPortalSettings } from '@/types/settings';
import * as api from '@/api/settings.api';

export function useSystemSettings() {
  return useQuery({ queryKey: ['settings-system'], queryFn: api.getSystemSettings });
}

export function useUpdateSystemSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<SystemSettings>) => api.updateSystemSettings(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings-system'] }),
  });
}

export function useEmailSettings() {
  return useQuery({ queryKey: ['settings-email'], queryFn: api.getEmailSettings });
}

export function useUpdateEmailSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<EmailSettings>) => api.updateEmailSettings(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings-email'] }),
  });
}

export function useSendTestEmail() {
  return useMutation({ mutationFn: api.sendTestEmail });
}

export function useTemplates() {
  return useQuery({ queryKey: ['settings-templates'], queryFn: api.getTemplates });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<MessageTemplate> }) =>
      api.updateTemplate(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings-templates'] }),
  });
}

export function useApiTokens() {
  return useQuery({ queryKey: ['settings-api-tokens'], queryFn: api.getApiTokens });
}

export function useCreateApiToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; permissions: string[] }) =>
      api.createApiToken(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings-api-tokens'] }),
  });
}

export function useRevokeApiToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.revokeApiToken(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings-api-tokens'] }),
  });
}

export function useFinanceSettings() {
  return useQuery({ queryKey: ['settings-finance'], queryFn: api.getFinanceSettings });
}

export function useUpdateFinanceSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<FinanceSettings>) => api.updateFinanceSettings(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings-finance'] }),
  });
}

export function usePaymentMethods() {
  return useQuery({ queryKey: ['settings-payment-methods'], queryFn: api.getPaymentMethods });
}

export function useCreatePaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<PaymentMethod, 'id'>) => api.createPaymentMethod(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings-payment-methods'] }),
  });
}

export function useWebhooks() {
  return useQuery({ queryKey: ['settings-webhooks'], queryFn: api.getWebhooks });
}

export function useCreateWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Webhook, 'id' | 'createdAt' | 'lastTriggered' | 'lastStatus'>) =>
      api.createWebhook(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings-webhooks'] }),
  });
}

export function useDeleteWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteWebhook(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings-webhooks'] }),
  });
}

export function useTestWebhook() {
  return useMutation({
    mutationFn: (id: string) => api.testWebhook(id),
  });
}

export function useBackups() {
  return useQuery({ queryKey: ['settings-backups'], queryFn: api.getBackups });
}

export function useCreateBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.createBackup(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings-backups'] }),
  });
}

export function useDeleteBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteBackup(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings-backups'] }),
  });
}

export function useClientPortalSettings() {
  return useQuery({ queryKey: ['settings-client-portal'], queryFn: api.getClientPortalSettings });
}

export function useUpdateClientPortalSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ClientPortalSettings>) => api.updateClientPortalSettings(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings-client-portal'] }),
  });
}
