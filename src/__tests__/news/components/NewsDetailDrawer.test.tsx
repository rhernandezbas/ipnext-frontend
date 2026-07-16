import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { NewsDetailDrawer } from '@/pages/news/components/NewsDetailDrawer';
import type { NewsPost } from '@/types/news';

function makePost(over: Partial<NewsPost> = {}): NewsPost {
  return {
    id: 'post-1',
    title: 'Corte programado',
    body: 'Línea uno.\nLínea dos con <b>HTML crudo</b> que NO debe interpretarse.',
    category: { id: 'cat-1', name: 'General', color: '#64748b' },
    authorId: 'user-1',
    authorName: 'Ana Pérez',
    pinned: false,
    publishedAt: '2026-06-01T15:30:00.000Z',
    archivedAt: null,
    read: false,
    createdAt: '2026-06-01T15:30:00.000Z',
    updatedAt: '2026-06-01T15:30:00.000Z',
    ...over,
  };
}

describe('NewsDetailDrawer', () => {
  it('renders the full body as plain pre-wrap text, WITHOUT interpreting HTML (NEWS-FE-BD-3)', () => {
    render(<NewsDetailDrawer post={makePost()} onClose={vi.fn()} onMarkRead={vi.fn()} />);
    // The raw "<b>" tag text must be visible as literal text, not rendered as a <b> element.
    expect(screen.getByText(/<b>HTML crudo<\/b>/)).toBeInTheDocument();
    expect(screen.queryByRole('strong')).not.toBeInTheDocument();
  });

  it('calls onMarkRead exactly once when opening an UNREAD post', () => {
    const onMarkRead = vi.fn();
    render(<NewsDetailDrawer post={makePost({ id: 'post-9', read: false })} onClose={vi.fn()} onMarkRead={onMarkRead} />);
    expect(onMarkRead).toHaveBeenCalledTimes(1);
    expect(onMarkRead).toHaveBeenCalledWith('post-9');
  });

  it('does NOT call onMarkRead when opening an already-READ post', () => {
    const onMarkRead = vi.fn();
    render(<NewsDetailDrawer post={makePost({ read: true })} onClose={vi.fn()} onMarkRead={onMarkRead} />);
    expect(onMarkRead).not.toHaveBeenCalled();
  });

  it('is an accessible dialog: role=dialog, aria-modal, aria-labelledby pointing to the title', () => {
    render(<NewsDetailDrawer post={makePost()} onClose={vi.fn()} onMarkRead={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy!)).toHaveTextContent('Corte programado');
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<NewsDetailDrawer post={makePost()} onClose={onClose} onMarkRead={vi.fn()} />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('closes when the close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<NewsDetailDrawer post={makePost()} onClose={onClose} onMarkRead={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /cerrar/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders author + AR-formatted publish date and category name', () => {
    render(<NewsDetailDrawer post={makePost()} onClose={vi.fn()} onMarkRead={vi.fn()} />);
    expect(screen.getByText(/Ana Pérez/)).toBeInTheDocument();
    expect(screen.getByText('General')).toBeInTheDocument();
    // formatDateTimeShort('2026-06-01T15:30:00.000Z') → AR (UTC-3) = 01 jun 2026 - 12:30
    expect(screen.getByText(/01 jun 2026 - 12:30/)).toBeInTheDocument();
  });
});
