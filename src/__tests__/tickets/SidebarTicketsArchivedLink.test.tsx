/**
 * #85 fix — Sidebar "Archivar" link for Tickets must point to
 * /admin/tickets/archived (TicketsArchivedPage, archived:true) and NOT to
 * /admin/tickets/trash (TicketsArchivePage, status=closed).
 *
 * Also verifies that /admin/tickets/archived renders TicketsArchivedPage
 * (which in turn renders TicketsListPage with archivedView=true).
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Permissions mock ───────────────────────────────────────────────────────────
const permHandles = vi.hoisted(() => ({
  result: {
    can: (_: string | string[]) => true,
    isLoading: false,
    isError: false,
    user: null,
    roles: [],
    permissions: [] as string[],
  },
}));

vi.mock('@/hooks/useMyPermissions', () => ({
  useMyPermissions: () => permHandles.result,
}));

import { Sidebar } from '@/components/organisms/Sidebar/Sidebar';
import TicketsArchivedPage from '@/pages/tickets/TicketsArchivedPage';

// ── Minimal stub so TicketsArchivedPage renders without wiring all hooks ───────
vi.mock('@/pages/tickets/TicketsListPage', () => ({
  default: ({ archivedView }: { archivedView?: boolean }) => (
    <div data-testid="tickets-list-page" data-archived-view={archivedView ? 'true' : 'false'}>
      MockTicketsListPage
    </div>
  ),
}));

function renderSidebarAtTickets() {
  permHandles.result.can = () => true;
  return render(
    <MemoryRouter initialEntries={['/admin/tickets/archived']}>
      <Sidebar />
    </MemoryRouter>,
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('Sidebar — Tickets "Archivar" link (#85 fix)', () => {
  beforeEach(() => {
    permHandles.result.isLoading = false;
    permHandles.result.can = () => true;
  });

  it('the "Archivar" sidebar item links to /admin/tickets/archived, NOT /admin/tickets/trash', () => {
    renderSidebarAtTickets();
    // The Tickets group expands when the current path matches /admin/tickets
    const archivarLink = screen.getByRole('link', { name: 'Archivar' });
    expect(archivarLink).toHaveAttribute('href', '/admin/tickets/archived');
    expect(archivarLink).not.toHaveAttribute('href', '/admin/tickets/trash');
  });
});

describe('TicketsArchivedPage — renders TicketsListPage with archivedView (#85)', () => {
  it('passes archivedView=true to TicketsListPage', () => {
    render(
      <MemoryRouter>
        <TicketsArchivedPage />
      </MemoryRouter>,
    );
    const listPage = screen.getByTestId('tickets-list-page');
    expect(listPage).toHaveAttribute('data-archived-view', 'true');
  });
});
