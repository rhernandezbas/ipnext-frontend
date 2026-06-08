import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/pages/scheduling/settings/InFlightTasksTable', () => ({
  InFlightTasksTable: () => <div data-testid="in-flight-tasks-table" />,
}));
vi.mock('@/hooks/useMyPermissions', () => ({ useMyPermissions: vi.fn() }));

import { useMyPermissions } from '@/hooks/useMyPermissions';
import { ReconcileInFlightPage } from '@/pages/scheduling/ReconcileInFlightPage';

function mockPerms(can: (p: string | string[]) => boolean) {
  vi.mocked(useMyPermissions).mockReturnValue({
    user: null, roles: [], permissions: [], isLoading: false, isError: false, can,
  } as never);
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ReconcileInFlightPage />
    </MemoryRouter>,
  );
}

describe('ReconcileInFlightPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders InFlightTasksTable when the user has iclass.manage', () => {
    mockPerms(() => true);
    renderPage();
    expect(screen.getByTestId('in-flight-tasks-table')).toBeInTheDocument();
  });

  it('renders the page title', () => {
    mockPerms(() => true);
    renderPage();
    expect(
      screen.getByRole('heading', { name: /reconciliar os in-flight/i }),
    ).toBeInTheDocument();
  });

  it('has a breadcrumb back to scheduling settings', () => {
    mockPerms(() => true);
    renderPage();
    const link = screen.getByRole('link', { name: /scheduling/i });
    expect(link).toHaveAttribute('href', '/admin/scheduling/settings');
  });

  // Scenario: Page is not accessible without iclass.manage
  it('blocks access when the user lacks iclass.manage', () => {
    mockPerms((p) => !(Array.isArray(p) ? p : [p]).includes('iclass.manage'));
    renderPage();
    expect(screen.queryByTestId('in-flight-tasks-table')).not.toBeInTheDocument();
  });
});
