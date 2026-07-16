import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NewsPost } from '@/types/news';

vi.mock('@/hooks/useNews', () => ({
  useArchiveNewsPost: vi.fn(),
}));

import { useArchiveNewsPost } from '@/hooks/useNews';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { UseMyPermissionsResult } from '@/hooks/useMyPermissions';
import { NewsDetailDrawer } from '@/pages/news/components/NewsDetailDrawer';

const mockUseArchive = useArchiveNewsPost as unknown as ReturnType<typeof vi.fn>;

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

function renderDrawer(props: Partial<Parameters<typeof NewsDetailDrawer>[0]> = {}) {
  return render(
    <NewsDetailDrawer
      post={makePost()}
      onClose={vi.fn()}
      onMarkRead={vi.fn()}
      onEdit={vi.fn()}
      onArchived={vi.fn()}
      {...props}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPerms({});
  mockUseArchive.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(makePost()), isPending: false });
});

describe('NewsDetailDrawer', () => {
  it('renders the full body as plain pre-wrap text, WITHOUT interpreting HTML (NEWS-FE-BD-3)', () => {
    renderDrawer();
    // The raw "<b>" tag text must be visible as literal text, not rendered as a <b> element.
    expect(screen.getByText(/<b>HTML crudo<\/b>/)).toBeInTheDocument();
    expect(screen.queryByRole('strong')).not.toBeInTheDocument();
  });

  it('calls onMarkRead exactly once when opening an UNREAD post', () => {
    const onMarkRead = vi.fn();
    renderDrawer({ post: makePost({ id: 'post-9', read: false }), onMarkRead });
    expect(onMarkRead).toHaveBeenCalledTimes(1);
    expect(onMarkRead).toHaveBeenCalledWith('post-9');
  });

  it('does NOT call onMarkRead when opening an already-READ post', () => {
    const onMarkRead = vi.fn();
    renderDrawer({ post: makePost({ read: true }), onMarkRead });
    expect(onMarkRead).not.toHaveBeenCalled();
  });

  it('is an accessible dialog: role=dialog, aria-modal, aria-labelledby pointing to the title', () => {
    renderDrawer();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy!)).toHaveTextContent('Corte programado');
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDrawer({ onClose });
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('closes when the close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDrawer({ onClose });
    await user.click(screen.getByRole('button', { name: /cerrar/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders author + AR-formatted publish date and category name', () => {
    renderDrawer();
    expect(screen.getByText(/Ana Pérez/)).toBeInTheDocument();
    expect(screen.getByText('General')).toBeInTheDocument();
    // formatDateTimeShort('2026-06-01T15:30:00.000Z') → AR (UTC-3) = 01 jun 2026 - 12:30
    expect(screen.getByText(/01 jun 2026 - 12:30/)).toBeInTheDocument();
  });
});

describe('NewsDetailDrawer — manage actions (M3: editar/archivar wiring)', () => {
  it('shows "Editar" and "Archivar" for a news.manage user', () => {
    renderDrawer();
    expect(screen.getByRole('button', { name: /^editar$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^archivar$/i })).toBeInTheDocument();
  });

  it('hides "Editar" and "Archivar" WITHOUT news.manage', () => {
    mockPerms({ permissions: ['news.read'], can: (p) => (Array.isArray(p) ? p[0] === 'news.read' : p === 'news.read') });
    renderDrawer();
    expect(screen.queryByRole('button', { name: /^editar$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^archivar$/i })).not.toBeInTheDocument();
  });

  it('"Editar" calls onEdit with the current (snapshot) post', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const post = makePost({ id: 'post-edit' });
    renderDrawer({ post, onEdit });

    await user.click(screen.getByRole('button', { name: /^editar$/i }));

    expect(onEdit).toHaveBeenCalledWith(post);
  });

  it('"Archivar" confirms, then calls useArchiveNewsPost with {id, archived:true} and notifies onArchived with a visible success message (re-review fix: seam M1xM3)', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue(makePost({ archivedAt: '2026-07-16T00:00:00.000Z' }));
    mockUseArchive.mockReturnValue({ mutateAsync, isPending: false });
    const onArchived = vi.fn();
    renderDrawer({ post: makePost({ id: 'post-arch', archivedAt: null }), onArchived });

    await user.click(screen.getByRole('button', { name: /^archivar$/i }));

    expect(mutateAsync).toHaveBeenCalledWith({ id: 'post-arch', archived: true });
    // Re-review finding: `isArchived` reads the M1 frozen snapshot (`post.archivedAt`),
    // which never updates after a successful archive — the "Archivar" label would go
    // stale ("Archivar" instead of "Desarchivar") if the drawer stayed open. Fix: the
    // drawer no longer owns success feedback locally — it delegates to the parent via
    // `onArchived`, which closes the drawer (discarding the stale snapshot) AND shows
    // the success message as a board-level toast (NewsBoardPage.tsx), so the message
    // stays visible even though the drawer itself unmounts.
    await waitFor(() => expect(onArchived).toHaveBeenCalledWith(expect.stringMatching(/archivad/i)));
  });

  it('an ALREADY-archived post shows "Desarchivar" and calls the mutation with archived:false', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue(makePost());
    mockUseArchive.mockReturnValue({ mutateAsync, isPending: false });
    renderDrawer({ post: makePost({ id: 'post-arch-2', archivedAt: '2026-07-01T00:00:00.000Z' }) });

    const btn = screen.getByRole('button', { name: /desarchivar/i });
    await user.click(btn);

    expect(mutateAsync).toHaveBeenCalledWith({ id: 'post-arch-2', archived: false });
  });

  it('shows a visible error and keeps the drawer open when archiving fails', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockRejectedValue(new Error('network'));
    mockUseArchive.mockReturnValue({ mutateAsync, isPending: false });
    const onClose = vi.fn();
    renderDrawer({ onClose });

    await user.click(screen.getByRole('button', { name: /^archivar$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo/i);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does NOT archive when the confirmation is declined', async () => {
    const { useConfirm } = await import('@/context/ConfirmContext');
    vi.mocked(useConfirm).mockReturnValue(vi.fn().mockResolvedValue(false));
    const user = userEvent.setup();
    const mutateAsync = vi.fn();
    mockUseArchive.mockReturnValue({ mutateAsync, isPending: false });
    renderDrawer();

    await user.click(screen.getByRole('button', { name: /^archivar$/i }));

    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
