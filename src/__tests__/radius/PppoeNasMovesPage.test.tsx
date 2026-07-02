/**
 * Tests — pppoe-move-nas Wave 1 FE: tab "Movimientos NAS" (REQ-LOG-1, lado FE).
 *
 * Tabla paginada del registro PppoeNasMoveEvent: fecha AR canónica, badges por
 * familia de outcome (moved=verde · failed_*=rojo · skipped_*=warning), filtros
 * outcome/trigger/username con round-trip en la URL (namespace mv_*, preservando
 * los namespaces vecinos), paginado con el componente compartido y estados
 * loading/empty/error.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { PaginatedPppoeNasMoveEvents, PppoeNasMoveEvent } from '@/types/pppoeNasMove';

vi.mock('@/hooks/usePppoeNasMoveEvents');

import { usePppoeNasMoveEvents } from '@/hooks/usePppoeNasMoveEvents';
import PppoeNasMovesPage from '@/pages/radius/PppoeNasMovesPage';

// ── fixtures ──────────────────────────────────────────────────────────────────
const EVENTS: PppoeNasMoveEvent[] = [
  {
    id: 'mv-1',
    username: 'cliente01',
    fromNas: { id: 'nas-1', name: 'NAS Central' },
    toNas: { id: 'nas-2', name: 'NAS Norte' },
    fromIp: '100.64.60.25',
    toIp: '100.64.43.7',
    trigger: 'manual',
    outcome: 'moved',
    reason: null,
    actorName: 'operador1',
    createdAt: '2026-07-01T15:30:00Z', // 12:30 ART
  },
  {
    id: 'mv-2',
    username: 'cliente02',
    fromNas: { id: 'nas-1', name: 'NAS Central' },
    toNas: { id: 'nas-3', name: 'NAS Sur' },
    fromIp: '100.64.60.30',
    toIp: null,
    trigger: 'auto',
    outcome: 'failed_no_free_ip',
    reason: 'pool destino lleno',
    actorName: null,
    createdAt: '2026-07-01T16:00:00Z',
  },
  {
    id: 'mv-3',
    username: 'corporativo01',
    fromNas: null,
    toNas: null,
    fromIp: '190.15.242.10',
    toIp: null,
    trigger: 'auto',
    outcome: 'skipped_public',
    reason: 'ip pública',
    actorName: null,
    createdAt: '2026-07-01T16:05:00Z',
  },
];

function makePage(overrides: Partial<PaginatedPppoeNasMoveEvents> = {}): PaginatedPppoeNasMoveEvents {
  return { items: EVENTS, total: EVENTS.length, page: 1, limit: 50, ...overrides };
}

type HookResult = ReturnType<typeof usePppoeNasMoveEvents>;

function mockHook(
  data: PaginatedPppoeNasMoveEvents | undefined,
  opts: { isLoading?: boolean; isError?: boolean } = {},
) {
  vi.mocked(usePppoeNasMoveEvents).mockReturnValue({
    data,
    isLoading: opts.isLoading ?? false,
    isError: opts.isError ?? false,
    isFetching: false,
  } as unknown as HookResult);
}

/** Sonda de la URL: expone el query string actual para asertar el round-trip. */
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
}

function renderPage(initialEntry = '/admin/networking/audit') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <PppoeNasMovesPage />
      <LocationProbe />
    </MemoryRouter>,
  );
}

function lastHookParams() {
  const calls = vi.mocked(usePppoeNasMoveEvents).mock.calls;
  return calls[calls.length - 1][0];
}

beforeEach(() => {
  vi.clearAllMocks();
  mockHook(makePage());
});

