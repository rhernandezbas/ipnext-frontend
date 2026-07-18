import axiosClient from './axios-client';
import type {
  AddNewsLinkInput,
  CreateNewsCategoryInput,
  CreateNewsPostInput,
  ListNewsPostsResult,
  NewsAttachment,
  NewsBroadcastResult,
  NewsCategory,
  NewsListFilters,
  NewsPost,
  UpdateNewsCategoryInput,
  UpdateNewsPostInput,
} from '@/types/news';

const BASE = '/news';

/**
 * newsApi — raw axios calls against `/api/news`, RAW responses (no `{data}`
 * envelope), same style as `notifications.api.ts` / `ticketAreas.api.ts`.
 *
 * Query params verified against the real router (news.routes.ts): `category`
 * (not `categoryId`), `unread`, `archived` — NO `page`/`limit` (unsupported).
 */
export const newsApi = {
  list: (filters: NewsListFilters = {}) =>
    axiosClient
      .get<ListNewsPostsResult>(BASE, {
        params: {
          ...(filters.categoryId ? { category: filters.categoryId } : {}),
          ...(filters.unreadOnly ? { unread: 'true' } : {}),
          ...(filters.archived ? { archived: 'true' } : {}),
        },
      })
      .then((r) => r.data),

  getUnreadCount: () =>
    axiosClient.get<{ count: number }>(`${BASE}/unread-count`).then((r) => r.data.count),

  getById: (id: string) => axiosClient.get<NewsPost>(`${BASE}/${id}`).then((r) => r.data),

  create: (data: CreateNewsPostInput) =>
    axiosClient.post<NewsPost>(BASE, data).then((r) => r.data),

  update: (id: string, data: UpdateNewsPostInput) =>
    axiosClient.put<NewsPost>(`${BASE}/${id}`, data).then((r) => r.data),

  setArchived: (id: string, archived: boolean) =>
    axiosClient.put<NewsPost>(`${BASE}/${id}/archive`, { archived }).then((r) => r.data),

  markRead: (id: string) => axiosClient.post<void>(`${BASE}/${id}/read`).then((r) => r.data),

  listCategories: () =>
    axiosClient.get<NewsCategory[]>(`${BASE}/categories`).then((r) => r.data),

  createCategory: (data: CreateNewsCategoryInput) =>
    axiosClient.post<NewsCategory>(`${BASE}/categories`, data).then((r) => r.data),

  updateCategory: (id: string, data: UpdateNewsCategoryInput) =>
    axiosClient.put<NewsCategory>(`${BASE}/categories/${id}`, data).then((r) => r.data),

  deleteCategory: (id: string) => axiosClient.delete(`${BASE}/categories/${id}`),

  // ── N2: media + broadcast ──────────────────────────────────────────────────

  /**
   * POST /news/:id/attachments (news:manage) — multipart, field name `files`
   * (the BE's multer field). axios rewrites the multipart Content-Type to add
   * the `boundary` for a browser FormData body, so the explicit header is just
   * intent. Returns the created attachment DTOs (201). Up to 20 files, 10 MiB
   * each — validated client-side (validateNewsAttachment) AND server-side.
   */
  uploadAttachments: (id: string, files: File[]) => {
    const form = new FormData();
    for (const file of files) form.append('files', file);
    return axiosClient
      .post<NewsAttachment[]>(`${BASE}/${id}/attachments`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },

  /**
   * POST /news/:id/attachments (news:manage) — JSON `{kind:'link', url, filename?}`.
   * Returns the single created attachment DTO (201). BE surfaces a non-string
   * url as 400 VALIDATION_ERROR and a non-http(s) url as 422 INVALID_LINK_ATTACHMENT.
   */
  addLinkAttachment: (id: string, data: AddNewsLinkInput) =>
    axiosClient
      .post<NewsAttachment>(`${BASE}/${id}/attachments`, {
        kind: 'link',
        url: data.url,
        ...(data.filename ? { filename: data.filename } : {}),
      })
      .then((r) => r.data),

  /** DELETE /news/attachments/:id (news:manage) → 204. */
  deleteAttachment: (attachmentId: string) =>
    axiosClient.delete(`${BASE}/attachments/${attachmentId}`),

  /** POST /news/:id/broadcast (news:manage) → { sent, link }. */
  broadcast: (id: string) =>
    axiosClient.post<NewsBroadcastResult>(`${BASE}/${id}/broadcast`).then((r) => r.data),
};
