import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { TicketSidebar } from '@/pages/tickets/TicketDetailPage/components/TicketSidebar';
import type { Ticket } from '@/types/ticket';

// #71 — el sidebar usa estos hooks para gatear el form y poblar las areas.
// Los mockeamos para aislar el render del link al cliente.
vi.mock('@/hooks/useMyPermissions', () => ({
  useMyPermissions: () => ({ can: () => true }),
}));
vi.mock('@/hooks/useTicketAreas', () => ({
  useTicketAreas: () => ({ data: [] }),
}));

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
