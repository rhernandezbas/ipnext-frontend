import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import TicketRequestersPage from '@/pages/tickets/TicketRequestersPage';
import * as useTicketRequestersModule from '@/hooks/useTicketRequesters';
import type { TicketRequester } from '@/types/ticketRequester';

vi.mock('@/hooks/useTicketRequesters');

const mockRequesters: TicketRequester[] = [
  { id: '1', nombre: 'Juan Test', email: 'juan.test@example.com', ticketsAbiertos: 3, ultimaActividad: '2024-03-20' },
  { id: '2', nombre: 'María Test', email: 'maria.test@example.com', ticketsAbiertos: 1, ultimaActividad: '2024-03-19' },
];

describe('TicketRequestersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useTicketRequestersModule.useTicketRequesters).mockReturnValue({
      data: mockRequesters,
      isLoading: false,
    } as ReturnType<typeof useTicketRequestersModule.useTicketRequesters>);
  });

  it('renders the page title', () => {
    render(<MemoryRouter><TicketRequestersPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /Destinatarios/i })).toBeInTheDocument();
  });

  it('renders requesters from hook data', () => {
    render(<MemoryRouter><TicketRequestersPage /></MemoryRouter>);
    expect(screen.getByText('Juan Test')).toBeInTheDocument();
    expect(screen.getByText('María Test')).toBeInTheDocument();
  });

  it('shows loading state when isLoading is true', () => {
    vi.mocked(useTicketRequestersModule.useTicketRequesters).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useTicketRequestersModule.useTicketRequesters>);
    render(<MemoryRouter><TicketRequestersPage /></MemoryRouter>);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });
});
