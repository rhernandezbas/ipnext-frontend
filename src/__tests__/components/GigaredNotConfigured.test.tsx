import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { GigaredNotConfigured } from '@/components/molecules/GigaredNotConfigured/GigaredNotConfigured';

function renderBanner() {
  return render(
    <MemoryRouter>
      <GigaredNotConfigured />
    </MemoryRouter>,
  );
}

function mockCan(perms: string[]) {
  vi.mocked(useMyPermissions).mockReturnValue({
    permissions: perms,
    roles: [],
    user: null,
    isLoading: false,
    isError: false,
    can: (p: string | string[]) => {
      const list = Array.isArray(p) ? p : [p];
      return list.some((x) => perms.includes(x) || perms.includes('*'));
    },
  });
}

describe('GigaredNotConfigured', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the not-configured message', () => {
    mockCan(['tv.read']);
    renderBanner();
    expect(screen.getByText(/no está configurada/i)).toBeInTheDocument();
  });

  it('shows a settings link when the user has tv.manage', () => {
    mockCan(['tv.manage']);
    renderBanner();
    const link = screen.getByRole('link', { name: /configurar/i });
    expect(link).toHaveAttribute('href', '/admin/customers/settings#gigared');
  });

  it('tells non-managers to ask an admin (no settings link)', () => {
    mockCan(['tv.read']);
    renderBanner();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText(/administrador/i)).toBeInTheDocument();
  });
});
