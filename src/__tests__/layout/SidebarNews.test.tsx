/**
 * internal-news FE apply — sidebar swap + badge (NEWS-FE-SB-1, NEWS-FE-SB-2).
 * Mirrors SidebarPermissions.test.tsx's mocking style for useMyPermissions, and
 * overrides the module-level safe default (src/test/setup.ts) for
 * useNewsUnreadCount to assert the badge itself.
 */
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { UseMyPermissionsResult } from '@/hooks/useMyPermissions';
import { useNewsUnreadCount } from '@/hooks/useNews';
import { Sidebar } from '@/components/organisms/Sidebar/Sidebar';

function mockPerms(overrides: Partial<UseMyPermissionsResult>) {
  const base: UseMyPermissionsResult = {
    user: null,
    roles: [],
    permissions: [],
    isLoading: false,
    isError: false,
    can: () => false,
  };
  vi.mocked(useMyPermissions).mockReturnValue({ ...base, ...overrides });
}

function mockUnreadCount(data: number | undefined) {
  vi.mocked(useNewsUnreadCount).mockReturnValue({
    data,
    isLoading: false,
    isError: false,
  } as ReturnType<typeof useNewsUnreadCount>);
}

function renderSidebar(path = '/admin/dashboard') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar open onToggle={() => {}} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPerms({ permissions: ['news.read'], can: (p) => (Array.isArray(p) ? p.includes('news.read') : p === 'news.read') });
  mockUnreadCount(0);
});

describe('Sidebar — Noticias swap (NEWS-FE-SB-1)', () => {
  it('renders "Noticias" → /admin/news and NOT "Notificaciones", for a user with news.read', () => {
    renderSidebar();
    const link = screen.getByRole('link', { name: /noticias/i });
    expect(link).toHaveAttribute('href', '/admin/news');
    expect(screen.queryByRole('link', { name: /^notificaciones$/i })).not.toBeInTheDocument();
  });

  it('hides the Noticias link for a user WITHOUT news.read (permissions loaded)', () => {
    mockPerms({ permissions: [], can: () => false });
    renderSidebar();
    expect(screen.queryByRole('link', { name: /noticias/i })).not.toBeInTheDocument();
  });

  it('shows the Noticias link while permissions are still loading (no layout shift)', () => {
    mockPerms({ isLoading: true, can: () => false });
    renderSidebar();
    expect(screen.getByRole('link', { name: /noticias/i })).toBeInTheDocument();
  });
});

describe('Sidebar — Noticias unread badge (NEWS-FE-SB-2)', () => {
  it('shows the exact count when > 0, with an accessible label carrying the real number', () => {
    mockUnreadCount(3);
    renderSidebar();
    const link = screen.getByRole('link', { name: /noticias/i });
    expect(within(link).getByText('3')).toBeInTheDocument();
    expect(within(link).getByLabelText('3 noticias sin leer')).toBeInTheDocument();
  });

  it('caps the visual badge at "99+" for large counts, but keeps the real number in aria-label', () => {
    mockUnreadCount(120);
    renderSidebar();
    const link = screen.getByRole('link', { name: /noticias/i });
    expect(within(link).getByText('99+')).toBeInTheDocument();
    expect(within(link).getByLabelText('120 noticias sin leer')).toBeInTheDocument();
  });

  it('hides the badge entirely when the count is 0', () => {
    mockUnreadCount(0);
    renderSidebar();
    const link = screen.getByRole('link', { name: /^noticias$/i });
    expect(within(link).queryByText(/\d/)).not.toBeInTheDocument();
  });

  it('hides the badge while the count is still loading (undefined)', () => {
    mockUnreadCount(undefined);
    renderSidebar();
    const link = screen.getByRole('link', { name: /^noticias$/i });
    expect(within(link).queryByText(/\d/)).not.toBeInTheDocument();
  });
});
