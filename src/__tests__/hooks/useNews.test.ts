/**
 * Tests for useNews.ts hooks (internal-news FE apply — data layer batch).
 * Mocks at the API layer (newsApi). Mirrors useTicketAreas.test.ts / useWhatsapp.test.ts.
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { NewsCategory, NewsPost } from '@/types/news';

// This is the module under test — opt OUT of the global safe-default mock that
// src/test/setup.ts applies for Sidebar's sake (see comment there), so
// useNewsUnreadCount below exercises its REAL implementation (polling etc.).
vi.unmock('@/hooks/useNews');

vi.mock('@/api/news.api', () => ({
  newsApi: {
    list: vi.fn(),
    getUnreadCount: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    setArchived: vi.fn(),
    markRead: vi.fn(),
    listCategories: vi.fn(),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn(),
  },
}));

vi.mock('@/hooks/useDocumentVisible', () => ({
  useDocumentVisible: vi.fn(),
}));

import { newsApi } from '@/api/news.api';
import { useDocumentVisible } from '@/hooks/useDocumentVisible';
import {
  useNewsList,
  useNewsUnreadCount,
  useNewsCategories,
  useMarkNewsRead,
  useCreateNewsPost,
  useUpdateNewsPost,
  useArchiveNewsPost,
  useCreateNewsCategory,
  useUpdateNewsCategory,
  useDeleteNewsCategory,
  newsListKey,
} from '@/hooks/useNews';

const mockApi = newsApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

function makeCategory(over: Partial<NewsCategory> = {}): NewsCategory {
  return { id: 'cat-1', name: 'General', color: '#64748b', ...over };
}

function makePost(over: Partial<NewsPost> = {}): NewsPost {
  return {
    id: 'post-1',
    title: 'Corte programado',
    body: 'Detalle del corte.',
    category: makeCategory(),
    authorId: 'user-1',
    authorName: 'Ana',
    pinned: false,
    publishedAt: '2026-07-01T12:00:00.000Z',
    archivedAt: null,
    read: false,
    attachments: [],
    lastBroadcastAt: null,
    createdAt: '2026-07-01T12:00:00.000Z',
    updatedAt: '2026-07-01T12:00:00.000Z',
    ...over,
  };
}

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
  return { qc, wrapper };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useDocumentVisible).mockReturnValue(true);
});

describe('useNewsList', () => {
  it('returns {items, unreadCount} from the API under the filters-scoped key', async () => {
    const result_ = { items: [makePost()], unreadCount: 1 };
    mockApi.list.mockResolvedValue(result_);
    const { qc, wrapper } = makeWrapper();

    const { result } = renderHook(() => useNewsList({ categoryId: 'cat-1' }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(result_);
    expect(mockApi.list).toHaveBeenCalledWith({ categoryId: 'cat-1' });
    expect(qc.getQueryData(newsListKey({ categoryId: 'cat-1' }))).toEqual(result_);
  });
});

describe('useNewsUnreadCount', () => {
  it('fetches the count and staleTime/refetchInterval respect visibility', async () => {
    mockApi.getUnreadCount.mockResolvedValue(3);
    vi.mocked(useDocumentVisible).mockReturnValue(true);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useNewsUnreadCount(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(3);
  });

  it('polls every 60s while the tab is visible', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockApi.getUnreadCount.mockResolvedValue(1);
    vi.mocked(useDocumentVisible).mockReturnValue(true);
    const { wrapper } = makeWrapper();

    renderHook(() => useNewsUnreadCount(), { wrapper });
    await vi.waitFor(() => expect(mockApi.getUnreadCount).toHaveBeenCalledTimes(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(mockApi.getUnreadCount).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('does NOT poll while the tab is hidden (refetchInterval:false)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockApi.getUnreadCount.mockResolvedValue(1);
    vi.mocked(useDocumentVisible).mockReturnValue(false);
    const { wrapper } = makeWrapper();

    renderHook(() => useNewsUnreadCount(), { wrapper });
    await vi.waitFor(() => expect(mockApi.getUnreadCount).toHaveBeenCalledTimes(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(mockApi.getUnreadCount).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});

describe('useNewsCategories', () => {
  it('returns the category catalog', async () => {
    mockApi.listCategories.mockResolvedValue([makeCategory()]);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useNewsCategories(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([makeCategory()]);
  });
});

describe('useMarkNewsRead', () => {
  it('calls api.markRead and invalidates news + unread-count', async () => {
    mockApi.list.mockResolvedValue({ items: [], unreadCount: 0 });
    mockApi.getUnreadCount.mockResolvedValue(0);
    mockApi.markRead.mockResolvedValue(undefined);
    const { qc, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useMarkNewsRead(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync('post-1');
    });

    expect(mockApi.markRead).toHaveBeenCalledWith('post-1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['news'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['news', 'unread-count'] });
  });
});

describe('useCreateNewsPost / useUpdateNewsPost / useArchiveNewsPost', () => {
  it('create: calls api.create with the payload and invalidates news', async () => {
    const created = makePost({ id: 'post-new' });
    mockApi.create.mockResolvedValue(created);
    const { qc, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useCreateNewsPost(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ title: 'T', body: 'B', categoryId: 'cat-1' });
    });

    expect(mockApi.create).toHaveBeenCalledWith({ title: 'T', body: 'B', categoryId: 'cat-1' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['news'] });
  });

  it('update: calls api.update with id + data', async () => {
    mockApi.update.mockResolvedValue(makePost());
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useUpdateNewsPost(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: 'post-1', data: { title: 'Nuevo' } });
    });

    expect(mockApi.update).toHaveBeenCalledWith('post-1', { title: 'Nuevo' });
  });

  it('archive: calls api.setArchived with id + archived flag', async () => {
    mockApi.setArchived.mockResolvedValue(makePost({ archivedAt: '2026-07-02T00:00:00.000Z' }));
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useArchiveNewsPost(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: 'post-1', archived: true });
    });

    expect(mockApi.setArchived).toHaveBeenCalledWith('post-1', true);
  });
});

describe('category mutations', () => {
  it('useCreateNewsCategory calls api.createCategory and invalidates categories', async () => {
    mockApi.createCategory.mockResolvedValue(makeCategory({ id: 'cat-new' }));
    const { qc, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useCreateNewsCategory(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ name: 'Comercial', color: '#10b981' });
    });

    expect(mockApi.createCategory).toHaveBeenCalledWith({ name: 'Comercial', color: '#10b981' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['news', 'categories'] });
  });

  it('useUpdateNewsCategory invalidates BOTH categories and news (denormalized into posts)', async () => {
    mockApi.updateCategory.mockResolvedValue(makeCategory({ name: 'Comercial 2' }));
    const { qc, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateNewsCategory(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: 'cat-1', data: { name: 'Comercial 2' } });
    });

    expect(mockApi.updateCategory).toHaveBeenCalledWith('cat-1', { name: 'Comercial 2' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['news', 'categories'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['news'] });
  });

  it('useDeleteNewsCategory calls api.deleteCategory with the id', async () => {
    mockApi.deleteCategory.mockResolvedValue(undefined);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useDeleteNewsCategory(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync('cat-1');
    });

    expect(mockApi.deleteCategory).toHaveBeenCalledWith('cat-1');
  });
});
