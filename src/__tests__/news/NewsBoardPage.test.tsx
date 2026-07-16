import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { NewsCategory, NewsPost } from '@/types/news';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { UseMyPermissionsResult } from '@/hooks/useMyPermissions';

vi.mock('@/hooks/useNews', () => ({
  useNewsList: vi.fn(),
  useNewsCategories: vi.fn(),
  useMarkNewsRead: vi.fn(),
  // NewsDetailDrawer (rendered by this page) calls useArchiveNewsPost directly (M3 review fix).
  useArchiveNewsPost: vi.fn(),
}));

import {
  useNewsList,
  useNewsCategories,
  useMarkNewsRead,
  useArchiveNewsPost,
} from '@/hooks/useNews';
import NewsBoardPage from '@/pages/news/NewsBoardPage';

const mockUseNewsList = useNewsList as unknown as ReturnType<typeof vi.fn>;
const mockUseNewsCategories = useNewsCategories as unknown as ReturnType<typeof vi.fn>;
const mockUseMarkNewsRead = useMarkNewsRead as unknown as ReturnType<typeof vi.fn>;
const mockUseArchive = useArchiveNewsPost as unknown as ReturnType<typeof vi.fn>;

const CATEGORY_RED: NewsCategory = { id: 'cat-red', name: 'Red/Infraestructura', color: '#6366f1' };
const CATEGORY_COM: NewsCategory = { id: 'cat-com', name: 'Comercial', color: '#10b981' };

function makePost(over: Partial<NewsPost> = {}): NewsPost {
  return {
    id: 'post-1',
    title: 'Noticia de ejemplo',
    body: 'Cuerpo de la noticia.',
    category: CATEGORY_RED,
    authorId: 'user-1',
    authorName: 'Ana Pérez',
    pinned: false,
    publishedAt: '2026-07-01T12:00:00.000Z',
    archivedAt: null,
    read: false,
    createdAt: '2026-07-01T12:00:00.000Z',
    updatedAt: '2026-07-01T12:00:00.000Z',
    ...over,
  };
}

function mockPerms(overrides: Partial<UseMyPermissionsResult>) {
  const base: UseMyPermissionsResult = {
    user: null,
    roles: [],
    permissions: ['news.read', 'news.manage'],
    isLoading: false,
    isError: false,
    can: () => true,
  };
  vi.mocked(useMyPermissions).mockReturnValue({ ...base, ...overrides });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <NewsBoardPage />
    </MemoryRouter>,
  );
}

function mockList(state: Partial<ReturnType<typeof useNewsList>>) {
  mockUseNewsList.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...state,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPerms({});
  mockUseNewsCategories.mockReturnValue({ data: [CATEGORY_RED, CATEGORY_COM], isLoading: false });
  mockUseMarkNewsRead.mockReturnValue({ mutate: vi.fn(), mutateAsync: vi.fn() });
  mockUseArchive.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
  mockList({ data: { items: [], unreadCount: 0 } });
});

