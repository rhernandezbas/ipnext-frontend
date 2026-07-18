import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { NewsCard } from '@/pages/news/components/NewsCard';
import type { NewsPost } from '@/types/news';

function makePost(over: Partial<NewsPost> = {}): NewsPost {
  return {
    id: 'post-1',
    title: 'Corte programado en Nodo Centro',
    body: 'Línea 1\nLínea 2 con más detalle sobre el corte.',
    category: { id: 'cat-1', name: 'Red/Infraestructura', color: '#6366f1' },
    authorId: 'user-1',
    authorName: 'Ana Pérez',
    pinned: false,
    publishedAt: new Date().toISOString(),
    archivedAt: null,
    read: false,
    attachments: [],
    lastBroadcastAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...over,
  };
}

describe('NewsCard', () => {
  it('renders title, category pill (with color), and author', () => {
    render(<NewsCard post={makePost()} onOpen={vi.fn()} />);
    expect(screen.getByText('Corte programado en Nodo Centro')).toBeInTheDocument();
    const pill = screen.getByText('Red/Infraestructura');
    expect(pill).toBeInTheDocument();
    expect(screen.getByText(/Ana Pérez/)).toBeInTheDocument();
  });

  it('shows a pinned indicator when pinned', () => {
    render(<NewsCard post={makePost({ pinned: true })} onOpen={vi.fn()} />);
    expect(screen.getByLabelText(/fijad/i)).toBeInTheDocument();
  });

  it('does NOT show a pinned indicator when not pinned', () => {
    render(<NewsCard post={makePost({ pinned: false })} onOpen={vi.fn()} />);
    expect(screen.queryByLabelText(/fijad/i)).not.toBeInTheDocument();
  });

  it('shows an unread dot with accessible label when unread', () => {
    render(<NewsCard post={makePost({ read: false })} onOpen={vi.fn()} />);
    expect(screen.getByLabelText('No leída')).toBeInTheDocument();
  });

  it('does NOT show the unread dot when read', () => {
    render(<NewsCard post={makePost({ read: true })} onOpen={vi.fn()} />);
    expect(screen.queryByLabelText('No leída')).not.toBeInTheDocument();
  });

  it('calls onOpen with the post id when clicked', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<NewsCard post={makePost({ id: 'post-42' })} onOpen={onOpen} />);
    await user.click(screen.getByRole('button', { name: /corte programado/i }));
    expect(onOpen).toHaveBeenCalledWith('post-42');
  });

  it('is keyboard-activatable (Enter) since it renders as a real button', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<NewsCard post={makePost({ id: 'post-7' })} onOpen={onOpen} />);
    const card = screen.getByRole('button', { name: /corte programado/i });
    card.focus();
    await user.keyboard('{Enter}');
    expect(onOpen).toHaveBeenCalledWith('post-7');
  });

  describe('M2 — valid HTML structure + real heading + short accessible name', () => {
    it('renders the card as an <article> (not a <button> wrapping flow content)', () => {
      render(<NewsCard post={makePost()} onOpen={vi.fn()} />);
      expect(screen.getByRole('article')).toBeInTheDocument();
    });

    it('exposes the title as a real level-3 heading, navigable by screen readers', () => {
      render(<NewsCard post={makePost()} onOpen={vi.fn()} />);
      expect(
        screen.getByRole('heading', { level: 3, name: 'Corte programado en Nodo Centro' }),
      ).toBeInTheDocument();
    });

    it('the activation control has a SHORT accessible name (the title only, not the whole card text)', () => {
      render(<NewsCard post={makePost({ pinned: true, read: false })} onOpen={vi.fn()} />);
      const trigger = screen.getByRole('button', { name: 'Corte programado en Nodo Centro' });
      expect(trigger).toHaveAccessibleName('Corte programado en Nodo Centro');
      // The excerpt/author/category text must NOT be part of the button's name.
      expect(trigger.textContent).toBe('Corte programado en Nodo Centro');
    });

    it('is still keyboard-activatable via the (now title-scoped) button', async () => {
      const user = userEvent.setup();
      const onOpen = vi.fn();
      render(<NewsCard post={makePost({ id: 'post-9' })} onOpen={onOpen} />);
      screen.getByRole('button', { name: /corte programado/i }).focus();
      await user.keyboard('{Enter}');
      expect(onOpen).toHaveBeenCalledWith('post-9');
    });
  });
});
