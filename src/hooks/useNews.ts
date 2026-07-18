import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { newsApi } from '@/api/news.api';
import { useDocumentVisible } from '@/hooks/useDocumentVisible';
import type {
  AddNewsLinkInput,
  CreateNewsCategoryInput,
  CreateNewsPostInput,
  NewsListFilters,
  UpdateNewsCategoryInput,
  UpdateNewsPostInput,
} from '@/types/news';

/**
 * useNews (internal-news FE apply, design §7/§9.5) — hooks for the news board.
 *
 * Query keys:
 *   ['news', 'list', filters]     — the board (server-side category/unread/archived filters)
 *   ['news', 'unread-count']      — the sidebar badge, polled
 *   ['news', 'categories']        — filter chips + Select options
 *
 * `useNewsUnreadCount` polls `refetchInterval: visible ? 60_000 : false`
 * (gated by `useDocumentVisible`, molde `useWhatsapp.ts`) and every mutation
 * that can change read-state invalidates it immediately so the badge doesn't
 * wait for the next tick (NEWS-FE-SB-2).
 */

const NEWS_ROOT = ['news'] as const;

export const newsListKey = (filters: NewsListFilters = {}) => [...NEWS_ROOT, 'list', filters] as const;
export const newsUnreadCountKey = [...NEWS_ROOT, 'unread-count'] as const;
export const newsCategoriesKey = [...NEWS_ROOT, 'categories'] as const;

export function useNewsList(filters: NewsListFilters = {}) {
  return useQuery({
    queryKey: newsListKey(filters),
    queryFn: () => newsApi.list(filters),
  });
}

export function useNewsUnreadCount() {
  const visible = useDocumentVisible();

  return useQuery({
    queryKey: newsUnreadCountKey,
    queryFn: () => newsApi.getUnreadCount(),
    staleTime: 30_000,
    refetchInterval: visible ? 60_000 : false,
  });
}

export function useNewsCategories() {
  return useQuery({
    queryKey: newsCategoriesKey,
    queryFn: () => newsApi.listCategories(),
    staleTime: 60_000,
  });
}

export function useMarkNewsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => newsApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: NEWS_ROOT });
      qc.invalidateQueries({ queryKey: newsUnreadCountKey });
    },
  });
}

export function useCreateNewsPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateNewsPostInput) => newsApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: NEWS_ROOT }),
  });
}

export function useUpdateNewsPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateNewsPostInput }) => newsApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: NEWS_ROOT }),
  });
}

export function useArchiveNewsPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) => newsApi.setArchived(id, archived),
    onSuccess: () => qc.invalidateQueries({ queryKey: NEWS_ROOT }),
  });
}

export function useCreateNewsCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateNewsCategoryInput) => newsApi.createCategory(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: newsCategoriesKey }),
  });
}

export function useUpdateNewsCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateNewsCategoryInput }) => newsApi.updateCategory(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: newsCategoriesKey });
      // Categories are denormalized into each NewsPostDto (name/color) — a
      // rename/recolor must refresh the board too, not just the settings list.
      qc.invalidateQueries({ queryKey: NEWS_ROOT });
    },
  });
}

export function useDeleteNewsCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => newsApi.deleteCategory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: newsCategoriesKey }),
  });
}

// ── N2: attachments + broadcast ──────────────────────────────────────────────

/**
 * Attachment/broadcast mutations invalidate the whole ['news'] root so the board
 * list (and any open drawer re-opened afterwards) reflect the new attachments /
 * lastBroadcastAt — the DTOs carry both fields in every list item and in GET /:id.
 */
export function useUploadNewsAttachments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, files }: { id: string; files: File[] }) => newsApi.uploadAttachments(id, files),
    onSuccess: () => qc.invalidateQueries({ queryKey: NEWS_ROOT }),
  });
}

export function useAddNewsLinkAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AddNewsLinkInput }) => newsApi.addLinkAttachment(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: NEWS_ROOT }),
  });
}

export function useDeleteNewsAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) => newsApi.deleteAttachment(attachmentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: NEWS_ROOT }),
  });
}

export function useBroadcastNewsPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => newsApi.broadcast(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: NEWS_ROOT }),
  });
}
