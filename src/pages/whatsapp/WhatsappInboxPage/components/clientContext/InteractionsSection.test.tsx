import { render, screen, within } from '@testing-library/react';
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
  recentClosedTickets: [],
  closedTicketsCount: 0,
  recentTasks: [],
  openTasksCount: 0,
  recentClosedTasks: [],
  closedTasksCount: 0,
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

  // ─── Estados ABIERTO/CERRADO (messaging-inbox-v2 F1.5 spec #2) ───────────

  describe('tickets — agrupado Abiertos/Cerrados', () => {
    it('closedTicketsCount===0 NO muestra la subsección "Cerrados" — un cliente sin cerrados se ve como hoy', () => {
      renderSection({
        ...BASE,
        openTicketsCount: 1,
        recentTickets: [{ id: 't1', sequenceNumber: 123, subject: 'Sin señal', status: 'open', priority: 'high' }],
      });
      expect(screen.queryByRole('heading', { name: /^abiertos$/i })).not.toBeInTheDocument();
      expect(screen.queryByText(/cerrados/i)).not.toBeInTheDocument();
      expect(screen.getByText('Sin señal')).toBeInTheDocument();
    });

    it('closedTicketsCount>0 muestra subsección "Abiertos" (heading) + "Cerrados: N" con los ítems muted', () => {
      renderSection({
        ...BASE,
        openTicketsCount: 1,
        recentTickets: [{ id: 't1', sequenceNumber: 123, subject: 'Sin señal', status: 'open', priority: 'high' }],
        recentClosedTickets: [
          { id: 't2', sequenceNumber: 100, subject: 'Reclamo factura', status: 'resolved', priority: 'low' },
        ],
        closedTicketsCount: 1,
      });
      expect(screen.getByRole('heading', { name: /^abiertos$/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /^cerrados: 1$/i })).toBeInTheDocument();
      expect(screen.getByText('Reclamo factura')).toBeInTheDocument();
      expect(screen.getByText('#100')).toBeInTheDocument();
    });

    it('closedTicketsCount > los mostrados agrega "· mostrando N" al contador', () => {
      renderSection({
        ...BASE,
        recentClosedTickets: [
          { id: 't2', sequenceNumber: 100, subject: 'Reclamo factura', status: 'resolved', priority: 'low' },
          { id: 't3', sequenceNumber: 101, subject: 'Consulta plan', status: 'closed', priority: 'low' },
        ],
        closedTicketsCount: 5,
      });
      expect(screen.getByRole('heading', { name: /^cerrados: 5 · mostrando 2$/i })).toBeInTheDocument();
    });

    it('los tickets cerrados usan tratamiento accesible NO-solo-color: ícono ✓ aria-hidden + texto muted', () => {
      renderSection({
        ...BASE,
        recentClosedTickets: [
          { id: 't2', sequenceNumber: 100, subject: 'Reclamo factura', status: 'resolved', priority: 'low' },
        ],
        closedTicketsCount: 1,
      });
      const closedItem = screen.getByText('Reclamo factura').closest('li');
      expect(closedItem).not.toBeNull();
      const icon = closedItem!.querySelector('svg[aria-hidden="true"]');
      expect(icon).toBeInTheDocument();
      expect(closedItem!.className).toMatch(/itemClosed/);
    });

    it('bug BAJO (review adversarial) — paridad a11y: el ticket cerrado lleva label textual "Cerrado", igual que la tarea cerrada (hoy solo tiene el ícono aria-hidden, sin texto por-ítem)', () => {
      renderSection({
        ...BASE,
        recentClosedTickets: [
          { id: 't2', sequenceNumber: 100, subject: 'Reclamo factura', status: 'resolved', priority: 'low' },
        ],
        closedTicketsCount: 1,
      });
      const closedItem = screen.getByText('Reclamo factura').closest('li');
      expect(closedItem).not.toBeNull();
      expect(within(closedItem!).getByText('Cerrado')).toBeInTheDocument();
    });

    it('bug MEDIO (review adversarial): closedTicketsCount=0 con recentClosedTickets NO vacío (desync BE) — la subsección se gatea por el ARRAY, no por el contador, así no se pierden ítems que sí llegaron', () => {
      renderSection({
        ...BASE,
        closedTicketsCount: 0,
        recentClosedTickets: [
          { id: 't2', sequenceNumber: 100, subject: 'Reclamo factura', status: 'resolved', priority: 'low' },
          { id: 't3', sequenceNumber: 101, subject: 'Consulta plan', status: 'closed', priority: 'low' },
        ],
      });
      expect(screen.getByRole('heading', { name: /^cerrados/i })).toBeInTheDocument();
      expect(screen.getByText('Reclamo factura')).toBeInTheDocument();
      expect(screen.getByText('Consulta plan')).toBeInTheDocument();
    });

    it('bug MEDIO (review adversarial): closedTicketsCount=1 con array de 2 (desync BE) — el contador se clampea al máximo(count, shown), nunca miente para abajo', () => {
      renderSection({
        ...BASE,
        closedTicketsCount: 1,
        recentClosedTickets: [
          { id: 't2', sequenceNumber: 100, subject: 'Reclamo factura', status: 'resolved', priority: 'low' },
          { id: 't3', sequenceNumber: 101, subject: 'Consulta plan', status: 'closed', priority: 'low' },
        ],
      });
      expect(screen.getByRole('heading', { name: /^cerrados: 2$/i })).toBeInTheDocument();
    });
  });

  describe('tareas — agrupado Abiertas/Cerradas', () => {
    it('closedTasksCount===0 NO muestra la subsección "Cerradas" — se ve como hoy (sin estado visible)', () => {
      renderSection({
        ...BASE,
        recentTasks: [{ id: 'task1', sequenceNumber: 55, title: 'Instalación', status: 'open' }],
      });
      expect(screen.queryByRole('heading', { name: /^abiertas$/i })).not.toBeInTheDocument();
      expect(screen.queryByText(/cerradas/i)).not.toBeInTheDocument();
      expect(screen.getByText('Instalación')).toBeInTheDocument();
    });

    it('closedTasksCount>0 muestra subsección "Abiertas" (heading) + "Cerradas: N"', () => {
      renderSection({
        ...BASE,
        recentTasks: [{ id: 'task1', sequenceNumber: 55, title: 'Instalación', status: 'open' }],
        recentClosedTasks: [{ id: 'task2', sequenceNumber: 40, title: 'Cambio de router', status: 'closed' }],
        closedTasksCount: 1,
      });
      expect(screen.getByRole('heading', { name: /^abiertas$/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /^cerradas: 1$/i })).toBeInTheDocument();
      expect(screen.getByText('Cambio de router')).toBeInTheDocument();
    });

    it('distingue closed vs dismissed en el label de la tarea cerrada', () => {
      renderSection({
        ...BASE,
        recentClosedTasks: [
          { id: 'task2', sequenceNumber: 40, title: 'Cambio de router', status: 'closed' },
          { id: 'task3', sequenceNumber: 41, title: 'Reclamo duplicado', status: 'dismissed' },
        ],
        closedTasksCount: 2,
      });
      expect(screen.getByText('Cerrada')).toBeInTheDocument();
      expect(screen.getByText('Descartada')).toBeInTheDocument();
    });

    it('bug MEDIO (review adversarial): closedTasksCount=0 con recentClosedTasks NO vacío (desync BE) — la subsección se gatea por el ARRAY, no por el contador', () => {
      renderSection({
        ...BASE,
        closedTasksCount: 0,
        recentClosedTasks: [
          { id: 'task2', sequenceNumber: 40, title: 'Cambio de router', status: 'closed' },
          { id: 'task3', sequenceNumber: 41, title: 'Reclamo duplicado', status: 'dismissed' },
        ],
      });
      expect(screen.getByRole('heading', { name: /^cerradas/i })).toBeInTheDocument();
      expect(screen.getByText('Cambio de router')).toBeInTheDocument();
      expect(screen.getByText('Reclamo duplicado')).toBeInTheDocument();
    });

    it('bug MEDIO (review adversarial): closedTasksCount=1 con array de 2 (desync BE) — el contador se clampea, nunca miente para abajo', () => {
      renderSection({
        ...BASE,
        closedTasksCount: 1,
        recentClosedTasks: [
          { id: 'task2', sequenceNumber: 40, title: 'Cambio de router', status: 'closed' },
          { id: 'task3', sequenceNumber: 41, title: 'Reclamo duplicado', status: 'dismissed' },
        ],
      });
      expect(screen.getByRole('heading', { name: /^cerradas: 2$/i })).toBeInTheDocument();
    });

    it('bug BAJO (guard defensivo): recentClosedTickets/recentClosedTasks undefined (BE degradado) NO rompen — array vacío ⇒ nada que listar ⇒ la subsección NO se muestra aunque el contador (stale) diga otra cosa (gate por ARRAY, ver bug MEDIO arriba)', () => {
      renderSection({
        ...BASE,
        closedTicketsCount: 3,
        closedTasksCount: 2,
        recentClosedTickets: undefined as unknown as WhatsappInboxClientSummary['recentClosedTickets'],
        recentClosedTasks: undefined as unknown as WhatsappInboxClientSummary['recentClosedTasks'],
      });
      expect(screen.queryByText(/cerrados/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/cerradas/i)).not.toBeInTheDocument();
    });
  });

  // ─── openTasksCount — paridad con tickets (bug BAJO: código muerto) ───────

  describe('openTasksCount en el header de Tareas (paridad con openTicketsCount)', () => {
    it('muestra el contador de tareas abiertas, mismo patrón que el bloque de tickets', () => {
      renderSection({ ...BASE, openTasksCount: 4 });
      expect(screen.getByText(/4 tareas abiertas/i)).toBeInTheDocument();
    });

    it('singular: openTasksCount=1 usa "tarea abierta"', () => {
      renderSection({ ...BASE, openTasksCount: 1 });
      expect(screen.getByText(/1 tarea abierta\b/i)).toBeInTheDocument();
    });

    it('openTasksCount undefined (BE degradado) cae a 0, no rompe', () => {
      renderSection({
        ...BASE,
        openTasksCount: undefined as unknown as WhatsappInboxClientSummary['openTasksCount'],
      });
      expect(screen.getByText(/0 tareas abiertas/i)).toBeInTheDocument();
    });
  });
});