describe('NewsBoardPage — four states (NEWS-FE-BD-1)', () => {
  it('loading: renders a skeleton (no cards, no empty/error copy)', () => {
    mockList({ isLoading: true, data: undefined });
    renderPage();
    expect(screen.getByTestId('news-board-skeleton')).toBeInTheDocument();
  });

  it('error: renders an error message with a retry action', async () => {
    const refetch = vi.fn();
    mockList({ isError: true, isLoading: false, data: undefined, refetch });
    const user = userEvent.setup();
    renderPage();
    expect(screen.getByText(/no se pudo/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it('empty: renders empty copy + "Nueva noticia" CTA when news.manage is granted', () => {
    mockList({ data: { items: [], unreadCount: 0 } });
    renderPage();
    expect(screen.getByText(/no hay noticias/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /nueva noticia/i }).length).toBeGreaterThan(0);
  });

  it('empty: does NOT show the CTA without news.manage', () => {
    mockPerms({ permissions: ['news.read'], can: (p) => (Array.isArray(p) ? p[0] === 'news.read' : p === 'news.read') });
    mockList({ data: { items: [], unreadCount: 0 } });
    renderPage();
    expect(screen.getByText(/no hay noticias/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /nueva noticia/i })).not.toBeInTheDocument();
  });

  it('data: renders one card per item', () => {
    mockList({
      data: {
        items: [makePost({ id: 'p1', title: 'Uno' }), makePost({ id: 'p2', title: 'Dos' })],
        unreadCount: 2,
      },
    });
    renderPage();
    expect(screen.getByText('Uno')).toBeInTheDocument();
    expect(screen.getByText('Dos')).toBeInTheDocument();
  });
});

describe('NewsBoardPage — order and destaque (NEWS-FE-BD-2)', () => {
  it('renders pinned post before a newer non-pinned unread post, in the order the BE returns them', () => {
    mockList({
      data: {
        items: [
          makePost({ id: 'pinned-read', title: 'Fijada y leída', pinned: true, read: true }),
          makePost({ id: 'fresh-unread', title: 'Reciente sin leer', pinned: false, read: false }),
        ],
        unreadCount: 1,
      },
    });
    renderPage();
    const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(titles).toEqual(['Fijada y leída', 'Reciente sin leer']);
  });
});

describe('NewsBoardPage — filtros (NEWS-FE-BD-4)', () => {
  it('renders a category chip per catalog entry and filters via categoryId on click', async () => {
    const user = userEvent.setup();
    mockList({ data: { items: [makePost()], unreadCount: 0 } });
    renderPage();

    const chip = screen.getByRole('button', { name: CATEGORY_COM.name });
    await user.click(chip);

    expect(mockUseNewsList).toHaveBeenLastCalledWith(
      expect.objectContaining({ categoryId: CATEGORY_COM.id }),
    );
  });

  it('shows the "Archivadas" toggle only with news.manage', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /archivadas/i })).toBeInTheDocument();
  });

  it('hides the "Archivadas" toggle without news.manage', () => {
    mockPerms({ permissions: ['news.read'], can: (p) => (Array.isArray(p) ? p[0] === 'news.read' : p === 'news.read') });
    renderPage();
    expect(screen.queryByRole('button', { name: /archivadas/i })).not.toBeInTheDocument();
  });

  it('toggling "Solo no leídas" filters via unreadOnly', async () => {
    const user = userEvent.setup();
    mockList({ data: { items: [], unreadCount: 0 } });
    renderPage();
    await user.click(screen.getByRole('button', { name: /solo no leídas/i }));
    expect(mockUseNewsList).toHaveBeenLastCalledWith(expect.objectContaining({ unreadOnly: true }));
  });
});

describe('NewsBoardPage — detalle marca leída (NEWS-FE-BD-3)', () => {
  it('opening an unread card triggers markRead exactly once', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn();
    mockUseMarkNewsRead.mockReturnValue({ mutate, mutateAsync: vi.fn() });
    mockList({ data: { items: [makePost({ id: 'unread-1', read: false, title: 'Sin leer' })], unreadCount: 1 } });
    renderPage();

    await user.click(screen.getByRole('button', { name: /sin leer/i }));

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith('unread-1');
    // The drawer itself renders the full body — confirms it actually opened.
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Cuerpo de la noticia.')).toBeInTheDocument();
  });

  it('opening an already-read card does NOT trigger markRead', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn();
    mockUseMarkNewsRead.mockReturnValue({ mutate, mutateAsync: vi.fn() });
    mockList({ data: { items: [makePost({ id: 'read-1', read: true, title: 'Ya leída' })], unreadCount: 0 } });
    renderPage();

    await user.click(screen.getByRole('button', { name: /ya leída/i }));

    expect(mutate).not.toHaveBeenCalled();
  });

  it('M1 — the drawer stays open with the snapshot content after mark-read shrinks the "unreadOnly" list', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn();
    mockUseMarkNewsRead.mockReturnValue({ mutate, mutateAsync: vi.fn() });
    const post = makePost({ id: 'unread-1', read: false, title: 'Sin leer bajo filtro' });
    mockList({ data: { items: [post], unreadCount: 1 } });

    const { rerender } = renderPage();

    await user.click(screen.getByRole('button', { name: /sin leer bajo filtro/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Simulate the invalidation refetch triggered by mark-read: under
    // unreadOnly, the now-read post disappears from the BE response.
    mockList({ data: { items: [], unreadCount: 0 } });
    rerender(
      <MemoryRouter>
        <NewsBoardPage />
      </MemoryRouter>,
    );

    // The drawer must NOT unmount just because `items` shrank — it holds a
    // local snapshot of the post taken at open time.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Sin leer bajo filtro')).toBeInTheDocument();
    expect(within(dialog).getByText('Cuerpo de la noticia.')).toBeInTheDocument();
  });
});