// ─────────────────────────────────────────────────────────────────────────────
// Render de la tabla
// ─────────────────────────────────────────────────────────────────────────────
describe('PppoeNasMovesPage — tabla', () => {
  it('muestra el título "Movimientos NAS"', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /movimientos nas/i })).toBeInTheDocument();
  });

  it('muestra username, NAS origen y NAS destino de cada fila', () => {
    renderPage();
    expect(screen.getByText('cliente01')).toBeInTheDocument();
    const row = screen.getByText('cliente01').closest('tr') as HTMLElement;
    expect(within(row).getByText('NAS Central')).toBeInTheDocument();
    expect(within(row).getByText('NAS Norte')).toBeInTheDocument();
  });

  it('muestra "—" cuando fromNas/toNas son null', () => {
    renderPage();
    const row = screen.getByText('corporativo01').closest('tr') as HTMLElement;
    // fromNas y toNas null → dos guiones (más el de toIp/actor null).
    expect(within(row).getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });

  it('muestra la fecha con el formato canónico AR (formatDateTimeShort)', () => {
    renderPage();
    // 2026-07-01T15:30:00Z = 12:30 ART, independiente del TZ del host.
    expect(screen.getByText('01 jul 2026 - 12:30')).toBeInTheDocument();
  });

  it('muestra la IP vieja y la IP nueva de la fila movida', () => {
    renderPage();
    const row = screen.getByText('cliente01').closest('tr') as HTMLElement;
    expect(within(row).getByText(/100\.64\.60\.25/)).toBeInTheDocument();
    expect(within(row).getByText(/100\.64\.43\.7/)).toBeInTheDocument();
  });

  it('muestra el trigger como Manual/Auto', () => {
    renderPage();
    const rowManual = screen.getByText('cliente01').closest('tr') as HTMLElement;
    expect(within(rowManual).getByText('Manual')).toBeInTheDocument();
    const rowAuto = screen.getByText('cliente02').closest('tr') as HTMLElement;
    expect(within(rowAuto).getByText('Auto')).toBeInTheDocument();
  });

  it('muestra el reason y el actor, con "—" para nulls', () => {
    renderPage();
    const row = screen.getByText('cliente02').closest('tr') as HTMLElement;
    expect(within(row).getByText('pool destino lleno')).toBeInTheDocument();
    const rowMoved = screen.getByText('cliente01').closest('tr') as HTMLElement;
    expect(within(rowMoved).getByText('operador1')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Badges por familia de outcome
// ─────────────────────────────────────────────────────────────────────────────
describe('PppoeNasMovesPage — badges de outcome', () => {
  it('moved → badge de la familia éxito (verde)', () => {
    const { container } = renderPage();
    const badge = container.querySelector('.badgeMoved');
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toBe('Movido');
  });

  it('failed_* → badge de la familia error (rojo)', () => {
    const { container } = renderPage();
    const badge = container.querySelector('.badgeFailed');
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toMatch(/pool sin ips/i);
  });

  it('skipped_* → badge de la familia warning', () => {
    const { container } = renderPage();
    const badge = container.querySelector('.badgeSkipped');
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toMatch(/ip pública/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Filtros — round-trip URL (namespace mv_*)
// ─────────────────────────────────────────────────────────────────────────────
describe('PppoeNasMovesPage — filtros en la URL', () => {
  it('el select de outcome tiene Todos + los 7 outcomes', () => {
    renderPage();
    const select = screen.getByLabelText(/filtrar por resultado/i);
    const options = Array.from(select.querySelectorAll('option')).map(o => o.getAttribute('value'));
    expect(options).toEqual([
      '',
      'moved',
      'failed_no_free_ip',
      'failed_orchestrator',
      'failed_db',
      'failed_router',
      'skipped_public',
      'skipped_unknown_nas',
    ]);
  });

  it('elegir un outcome filtra la query y escribe mv_outcome en la URL', async () => {
    renderPage();
    await userEvent.selectOptions(screen.getByLabelText(/filtrar por resultado/i), 'failed_no_free_ip');

    expect(lastHookParams()).toMatchObject({ outcome: 'failed_no_free_ip' });
    expect(screen.getByTestId('location-search').textContent).toContain('mv_outcome=failed_no_free_ip');
  });

  it('elegir un trigger filtra la query y escribe mv_trigger en la URL', async () => {
    renderPage();
    await userEvent.selectOptions(screen.getByLabelText(/filtrar por trigger/i), 'auto');

    expect(lastHookParams()).toMatchObject({ trigger: 'auto' });
    expect(screen.getByTestId('location-search').textContent).toContain('mv_trigger=auto');
  });

  it('escribir un username filtra la query y escribe mv_username en la URL', async () => {
    renderPage();
    await userEvent.type(screen.getByLabelText(/filtrar por username/i), 'juan');

    expect(lastHookParams()).toMatchObject({ username: 'juan' });
    expect(screen.getByTestId('location-search').textContent).toContain('mv_username=juan');
  });

  it('round-trip: los mv_* de la URL entrante llegan a la query y a los controles', () => {
    renderPage('/admin/networking/audit?mv_outcome=moved&mv_trigger=auto&mv_username=juan&mv_page=2');

    expect(lastHookParams()).toMatchObject({
      outcome: 'moved',
      trigger: 'auto',
      username: 'juan',
      page: 2,
    });
    expect(screen.getByLabelText(/filtrar por resultado/i)).toHaveValue('moved');
    expect(screen.getByLabelText(/filtrar por trigger/i)).toHaveValue('auto');
    expect(screen.getByLabelText(/filtrar por username/i)).toHaveValue('juan');
  });

  it('un mv_outcome inválido en la URL se ignora (no llega a la query)', () => {
    renderPage('/admin/networking/audit?mv_outcome=basura');
    expect(lastHookParams().outcome).toBeUndefined();
  });

  it('preserva los parámetros de los tabs vecinos (namespace ajeno) al filtrar', async () => {
    renderPage('/admin/networking/audit?auth_username=otro');
    await userEvent.selectOptions(screen.getByLabelText(/filtrar por resultado/i), 'moved');

    const search = screen.getByTestId('location-search').textContent ?? '';
    expect(search).toContain('auth_username=otro');
    expect(search).toContain('mv_outcome=moved');
  });

  it('cambiar un filtro resetea la página (borra mv_page)', async () => {
    renderPage('/admin/networking/audit?mv_page=3');
    await userEvent.selectOptions(screen.getByLabelText(/filtrar por resultado/i), 'moved');

    expect(screen.getByTestId('location-search').textContent).not.toContain('mv_page');
    expect(lastHookParams()).toMatchObject({ page: 1 });
  });

  it('mv_page no numérico en la URL cae a página 1 (nunca NaN)', () => {
    renderPage('/admin/networking/audit?mv_page=abc');
    expect(lastHookParams()).toMatchObject({ page: 1 });
  });

  it('mv_page=0 cae a página 1', () => {
    renderPage('/admin/networking/audit?mv_page=0');
    expect(lastHookParams()).toMatchObject({ page: 1 });
  });

  it('mv_page negativo cae a página 1', () => {
    renderPage('/admin/networking/audit?mv_page=-3');
    expect(lastHookParams()).toMatchObject({ page: 1 });
  });

  it('mv_page=2 llega como página 2', () => {
    renderPage('/admin/networking/audit?mv_page=2');
    expect(lastHookParams()).toMatchObject({ page: 2 });
  });

  it('el botón Limpiar borra SOLO los mv_* de la URL', async () => {
    renderPage('/admin/networking/audit?mv_outcome=moved&auth_username=otro');
    await userEvent.click(screen.getByRole('button', { name: /limpiar/i }));

    const search = screen.getByTestId('location-search').textContent ?? '';
    expect(search).not.toContain('mv_outcome');
    expect(search).toContain('auth_username=otro');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Paginado
// ─────────────────────────────────────────────────────────────────────────────
describe('PppoeNasMovesPage — paginado', () => {
  it('con total > limit muestra la paginación y navegar escribe mv_page', async () => {
    mockHook(makePage({ total: 120 }));
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }));

    expect(lastHookParams()).toMatchObject({ page: 2 });
    expect(screen.getByTestId('location-search').textContent).toContain('mv_page=2');
  });

  it('con una sola página no renderiza la paginación', () => {
    mockHook(makePage({ total: 3 }));
    renderPage();
    expect(screen.queryByRole('button', { name: /siguiente/i })).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Estados loading / empty / error
// ─────────────────────────────────────────────────────────────────────────────
describe('PppoeNasMovesPage — estados', () => {
  it('muestra el loading state mientras carga', () => {
    mockHook(undefined, { isLoading: true });
    renderPage();
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('muestra el empty state "Sin movimientos registrados"', () => {
    mockHook(makePage({ items: [], total: 0 }));
    renderPage();
    expect(screen.getByText(/sin movimientos registrados/i)).toBeInTheDocument();
  });

  it('muestra el error state (nunca spinner infinito)', () => {
    mockHook(undefined, { isError: true });
    renderPage();
    expect(screen.getByText(/error al cargar los movimientos/i)).toBeInTheDocument();
    expect(screen.queryByText(/cargando/i)).toBeNull();
  });
});
