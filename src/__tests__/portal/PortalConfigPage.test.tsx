import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import PortalConfigPage from '@/pages/portal/PortalConfigPage';

vi.mock('@/hooks/usePortal', () => ({
  usePortalConfig: vi.fn(),
}));

import { usePortalConfig } from '@/hooks/usePortal';

const mockConfig = {
  enablePayments: true,
  enableTickets: true,
  enableUsage: false,
  welcomeMessage: 'Bienvenido al portal de clientes IPNEXT',
  brandColor: '#2563eb',
};

describe('PortalConfigPage', () => {
  beforeEach(() => {
    vi.mocked(usePortalConfig).mockReturnValue({
      data: mockConfig,
      isLoading: false,
    } as ReturnType<typeof usePortalConfig>);
  });

  it('renders heading "Configuración del Portal"', () => {
    render(<MemoryRouter><PortalConfigPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /configuración del portal/i })).toBeInTheDocument();
  });

  it('renders Pagos toggle label', () => {
    render(<MemoryRouter><PortalConfigPage /></MemoryRouter>);
    expect(screen.getByText(/pagos/i)).toBeInTheDocument();
  });

  it('renders Tickets toggle label', () => {
    render(<MemoryRouter><PortalConfigPage /></MemoryRouter>);
    expect(screen.getByText(/tickets/i)).toBeInTheDocument();
  });

  it('renders Uso toggle label', () => {
    render(<MemoryRouter><PortalConfigPage /></MemoryRouter>);
    expect(screen.getByText(/uso/i)).toBeInTheDocument();
  });

  it('renders welcome message', () => {
    render(<MemoryRouter><PortalConfigPage /></MemoryRouter>);
    expect(screen.getByText('Bienvenido al portal de clientes IPNEXT')).toBeInTheDocument();
  });
});
