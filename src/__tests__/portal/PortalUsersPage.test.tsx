import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import PortalUsersPage from '@/pages/portal/PortalUsersPage';

vi.mock('@/hooks/usePortal', () => ({
  usePortalUsers: vi.fn(),
}));

import { usePortalUsers } from '@/hooks/usePortal';

const mockUsers = [
  { id: '1', clientName: 'Juan Pérez', email: 'juan@ejemplo.com', lastAccess: '2026-04-28', status: 'activo' },
  { id: '2', clientName: 'María García', email: 'maria@ejemplo.com', lastAccess: '2026-04-27', status: 'inactivo' },
];

describe('PortalUsersPage', () => {
  beforeEach(() => {
    vi.mocked(usePortalUsers).mockReturnValue({
      data: mockUsers,
      isLoading: false,
    } as ReturnType<typeof usePortalUsers>);
  });

  it('renders heading "Usuarios del Portal"', () => {
    render(<MemoryRouter><PortalUsersPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /usuarios del portal/i })).toBeInTheDocument();
  });

  it('renders user names in the table', () => {
    render(<MemoryRouter><PortalUsersPage /></MemoryRouter>);
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    expect(screen.getByText('María García')).toBeInTheDocument();
  });

  it('renders column headers', () => {
    render(<MemoryRouter><PortalUsersPage /></MemoryRouter>);
    expect(screen.getByText(/cliente/i)).toBeInTheDocument();
    expect(screen.getByText(/email/i)).toBeInTheDocument();
    expect(screen.getByText(/último acceso/i)).toBeInTheDocument();
    expect(screen.getByText(/estado/i)).toBeInTheDocument();
  });
});
