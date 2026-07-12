import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { InteractionsSection } from './InteractionsSection';
import type { WhatsappInboxClientSummary } from '@/types/whatsapp';

const BASE: WhatsappInboxClientSummary = {
  id: '1',
  name: 'Juan Perez',
  email: null,
  phone: null,
  status: 'active',
  fichaClientId: '1',
  balance: { due: null, currency: null, isDebtor: false, stale: false, lastRefreshedAt: null },
  lastInvoice: null,
  nextDueDate: null,
  contracts: [],
  openTicketsCount: 0,
  recentTickets: [],
  recentTasks: [],
  recentLogs: [],
};

function renderSection(client: WhatsappInboxClientSummary) {
  return render(
    <MemoryRouter>
      <InteractionsSection client={client} />
    </MemoryRouter>,
  );
}

describe('InteractionsSection (messaging-inbox-v2 F1.5, design §5.4)', () => {
  it('openTicketsCount > 0 muestra el contador prominente', () => {
    renderSection({ ...BASE, openTicketsCount: 7 });
    expect(screen.getByText(/7 tickets abiertos/i)).toBeInTheDocument();
  });

  it('recentTickets se listan con #seq + subject', () => {
    renderSection({
      ...BASE,
      openTicketsCount: 1,
      recentTickets: [{ id: 't1', sequenceNumber: 123, subject: 'Sin señal', status: 'open', priority: 'high' }],
    });
    expect(screen.getByText('#123')).toBeInTheDocument();
    expect(screen.getByText('Sin señal')).toBeInTheDocument();
  });

  it('sin tickets abiertos muestra "Sin tickets abiertos"', () => {
    renderSection(BASE);
    expect(screen.getByText(/sin tickets abiertos/i)).toBeInTheDocument();
  });

  it('recentTasks se listan con #seq + título', () => {
    renderSection({
      ...BASE,
      recentTasks: [{ id: 'task1', sequenceNumber: 55, title: 'Instalación', status: 'pending' }],
    });
    expect(screen.getByText('#55')).toBeInTheDocument();
    expect(screen.getByText('Instalación')).toBeInTheDocument();
  });

  it('sin tareas recientes muestra "Sin actividad reciente"', () => {
    renderSection(BASE);
    expect(screen.getAllByText(/sin actividad reciente/i).length).toBeGreaterThan(0);
  });

  it('recentLogs se listan con fecha formateada + eventType + descripción', () => {
    renderSection({
      ...BASE,
      recentLogs: [{ id: 'l1', timestamp: '2026-07-10T12:00:00.000Z', eventType: 'llamada', description: 'Reclamo por corte' }],
    });
    expect(screen.getByText('llamada')).toBeInTheDocument();
    expect(screen.getByText('Reclamo por corte')).toBeInTheDocument();
  });

  it('bug BAJO (review adversarial): recentTickets/recentTasks/recentLogs undefined (BE degradado) NO rompen — guards defensivos, caen a los empty states', () => {
    renderSection({
      ...BASE,
      recentTickets: undefined as unknown as WhatsappInboxClientSummary['recentTickets'],
      recentTasks: undefined as unknown as WhatsappInboxClientSummary['recentTasks'],
      recentLogs: undefined as unknown as WhatsappInboxClientSummary['recentLogs'],
    });
    expect(screen.getByText(/sin tickets abiertos/i)).toBeInTheDocument();
    expect(screen.getAllByText(/sin actividad reciente/i).length).toBeGreaterThan(0);
  });
});
