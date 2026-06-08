import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/pages/scheduling/settings/ClosureProgressTable', () => ({
  ClosureProgressTable: () => <div data-testid="closure-progress-table" />,
}));
vi.mock('@/hooks/useMyPermissions', () => ({ useMyPermissions: vi.fn() }));

import { useMyPermissions } from '@/hooks/useMyPermissions';
import { ClosurePendingPage } from '@/pages/scheduling/ClosurePendingPage';

function mockPerms(can: (p: string | string[]) => boolean) {
  vi.mocked(useMyPermissions).mockReturnValue({
    user: null, roles: [], permissions: [], isLoading: false, isError: false, can,
  } as never);
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ClosurePendingPage />
    </MemoryRouter>,
  );
}

describe('ClosurePendingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // B2.1 — pending page renders the progress table
  it('B2.1 renders ClosureProgressTable when user has iclass.manage permission', () => {
    mockPerms(() => true);
    renderPage();
    expect(screen.getByTestId('closure-progress-table')).toBeInTheDocument();
  });

  // B2.1 — page has a proper page shell (header / title)
  it('renders a page title for the pending side-effects page', () => {
    mockPerms(() => true);
    renderPage();
    expect(screen.getByRole('heading', { name: /side-effects pendientes/i })).toBeInTheDocument();
  });

  // B2.2 — pending page is permission-gated
  it('B2.2 blocks access when user does NOT have iclass.manage permission', () => {
    mockPerms((p) => !(Array.isArray(p) ? p : [p]).includes('iclass.manage'));
    renderPage();
    expect(screen.queryByTestId('closure-progress-table')).not.toBeInTheDocument();
  });
});
