import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import LeadsPage from '@/pages/clientes/LeadsPage';
import * as useLeadsModule from '@/hooks/useLeads';
import type { Lead } from '@/types/lead';

vi.mock('@/hooks/useLeads');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const mockLeads: Lead[] = [
  {
    id: '1',
    name: 'Federico Álvarez',
    email: 'federico@gmail.com',
    phone: '11-4521-8890',
    address: 'Av. Santa Fe 2345',
    city: 'Buenos Aires',
    source: 'website',
    status: 'new',
    assignedTo: 'María López',
    assignedToId: 'admin-1',
    interestedIn: 'Plan Estándar 100Mbps',
    notes: '',
    followUpDate: '2026-05-05',
    createdAt: new Date().toISOString(),
    convertedAt: null,
    convertedClientId: null,
  },
  {
    id: '2',
    name: 'Valeria Moreno',
    email: 'valeria@hotmail.com',
    phone: '11-3344-5566',
    address: 'Corrientes 1500',
    city: 'Buenos Aires',
    source: 'referral',
    status: 'contacted',
    assignedTo: 'Carlos Gómez',
    assignedToId: 'admin-2',
    interestedIn: 'Plan Premium 300Mbps',
    notes: '',
    followUpDate: '2026-05-03',
    createdAt: new Date().toISOString(),
    convertedAt: null,
    convertedClientId: null,
  },
];

const mockMutate = vi.fn();

function renderPage() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <LeadsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('LeadsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useLeadsModule.useLeads).mockReturnValue({
      data: mockLeads,
      isLoading: false,
    } as ReturnType<typeof useLeadsModule.useLeads>);

    vi.mocked(useLeadsModule.useCreateLead).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useLeadsModule.useCreateLead>);

    vi.mocked(useLeadsModule.useUpdateLead).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useLeadsModule.useUpdateLead>);

    vi.mocked(useLeadsModule.useDeleteLead).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useLeadsModule.useDeleteLead>);

    vi.mocked(useLeadsModule.useConvertLeadToClient).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useLeadsModule.useConvertLeadToClient>);
  });

  it('renders "Clientes potenciales" heading', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Clientes potenciales' })).toBeInTheDocument();
  });

  it('"Nuevo lead" button exists', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Nuevo lead' })).toBeInTheDocument();
  });

  it('status filter tabs render', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Todos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nuevo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Contactado' })).toBeInTheDocument();
  });

  it('table shows lead names from mock', () => {
    renderPage();
    expect(screen.getByText('Federico Álvarez')).toBeInTheDocument();
    expect(screen.getByText('Valeria Moreno')).toBeInTheDocument();
  });

  it('source badges render', () => {
    renderPage();
    expect(screen.getByText('Web')).toBeInTheDocument();
    expect(screen.getByText('Referido')).toBeInTheDocument();
  });

  it('clicking "Nuevo lead" shows form', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Nuevo lead' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre')).toBeInTheDocument();
  });
});
