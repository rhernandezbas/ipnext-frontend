/**
 * #87 — TicketsListPage filter bar always-visible (mirrors Tasks UX).
 *
 * The disclosure wrapper is gone. The TicketFilterBar must be rendered inline,
 * always visible — no "Filtros" toggle button is needed to reveal controls.
 * All 6 filter controls (estado, prioridad, asignado, área, desde, hasta,
 * búsqueda) must be present in the DOM without any click.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import TicketsListPage from '@/pages/tickets/TicketsListPage';
import * as useTicketsModule from '@/hooks/useTickets';
import * as useTicketStatusesModule from '@/hooks/useTicketStatuses';
import * as useMyPermissionsModule from '@/hooks/useMyPermissions';
import * as useRbacUsersModule from '@/hooks/useRbacUsers';
import * as useTicketAreasModule from '@/hooks/useTicketAreas';
import type { Ticket } from '@/types/ticket';
import type { TicketStatus } from '@/types/ticketStatus';

vi.mock('@/hooks/useTickets');
vi.mock('@/hooks/useTicketStatuses');
vi.mock('@/hooks/useMyPermissions');
vi.mock('@/hooks/useRbacUsers');
vi.mock('@/hooks/useTicketAreas');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const mockTickets: Ticket[] = [
  {
    id: '1',
    sequenceNumber: 1,
    subject: 'Test ticket',
    customerName: 'Alice',
    customerId: '1',
    priority: 'high',
    status: 'open',
    type: null,
    assigneeName: 'Juan',
    assigneeId: null,
    reporterId: null,
    reporterName: null,
    reporter: null,
    description: '',
    tags: [],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-02',
    resolvedAt: null,
    contractId: null,
    areaId: null,
    areaName: null,
    areaColor: null,
    archivedAt: null,
  },
];

const mockStatuses: TicketStatus[] = [
  { id: '1', name: 'open', color: '#22c55e', weight: 1 },
];

function renderList() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<TicketsListPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('TicketsListPage — always-visible filter bar (#87)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useTicketsModule.useTicketList).mockReturnValue({
      data: { data: mockTickets, total: 1 },
      isLoading: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTicketsModule.useTicketList>);
    vi.mocked(useTicketStatusesModule.useTicketStatuses).mockReturnValue({
      data: mockStatuses,
      isLoading: false,
    } as ReturnType<typeof useTicketStatusesModule.useTicketStatuses>);
    vi.mocked(useTicketsModule.useDeleteTicket).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useTicketsModule.useDeleteTicket>);
    vi.mocked(useTicketsModule.useCreateTicket).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: false,
    } as unknown as ReturnType<typeof useTicketsModule.useCreateTicket>);
    vi.mocked(useRbacUsersModule.useRbacUsers).mockReturnValue({
      data: [{ id: 'u1', name: 'Ana', roles: [] }],
    } as unknown as ReturnType<typeof useRbacUsersModule.useRbacUsers>);
    vi.mocked(useTicketAreasModule.useTicketAreas).mockReturnValue({
      data: [{ id: 'a1', name: 'Soporte' }],
      isLoading: false,
    } as ReturnType<typeof useTicketAreasModule.useTicketAreas>);
    vi.mocked(useMyPermissionsModule.useCan).mockReturnValue(true);
    vi.mocked(useMyPermissionsModule.useMyPermissions).mockReturnValue({
      can: vi.fn().mockReturnValue(true),
      permissions: ['*'],
      isLoading: false,
    } as unknown as ReturnType<typeof useMyPermissionsModule.useMyPermissions>);
  });

  it('does NOT render a "Filtros" toggle button (disclosure is gone)', () => {
    renderList();
    // The old TicketFilterDisclosure rendered a button with text "Filtros".
    // After #87, no such button should exist — the bar is always visible.
    expect(screen.queryByRole('button', { name: /^filtros$/i })).not.toBeInTheDocument();
  });

  it('renders the Estado filter control WITHOUT requiring any click', () => {
    renderList();
    expect(screen.getByRole('combobox', { name: /estado/i })).toBeInTheDocument();
  });

  it('renders the Prioridad filter control without any click', () => {
    renderList();
    expect(screen.getByRole('combobox', { name: /prioridad/i })).toBeInTheDocument();
  });

  it('renders the Asignado filter control without any click', () => {
    renderList();
    expect(screen.getByRole('combobox', { name: /asignado/i })).toBeInTheDocument();
  });

  it('renders the Area filter control without any click', () => {
    renderList();
    expect(screen.getByRole('combobox', { name: /area/i })).toBeInTheDocument();
  });

  it('renders the Buscar search input without any click', () => {
    renderList();
    expect(screen.getByRole('searchbox', { name: /buscar/i })).toBeInTheDocument();
  });

  it('renders the Desde date input without any click', () => {
    renderList();
    expect(screen.getByLabelText(/desde/i)).toBeInTheDocument();
  });

  it('renders the Hasta date input without any click', () => {
    renderList();
    expect(screen.getByLabelText(/hasta/i)).toBeInTheDocument();
  });
});
