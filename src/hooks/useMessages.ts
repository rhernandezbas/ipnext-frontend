import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateMessagePayload } from '@/types/message';
import * as api from '@/api/messages.api';

export function useMessages(filter?: 'inbox' | 'sent' | 'draft') {
  return useQuery({
    queryKey: ['messages', filter],
    queryFn: () => api.getMessages(filter),
    staleTime: 30_000,
  });
}

export function useCreateMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateMessagePayload) => api.createMessage(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['messages'] }),
  });
}

export function useMarkMessageAsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.markMessageAsRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['messages'] }),
  });
}

export function useDeleteMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteMessage(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['messages'] }),
  });
}
