/**
 * SuricataTicketList (Fase G, task G.3, spec `suricata-tickets-ui` UI-1).
 *
 *  LST-1 loading   → skeleton (role="status")
 *  LST-2 error     → role="alert" + botón reintentar
 *  LST-3 empty     → sin resultados, con CTA "limpiar filtros" cuando hay filtros activos
 *  LST-4 success   → una fila por ticket, badges (estado/área/bot) + asignado visible
 *  LST-5 filtros   → estado/prioridad/área/bot vía el `Select` propio (combobox), nunca `<select>` nativo
 *  LST-6 navegación → click en una fila navega a /admin/suricata-tickets/:id
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { SuricataAreaDto, SuricataTicketListItemDto } from '@/pages/suricata/api/suricataClient';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/pages/suricata/hooks/useSuricataTickets', () => ({
  useSuricataTickets: vi.fn(),
  useSuricataAreas: vi.fn(),
}));

import { SuricataTicketList } from '@/pages/suricata/SuricataTicketList';
import { useSuricataTickets, useSuricataAreas } from '@/pages/suricata/hooks/useSuricataTickets';

function makeTicket(overrides: Partial<SuricataTicketListItemDto> = {}): SuricataTicketListItemDto {
  return {
    id: 't-1',
    externalId: '18742',
    subject: 'Sin Servicio',
    status: 'Open',
    priority: 'alta',
    areaId: 'area-1',
    areaName: 'Soporte',
    customerName: 'María Gómez',
    customerPhone: '+549232455511',
    botState: 'sin_analizar',
    assigneeId: null,
    assigneeName: null,
    lastMessageAt: '2026-09-12T14:20:00.000Z',
    syncedAt: '2026-09-12T14:22:00.000Z',
    ...overrides,
  };
}

const AREAS: SuricataAreaDto[] = [
  { id: 'area-1', name: 'Soporte', active: true },
  { id: 'area-2', name: 'Facturación', active: true },
];

function mockList(partial: Partial<ReturnType<typeof useSuricataTickets>>) {
  vi.mocked(useSuricataTickets).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...partial,
  } as unknown as ReturnType<typeof useSuricataTickets>);
}

function renderList() {
  return render(
    <MemoryRouter>
      <SuricataTicketList />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useSuricataAreas).mockReturnValue({
    data: AREAS,
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof useSuricataAreas>);
});

describe('LST-1 loading', () => {
  it('shows a skeleton while the list loads', () => {
    mockList({ isLoading: true, data: undefined });
    renderList();
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('LST-2 error', () => {
  it('shows role=alert with a retry that refetches', async () => {
    const refetch = vi.fn();
    mockList({ isError: true, isLoading: false, data: undefined, refetch });
    renderList();

    expect(screen.getByRole('alert')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe('LST-3 empty', () => {
  it('shows an explanatory empty state with no tickets at all', () => {
    mockList({ data: { data: [], total: 0, page: 1, limit: 25 }, isLoading: false, isError: false });
    renderList();
    expect(screen.getByText(/no hay tickets/i)).toBeInTheDocument();
  });

  it('shows a "limpiar filtros" CTA when filters narrow to zero results', async () => {
    mockList({ data: { data: [], total: 0, page: 1, limit: 25 }, isLoading: false, isError: false });
    renderList();

    const areaSelect = screen.getByRole('combobox', { name: /área/i });
    await userEvent.click(areaSelect);
    await userEvent.click(screen.getByRole('option', { name: 'Facturación' }));

    expect(screen.getByRole('button', { name: /limpiar filtros/i })).toBeInTheDocument();
  });
});

describe('LST-4 success', () => {
  it('renders one row per ticket with status/area/bot badges and the assignee', () => {
    mockList({
      data: {
        data: [
          makeTicket({ id: 't-1', subject: 'Sin Servicio', customerName: 'María Gómez', assigneeName: null }),
          makeTicket({
            id: 't-2',
            subject: 'Cortes Intermitentes',
            customerName: 'Carlos Pérez',
            assigneeName: 'Ronald',
            botState: 'resuelto_bot',
            areaName: 'Facturación',
          }),
        ],
        total: 2,
        page: 1,
        limit: 25,
      },
      isLoading: false,
      isError: false,
    });
    renderList();

    const list = screen.getByRole('list', { name: /tickets suricata/i });
    expect(within(list).getByText('María Gómez')).toBeInTheDocument();
    expect(within(list).getByText('Carlos Pérez')).toBeInTheDocument();
    expect(within(list).getByText('Sin Servicio')).toBeInTheDocument();
    expect(within(list).getByText('Cortes Intermitentes')).toBeInTheDocument();
    expect(within(list).getByText(/sin asignar/i)).toBeInTheDocument();
    expect(within(list).getByText(/ronald/i)).toBeInTheDocument();
    expect(within(list).getByText('Soporte')).toBeInTheDocument();
  });

  it('shows a bot-state badge with a visible text label per row', () => {
    mockList({
      data: { data: [makeTicket({ botState: 'requiere_humano' })], total: 1, page: 1, limit: 25 },
      isLoading: false,
      isError: false,
    });
    renderList();
    const list = screen.getByRole('list', { name: /tickets suricata/i });
    expect(within(list).getByText(/necesit[oó] humano|no pudo/i)).toBeInTheDocument();
  });

  // The bot badge carries its per-state COLOR through `.badgeBot[data-bot=...]`
  // in the stylesheet. Carrying only `.badge` (as this list did) left every bot
  // state rendering identically colourless: the CSS was alive, the class that
  // selects it was never emitted. This pins the class the rules hang off, so
  // the colour can never silently detach from the markup again.
  it.each(['sin_analizar', 'resuelto_bot', 'requiere_humano', 'stale'] as const)(
    'gives the %s bot badge the badgeBot class its colour rules select on',
    (botState) => {
      mockList({
        data: { data: [makeTicket({ botState })], total: 1, page: 1, limit: 25 },
        isLoading: false,
        isError: false,
      });
      renderList();

      const list = screen.getByRole('list', { name: /tickets suricata/i });
      const badge = within(list).getByText(new RegExp(`^Bot: `, 'i'));
      expect(badge.className).toContain('badgeBot');
      expect(badge).toHaveAttribute('data-bot', botState);
    },
  );
});

describe('LST-5 filters', () => {
  it('filters are the repo Select (combobox), never a native <select>', () => {
    mockList({ data: { data: [], total: 0, page: 1, limit: 25 }, isLoading: false, isError: false });
    renderList();

    expect(screen.getByRole('combobox', { name: /estado/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /prioridad/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /área/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /bot/i })).toBeInTheDocument();
    expect(document.querySelector('select')).toBeNull();
  });

  it('changing the bot-state filter requests the list with the matching botState param', async () => {
    mockList({ data: { data: [], total: 0, page: 1, limit: 25 }, isLoading: false, isError: false });
    renderList();

    const botSelect = screen.getByRole('combobox', { name: /bot/i });
    await userEvent.click(botSelect);
    await userEvent.click(screen.getByRole('option', { name: /necesit[oó] humano|no pudo/i }));

    expect(useSuricataTickets).toHaveBeenLastCalledWith(
      expect.objectContaining({ botState: 'requiere_humano' }),
    );
  });
});

describe('LST-6 navigation', () => {
  it('clicking a row navigates to the ticket detail route', async () => {
    mockList({
      data: { data: [makeTicket({ id: 'ticket-abc' })], total: 1, page: 1, limit: 25 },
      isLoading: false,
      isError: false,
    });
    renderList();

    await userEvent.click(screen.getByText('Sin Servicio'));
    expect(mockNavigate).toHaveBeenCalledWith('/admin/suricata-tickets/ticket-abc');
  });
});
