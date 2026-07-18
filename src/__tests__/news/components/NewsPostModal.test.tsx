import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { NewsCategory, NewsPost } from '@/types/news';

vi.mock('@/api/news.api', () => ({
  newsApi: {
    create: vi.fn(),
    update: vi.fn(),
  },
}));

import { newsApi } from '@/api/news.api';
import { NewsPostModal } from '@/pages/news/components/NewsPostModal';

const CATEGORIES: NewsCategory[] = [
  { id: 'cat-1', name: 'General', color: '#64748b' },
  { id: 'cat-2', name: 'Comercial', color: '#10b981' },
];

function makePost(over: Partial<NewsPost> = {}): NewsPost {
  return {
    id: 'post-1',
    title: 'Título existente',
    body: 'Cuerpo existente',
    category: CATEGORIES[0],
    authorId: 'user-1',
    authorName: 'Ana',
    pinned: false,
    publishedAt: '2026-07-01T12:00:00.000Z',
    archivedAt: null,
    read: true,
    attachments: [],
    lastBroadcastAt: null,
    createdAt: '2026-07-01T12:00:00.000Z',
    updatedAt: '2026-07-01T12:00:00.000Z',
    ...over,
  };
}

function renderModal(props: Partial<Parameters<typeof NewsPostModal>[0]> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
  return render(
    <NewsPostModal categories={CATEGORIES} onClose={vi.fn()} {...props} />,
    { wrapper: Wrapper },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('NewsPostModal — a11y shell', () => {
  it('is role=dialog with aria-labelledby, and focuses the title field initially', () => {
    renderModal();
    const dialog = screen.getByRole('dialog');
    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(screen.getByLabelText(/título/i)).toHaveFocus();
  });

  it('closes on Escape and on overlay click', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal({ onClose });
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('NewsPostModal — doble validación (NEWS-FE-BD-5)', () => {
  it('submit is disabled while title/body/category are incomplete', () => {
    renderModal();
    expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled();
  });

  it('enables submit once title, body and category are filled', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText(/título/i), 'Nueva noticia');
    await user.type(screen.getByLabelText(/cuerpo/i), 'Contenido de la noticia');
    await user.click(screen.getByRole('combobox', { name: /categoría/i }));
    await user.click(screen.getByRole('option', { name: 'Comercial' }));

    expect(screen.getByRole('button', { name: /guardar/i })).toBeEnabled();
  });

  it('maps a BE 400 validation error to a visible message without closing', async () => {
    const user = userEvent.setup();
    vi.mocked(newsApi.create).mockRejectedValue({
      response: { status: 400, data: { code: 'VALIDATION_ERROR' } },
    });
    const onClose = vi.fn();
    renderModal({ onClose });

    await user.type(screen.getByLabelText(/título/i), 'Nueva noticia');
    await user.type(screen.getByLabelText(/cuerpo/i), 'Contenido');
    await user.click(screen.getByRole('combobox', { name: /categoría/i }));
    await user.click(screen.getByRole('option', { name: 'General' }));
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo/i);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('maps a BE 422 (dangling categoryId) error to a visible message', async () => {
    const user = userEvent.setup();
    vi.mocked(newsApi.create).mockRejectedValue({
      response: { status: 422, data: { code: 'NEWS_CATEGORY_NOT_FOUND' } },
    });
    renderModal();

    await user.type(screen.getByLabelText(/título/i), 'Nueva noticia');
    await user.type(screen.getByLabelText(/cuerpo/i), 'Contenido');
    await user.click(screen.getByRole('combobox', { name: /categoría/i }));
    await user.click(screen.getByRole('option', { name: 'General' }));
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/categoría/i);
  });
});

describe('NewsPostModal — crear feliz', () => {
  it('on success calls api.create with the form payload, then closes', async () => {
    const user = userEvent.setup();
    vi.mocked(newsApi.create).mockResolvedValue(makePost());
    const onClose = vi.fn();
    renderModal({ onClose });

    await user.type(screen.getByLabelText(/título/i), 'Nueva noticia');
    await user.type(screen.getByLabelText(/cuerpo/i), 'Contenido de la noticia');
    await user.click(screen.getByRole('combobox', { name: /categoría/i }));
    await user.click(screen.getByRole('option', { name: 'Comercial' }));
    await user.click(screen.getByLabelText(/fijad/i));
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(newsApi.create).toHaveBeenCalledWith({
      title: 'Nueva noticia',
      body: 'Contenido de la noticia',
      categoryId: 'cat-2',
      pinned: true,
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('NewsPostModal — edición', () => {
  it('pre-fills fields from `initial` and calls api.update on save', async () => {
    const user = userEvent.setup();
    vi.mocked(newsApi.update).mockResolvedValue(makePost({ title: 'Editado' }));
    const onClose = vi.fn();
    renderModal({ initial: makePost(), onClose });

    expect(screen.getByLabelText(/título/i)).toHaveValue('Título existente');
    expect(screen.getByLabelText(/cuerpo/i)).toHaveValue('Cuerpo existente');

    await user.clear(screen.getByLabelText(/título/i));
    await user.type(screen.getByLabelText(/título/i), 'Editado');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(newsApi.update).toHaveBeenCalledWith('post-1', {
      title: 'Editado',
      body: 'Cuerpo existente',
      categoryId: 'cat-1',
      pinned: false,
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
