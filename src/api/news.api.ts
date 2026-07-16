import axiosClient from './axios-client';
import type {
  CreateNewsCategoryInput,
  CreateNewsPostInput,
  ListNewsPostsResult,
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
};
