/**
 * Tests — radius-session-autocure FE-1: tab "Sesiones curadas" (REQ-FE-CURE-1, S1.1-S1.4).
 *
 * Tabla paginada de RadiusSessionCureEvent: chips countsByOutcome (desglose completo,
 * NO cambia al filtrar), badge por outcome con degradación a texto plano para outcomes
 * desconocidos (lección OutcomeBadge), evidencia (signalUsed + sessionLastUpdate),
 * filtros outcome/trigger/username con round-trip en la URL (namespace cure_), 4 ramas
 * de estado (loading/error/empty/data).
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  RADIUS_SESSION_CURE_OUTCOMES,
  type PaginatedRadiusSessionCureEvents,
  type RadiusSessionCureEvent,
} from '@/types/radiusSessionCure';

vi.mock('@/hooks/useRadiusSessionCures');

import { useRadiusSessionCures } from '@/hooks/useRadiusSessionCures';
import RadiusSessionCuresPage from '@/pages/radius/RadiusSessionCuresPage';

// ── fixtures ──────────────────────────────────────────────────────────────────
const EVENTS: RadiusSessionCureEvent[] = [
  {
    id: 'cure-1',
    username: 'cliente01',
    nasIp: '10.60.0.10',
    sessionId: 'sess-abc',
    sessionStartedAt: '2026-07-16T10:00:00Z',
    sessionLastUpdate: '2026-07-16T10:35:00Z',
    signalUsed: 'persistent_rejects',
    trigger: 'auto',
    action: 'both',
    outcome: 'cured',
    reason: null,
    actorName: 'sistema',
    createdAt: '2026-07-16T11:00:00Z',
  },
  {
    id: 'cure-2',
    username: 'cliente02',
    nasIp: '10.60.0.11',
    sessionId: 'sess-def',
    sessionStartedAt: '2026-07-16T09:00:00Z',
    sessionLastUpdate: '2026-07-16T09:05:00Z',
    signalUsed: 'stale_interim',
    trigger: 'manual',
    action: 'acct_close',
    outcome: 'already_cured',
    reason: 'ya cerrada por el cron',
    actorName: 'operador1',
    createdAt: '2026-07-16T11:05:00Z',
  },
  {
    id: 'cure-3',
    username: 'cliente03',
    nasIp: '10.60.0.12',
    sessionId: null,
    sessionStartedAt: null,
    sessionLastUpdate: null,
    signalUsed: null,
    trigger: 'manual',
    action: null,
    outcome: 'skipped_alive',
    reason: 'sesión activa hace 90s',
    actorName: 'operador2',
    createdAt: '2026-07-16T11:10:00Z',
  },
  {
    id: 'cure-4',
    username: 'cliente04',
    nasIp: null,
    sessionId: null,
    sessionStartedAt: null,
    sessionLastUpdate: null,
    signalUsed: null,
    trigger: 'auto',
    action: null,
    outcome: 'flagged_flapping',
    reason: '3 curas en 24h',
    actorName: 'sistema',
    createdAt: '2026-07-16T11:15:00Z',
  },
];

function makePage(overrides: Partial<PaginatedRadiusSessionCureEvents> = {}): PaginatedRadiusSessionCureEvents {
  return {
    data: EVENTS,
    total: EVENTS.length,
    page: 1,
    limit: 50,
    hasNext: false,
    countsByOutcome: {
      cured: 120,
      already_cured: 8,
      skipped_alive: 15,
      skipped_ambiguous: 3,
      skipped_no_session: 40,
      skipped_no_signal: 2,
      flagged_flapping: 1,
      failed: 5,
    },
    ...overrides,
  };
}

type HookResult = ReturnType<typeof useRadiusSessionCures>;

function mockHook(
  data: PaginatedRadiusSessionCureEvents | undefined,
  opts: { isLoading?: boolean; isError?: boolean } = {},
) {
  vi.mocked(useRadiusSessionCures).mockReturnValue({
    data,
    isLoading: opts.isLoading ?? false,
    isError: opts.isError ?? false,
  } as unknown as HookResult);
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
}

function renderPage(initialEntry = '/admin/networking/audit') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <RadiusSessionCuresPage />
      <LocationProbe />
    </MemoryRouter>,
  );
}

function lastHookParams() {
  const calls = vi.mocked(useRadiusSessionCures).mock.calls;
  return calls[calls.length - 1][0];
}

beforeEach(() => {
  vi.clearAllMocks();
  mockHook(makePage());
});

// ─────────────────────────────────────────────────────────────────────────────
// S1.1 — render de la tabla
// ─────────────────────────────────────────────────────────────────────────────
describe('RadiusSessionCuresPage — tabla', () => {
  it('muestra el título "Sesiones curadas"', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /sesiones curadas/i })).toBeInTheDocument();
  });

  it('S1.1: fila cured auto → badge de curada, actor sistema, señal con recencia visible', () => {
    renderPage();
    const row = screen.getByText('cliente01').closest('tr') as HTMLElement;
    expect(within(row).getByText('Curada')).toBeInTheDocument();
    expect(within(row).getByText('sistema')).toBeInTheDocument();
    // evidencia: signalUsed humanizado + señal de recencia (sessionLastUpdate)
    expect(within(row).getByText(/rejects sostenidos/i)).toBeInTheDocument();
  });

  it('muestra NAS y sesión, con "—" cuando son null', () => {
    renderPage();
    const row1 = screen.getByText('cliente01').closest('tr') as HTMLElement;
    expect(within(row1).getByText('10.60.0.10')).toBeInTheDocument();
    expect(within(row1).getByText('sess-abc')).toBeInTheDocument();

    const row4 = screen.getByText('cliente04').closest('tr') as HTMLElement;
    expect(within(row4).getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });

  it('muestra la fecha con el formato canónico AR (formatDateTimeShort)', () => {
    renderPage();
    // 2026-07-16T11:00:00Z = 08:00 ART
    expect(screen.getByText('16 jul 2026 - 08:00')).toBeInTheDocument();
  });

  it('muestra el trigger como Manual/Auto', () => {
    renderPage();
    const rowAuto = screen.getByText('cliente01').closest('tr') as HTMLElement;
    expect(within(rowAuto).getByText('Auto')).toBeInTheDocument();
    const rowManual = screen.getByText('cliente02').closest('tr') as HTMLElement;
    expect(within(rowManual).getByText('Manual')).toBeInTheDocument();
  });

  it('muestra "stale_interim" como "Interim viejo" en la evidencia', () => {
    renderPage();
    const row = screen.getByText('cliente02').closest('tr') as HTMLElement;
    expect(within(row).getByText(/interim viejo/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Chips countsByOutcome (S1.2)
// ─────────────────────────────────────────────────────────────────────────────
describe('RadiusSessionCuresPage — chips de countsByOutcome', () => {
  it('renderiza un chip por outcome con su conteo', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /curada.*120/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ya curada.*8/i })).toBeInTheDocument();
  });

  it('S1.2: clickear un chip filtra la tabla pero los chips siguen mostrando el desglose completo', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /curada.*120/i }));

    expect(lastHookParams()).toMatchObject({ outcome: 'cured' });
    // Los chips (incl. el clickeado) siguen mostrando SU conteo total, no filtrado.
    expect(screen.getByRole('button', { name: /curada.*120/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ya curada.*8/i })).toBeInTheDocument();
  });

  it('clickear el chip activo lo limpia (toggle)', async () => {
    renderPage('/admin/networking/audit?cure_outcome=cured');
    const chip = screen.getByRole('button', { name: /curada.*120/i });
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(chip);
    expect(lastHookParams().outcome).toBeUndefined();
  });

  it('nit review: renderiza exactamente un chip por cada outcome de RADIUS_SESSION_CURE_OUTCOMES (CHIP_ORDER derivado, no duplicado)', () => {
    renderPage();
    const chipBar = screen.getByRole('group', { name: /resultado — chips/i });
    expect(within(chipBar).getAllByRole('button')).toHaveLength(RADIUS_SESSION_CURE_OUTCOMES.length);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Badges por outcome — incluye flagged_flapping destacado y degradación (S1.3)
// ─────────────────────────────────────────────────────────────────────────────
describe('RadiusSessionCuresPage — badges de outcome', () => {
  it('skipped_alive → badge con el label humano', () => {
    renderPage();
    const row = screen.getByText('cliente03').closest('tr') as HTMLElement;
    expect(within(row).getByText('Sesión viva')).toBeInTheDocument();
  });

  it('flagged_flapping → badge con tratamiento visual DESTACADO (clase propia, distinta de failed)', () => {
    renderPage();
    const row = screen.getByText('cliente04').closest('tr') as HTMLElement;
    const badge = within(row).getByText('Flapping');
    expect(badge.className).toMatch(/flapping/i);
  });

  it('S1.3: outcome desconocido del BE → texto plano, sin crash (pin D-W2.5.5)', () => {
    const unknownEvt: RadiusSessionCureEvent = {
      ...EVENTS[0],
      id: 'cure-unknown',
      username: 'clienteFuturo',
      outcome: 'algo_nuevo',
    };
    mockHook(makePage({ data: [unknownEvt], total: 1 }));
    renderPage();

    const row = screen.getByText('clienteFuturo').closest('tr') as HTMLElement;
    const fallback = within(row).getByText('algo_nuevo');
    expect(fallback).toBeInTheDocument();
    expect(fallback.className).not.toMatch(/badge/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Filtros — round-trip URL (namespace cure_)
// ─────────────────────────────────────────────────────────────────────────────
describe('RadiusSessionCuresPage — filtros en la URL', () => {
  it('elegir un outcome del select filtra la query y escribe cure_outcome en la URL', async () => {
    renderPage();
    await userEvent.selectOptions(screen.getByLabelText(/filtrar por resultado/i), 'skipped_alive');

    expect(lastHookParams()).toMatchObject({ outcome: 'skipped_alive' });
    expect(screen.getByTestId('location-search').textContent).toContain('cure_outcome=skipped_alive');
  });

  it('elegir un trigger filtra la query y escribe cure_trigger en la URL', async () => {
    renderPage();
    await userEvent.selectOptions(screen.getByLabelText(/filtrar por trigger/i), 'manual');

    expect(lastHookParams()).toMatchObject({ trigger: 'manual' });
    expect(screen.getByTestId('location-search').textContent).toContain('cure_trigger=manual');
  });

  it('escribir un username filtra la query y escribe cure_username en la URL', async () => {
    renderPage();
    await userEvent.type(screen.getByLabelText(/filtrar por username/i), 'juan');

    expect(lastHookParams()).toMatchObject({ username: 'juan' });
    expect(screen.getByTestId('location-search').textContent).toContain('cure_username=juan');
  });

  it('preserva los parámetros de los tabs vecinos (namespace ajeno) al filtrar', async () => {
    renderPage('/admin/networking/audit?auth_username=otro');
    await userEvent.selectOptions(screen.getByLabelText(/filtrar por resultado/i), 'cured');

    const search = screen.getByTestId('location-search').textContent ?? '';
    expect(search).toContain('auth_username=otro');
    expect(search).toContain('cure_outcome=cured');
  });

  it('un cure_outcome inválido en la URL se ignora (no llega a la query)', () => {
    renderPage('/admin/networking/audit?cure_outcome=basura');
    expect(lastHookParams().outcome).toBeUndefined();
  });

  it('el botón Limpiar borra SOLO los cure_* de la URL', async () => {
    renderPage('/admin/networking/audit?cure_outcome=cured&auth_username=otro');
    await userEvent.click(screen.getByRole('button', { name: /limpiar/i }));

    const search = screen.getByTestId('location-search').textContent ?? '';
    expect(search).not.toContain('cure_outcome');
    expect(search).toContain('auth_username=otro');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Paginado
// ─────────────────────────────────────────────────────────────────────────────
describe('RadiusSessionCuresPage — paginado', () => {
  it('con total > limit muestra la paginación y navegar escribe cure_page', async () => {
    mockHook(makePage({ total: 120 }));
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }));

    expect(lastHookParams()).toMatchObject({ page: 2 });
    expect(screen.getByTestId('location-search').textContent).toContain('cure_page=2');
  });

  it('con una sola página no renderiza la paginación', () => {
    mockHook(makePage({ total: 3 }));
    renderPage();
    expect(screen.queryByRole('button', { name: /siguiente/i })).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Estados — S1 4 ramas (loading / error / empty / data)
// ─────────────────────────────────────────────────────────────────────────────
describe('RadiusSessionCuresPage — estados', () => {
  it('muestra el loading state mientras carga', () => {
    mockHook(undefined, { isLoading: true });
    renderPage();
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('muestra el empty state', () => {
    mockHook(makePage({ data: [], total: 0 }));
    renderPage();
    expect(screen.getByText(/no hay curas registradas/i)).toBeInTheDocument();
  });

  it('muestra el error state (nunca spinner infinito)', () => {
    mockHook(undefined, { isError: true });
    renderPage();
    expect(screen.getByText(/error al cargar/i)).toBeInTheDocument();
    expect(screen.queryByText(/cargando/i)).toBeNull();
  });
});
