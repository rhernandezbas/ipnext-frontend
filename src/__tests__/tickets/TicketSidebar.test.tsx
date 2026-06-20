import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TicketSidebar } from '@/pages/tickets/TicketDetailPage/components/TicketSidebar';
import type { Ticket } from '@/types/ticket';
import type { Contract } from '@/types/customer';

// #71 — el sidebar usa estos hooks para gatear el form y poblar las areas.
// Los mockeamos para aislar el render del link al cliente.
vi.mock('@/hooks/useMyPermissions', () => ({
  useMyPermissions: () => ({ can: () => true }),
}));
vi.mock('@/hooks/useTicketAreas', () => ({
  useTicketAreas: () => ({ data: [] }),
}));

// Contrato — el sidebar resuelve el label del contrato vía useClientContracts.
// Controlamos el retorno por test para cubrir loading / found / not-found.
const useClientContractsMock = vi.fn();
vi.mock('@/hooks/useCustomers', () => ({
  useClientContracts: (...args: unknown[]) => useClientContractsMock(...args),
}));

function makeContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: 'contract-1',
    code: 'GR-1234',
    name: null,
    type: 'internet',
    plan: 'Fibra 300MB',
    status: 'active',
    price: 0,
    startDate: '2024-01-01',
    endDate: null,
    description: '',
    address: 'Av. Siempreviva 742',
    technology: 'FTTH',
    services: [],
    ...overrides,
  };
}

const baseTicket: Ticket = {
  id: 'ticket-1',
  sequenceNumber: 1,
  subject: 'No tengo internet',
  description: 'Sin servicio',
  status: 'open',
  priority: 'medium',
  type: null,
  customerId: 'a3abe08f-d8d9-4350-85e2-56d1a17bd11e',
  customerName: 'Pérez, Juan',
  contractId: 'contract-1',
  assigneeId: null,
  assigneeName: null,
  reporterId: null,
  reporterName: null,
  reporter: null,
  areaId: null,
  areaName: null,
  areaColor: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  resolvedAt: null,
  archivedAt: null,
  tags: [],
};

function renderSidebar(ticket: Ticket) {
  return render(
    <MemoryRouter>
      <TicketSidebar
        ticket={ticket}
        users={[]}
        draftAssigneeId=""
        draftPriority="medium"
        draftAreaId=""
        onAssigneeChange={vi.fn()}
        onPriorityChange={vi.fn()}
        onAreaChange={vi.fn()}
        onSaveDetails={vi.fn()}
        isDirty={false}
        isSaving={false}
      />
    </MemoryRouter>
  );
}

describe('TicketSidebar — link al cliente (#71)', () => {
  beforeEach(() => {
    useClientContractsMock.mockReset();
    useClientContractsMock.mockReturnValue({ data: [], isLoading: false });
  });

  it('navega a la ruta canónica /admin/customers/view/:id, no a la ruta rota /admin/clients/:id', () => {
    renderSidebar(baseTicket);

    const link = screen.getByRole('link', { name: 'Pérez, Juan' });
    expect(link).toHaveAttribute(
      'href',
      '/admin/customers/view/a3abe08f-d8d9-4350-85e2-56d1a17bd11e'
    );
  });

  it('muestra el nombre del cliente como texto plano cuando no hay customerId', () => {
    renderSidebar({ ...baseTicket, customerId: '', customerName: 'Sin Cliente' });

    expect(screen.queryByRole('link', { name: 'Sin Cliente' })).toBeNull();
    expect(screen.getByText('Sin Cliente')).toBeInTheDocument();
  });
});

describe('TicketSidebar — fila Contrato', () => {
  beforeEach(() => {
    useClientContractsMock.mockReset();
    useClientContractsMock.mockReturnValue({ data: [], isLoading: false });
  });

  function rowText(label: string): string {
    const row = screen.getByText(label).closest('div') as HTMLElement;
    return row.textContent ?? '';
  }

  it('muestra una fila "Contrato"', () => {
    useClientContractsMock.mockReturnValue({ data: [makeContract()], isLoading: false });
    renderSidebar(baseTicket);
    expect(screen.getByText('Contrato')).toBeInTheDocument();
  });

  it('resuelve el label del contrato (plan - dirección - tecnología) cuando lo encuentra', () => {
    useClientContractsMock.mockReturnValue({ data: [makeContract()], isLoading: false });
    renderSidebar(baseTicket);
    expect(rowText('Contrato')).toContain('Fibra 300MB');
    expect(rowText('Contrato')).toContain('Av. Siempreviva 742');
    expect(rowText('Contrato')).toContain('FTTH');
  });

  it('linkea al detalle del cliente cuando hay contrato resuelto', () => {
    useClientContractsMock.mockReturnValue({ data: [makeContract()], isLoading: false });
    renderSidebar(baseTicket);
    const link = screen.getByRole('link', { name: /Fibra 300MB/ });
    expect(link).toHaveAttribute(
      'href',
      '/admin/customers/view/a3abe08f-d8d9-4350-85e2-56d1a17bd11e'
    );
  });

  it('muestra "—" cuando el ticket no tiene contractId', () => {
    useClientContractsMock.mockReturnValue({ data: [], isLoading: false });
    renderSidebar({ ...baseTicket, contractId: null });
    expect(rowText('Contrato')).toContain('—');
  });

  it('muestra "Cargando…" mientras useClientContracts está cargando', () => {
    useClientContractsMock.mockReturnValue({ data: undefined, isLoading: true });
    renderSidebar(baseTicket);
    expect(rowText('Contrato')).toContain('Cargando');
  });

  it('hace fallback al code/#id cuando no encuentra el contrato (ej. de baja)', () => {
    // El contrato del ticket no está en la lista (dado de baja / filtrado).
    useClientContractsMock.mockReturnValue({
      data: [makeContract({ id: 'otro-contrato' })],
      isLoading: false,
    });
    renderSidebar({ ...baseTicket, contractId: 'contract-1' });
    // No hay match → muestra el id como fallback, NO el plan de otro contrato.
    const text = rowText('Contrato');
    expect(text).toContain('contract-1');
    expect(text).not.toContain('Fibra 300MB');
  });

  it('no consulta contratos cuando no hay customerId (enabled=false)', () => {
    renderSidebar({ ...baseTicket, customerId: '', contractId: null });
    // El hook se llama con enabled=false (segundo arg falsy).
    const lastCall = useClientContractsMock.mock.calls.at(-1);
    expect(lastCall?.[1]).toBe(false);
  });
});
