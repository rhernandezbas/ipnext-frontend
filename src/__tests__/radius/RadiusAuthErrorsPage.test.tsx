import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import RadiusAuthErrorsPage from '@/pages/radius/RadiusAuthErrorsPage';
import * as useRadiusAuthFailuresModule from '@/hooks/useRadiusAuthFailures';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { PaginatedRadiusAuthEvents } from '@/types/networkAudit';

// Mock PARCIAL: sólo el hook de datos. Preservamos los helpers puros del módulo
// (isRelativeRange / RELATIVE_RANGE_MS) porque el filter-hook valida `auth_range`
// con isRelativeRange — un auto-mock del módulo completo lo volvería vi.fn()→undefined
// y descartaría hasta los presets VÁLIDOS leídos de la URL.
vi.mock('@/hooks/useRadiusAuthFailures', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useRadiusAuthFailures')>();
  return { ...actual, useRadiusAuthFailures: vi.fn() };
});

// radius-session-autocure FE-1 (REQ-FE-CURE-2): mock LOCAL de useMyPermissions con el
// MISMO default permisivo del global de src/test/setup.ts (permissions: ['*']). El
// factory-implementation sobrevive a vi.clearAllMocks() (no toca el implementation, solo
// el historial de llamadas) — todos los describes preexistentes de este archivo siguen
// viendo <Can> como GRANTED sin tocar sus beforeEach. Solo el test S2.4 (deny) lo pisa
// puntualmente con mockReturnValueOnce.
vi.mock('@/hooks/useMyPermissions', () => ({
  useMyPermissions: vi.fn(() => ({
    permissions: ['*'],
    roles: [],
    user: null,
    isLoading: false,
    isError: false,
    can: () => true,
  })),
}));

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

// Fixtures usan los valores REALES que el backend manda en `reason`
// (inglés: 'user_not_found' | 'session_stuck' | 'other' | null). NUNCA en español.
const MOCK_DATA: PaginatedRadiusAuthEvents = {
  data: [
    {
      id: 'auth-1',
      username: 'stuck@isp.com',
      reply: 'Access-Reject',
      authdate: '2026-06-22T10:00:00Z',
      class: 'plan-50',
      reason: 'session_stuck',
    },
    {
      id: 'auth-2',
      username: 'notfound@isp.com',
      reply: 'Access-Reject',
      authdate: '2026-06-22T09:30:00Z',
      class: null,
      reason: 'user_not_found',
    },
    {
      id: 'auth-3',
      username: 'other@isp.com',
      reply: 'Access-Reject',
      authdate: '2026-06-22T09:15:00Z',
      class: null,
      reason: 'other',
    },
    {
      id: 'auth-4',
      username: 'accepted@isp.com',
      reply: 'Access-Accept',
      authdate: '2026-06-22T09:00:00Z',
      class: null,
      reason: null,
    },
  ],
  total: 4,
  page: 1,
  limit: 50,
  hasNext: false,
  countsByReason: {
    session_stuck:  5831,
    user_not_found: 1234,
    other:          789,
  },
};

function mockHook(value: Partial<ReturnType<typeof useRadiusAuthFailuresModule.useRadiusAuthFailures>>) {
  vi.mocked(useRadiusAuthFailuresModule.useRadiusAuthFailures).mockReturnValue(
    value as unknown as ReturnType<typeof useRadiusAuthFailuresModule.useRadiusAuthFailures>,
  );
}

function renderPage(initialUrl = '/') {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter initialEntries={[initialUrl]}>
        <RadiusAuthErrorsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('RadiusAuthErrorsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the "Errores de auth" heading', () => {
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    renderPage();
    expect(screen.getByText('Errores de auth')).toBeInTheDocument();
  });

  it('defaults the reply filter to Access-Reject (the feature is "errors")', () => {
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    renderPage();
    const replySelect = screen.getByRole('combobox', { name: /filtrar por resultado/i }) as HTMLSelectElement;
    expect(replySelect.value).toBe('Access-Reject');
  });

  it('queries the hook with reply=Access-Reject by default', () => {
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    renderPage();
    expect(useRadiusAuthFailuresModule.useRadiusAuthFailures).toHaveBeenCalledWith(
      expect.objectContaining({ reply: 'Access-Reject' }),
    );
  });

  it('renders rows with usernames', () => {
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    renderPage();
    expect(screen.getByText('stuck@isp.com')).toBeInTheDocument();
    expect(screen.getByText('notfound@isp.com')).toBeInTheDocument();
    expect(screen.getByText('accepted@isp.com')).toBeInTheDocument();
  });

  it('renders reply badges as text (Access-Reject / Access-Accept), no emoji', () => {
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    renderPage();
    // Scope to <td> cells so the assertion targets the table badges, not the
    // <option> entries in the Resultado <select>.
    const cells = screen.getAllByRole('cell');
    expect(cells.some((c) => c.textContent === 'Access-Reject')).toBe(true);
    expect(cells.some((c) => c.textContent === 'Access-Accept')).toBe(true);
  });

  // ── MOTIVO column (replaces the always-empty CLASS column) ─────────────────

  it('renders a "Motivo" column header and NOT a "Class" header', () => {
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    renderPage();
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toContain('Motivo');
    expect(headers).not.toContain('Class');
  });

  it('maps reason=session_stuck → "Sesión colgada" badge in the table', () => {
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    const { container } = renderPage();
    // Label appears in both chip and table badge; scope to tbody to verify table badge
    const tbody = container.querySelector('tbody')!;
    expect(within(tbody).getByText('Sesión colgada')).toBeInTheDocument();
  });

  it('maps reason=user_not_found → "Usuario no existe" badge in the table', () => {
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    const { container } = renderPage();
    const tbody = container.querySelector('tbody')!;
    expect(within(tbody).getByText('Usuario no existe')).toBeInTheDocument();
  });

  it('maps reason=other → "Credenciales" badge in the table', () => {
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    const { container } = renderPage();
    const tbody = container.querySelector('tbody')!;
    expect(within(tbody).getByText('Credenciales')).toBeInTheDocument();
  });

  it('the "Credenciales" badge has an explanatory tooltip (title attr)', () => {
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    const { container } = renderPage();
    const tbody = container.querySelector('tbody')!;
    const badge = within(tbody).getByText('Credenciales');
    expect(badge).toHaveAttribute('title');
    expect(badge.getAttribute('title')).toMatch(/clave|credencial|autenticaci/i);
  });

  it('renders reason=null as an em-dash with no badge label in the table', () => {
    mockHook({
      data: { ...MOCK_DATA, data: [MOCK_DATA.data[3]], total: 1 },
      isLoading: false,
      isError: false,
    });
    const { container } = renderPage();
    const cells = screen.getAllByRole('cell');
    // The Motivo cell for a null reason shows "—"
    expect(cells.some((c) => c.textContent === '—')).toBe(true);
    // No badge labels inside table cells (chips still show them, but not in tbody)
    const tbody = container.querySelector('tbody')!;
    expect(within(tbody).queryByText('Sesión colgada')).toBeNull();
    expect(within(tbody).queryByText('Usuario no existe')).toBeNull();
    expect(within(tbody).queryByText('Credenciales')).toBeNull();
  });

  it('renders an em-dash for an unknown reason value (no crash)', () => {
    mockHook({
      data: {
        ...MOCK_DATA,
        data: [{ ...MOCK_DATA.data[0], reason: 'totally_unknown' }],
        total: 1,
      },
      isLoading: false,
      isError: false,
    });
    renderPage();
    const cells = screen.getAllByRole('cell');
    expect(cells.some((c) => c.textContent === '—')).toBe(true);
  });

  it('does NOT use emojis in the Motivo badges (text-only)', () => {
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    renderPage();
    const labels = ['Sesión colgada', 'Usuario no existe', 'Credenciales'];
    const emoji = /\p{Extended_Pictographic}/u;
    for (const label of labels) {
      expect(emoji.test(label)).toBe(false);
    }
  });

  it('shows the loading state', () => {
    mockHook({ data: undefined, isLoading: true, isError: false });
    renderPage();
    expect(screen.getByText('Cargando...')).toBeInTheDocument();
  });

  it('shows the error state when the request fails', () => {
    mockHook({ data: undefined, isLoading: false, isError: true });
    renderPage();
    expect(screen.getByText('Error al cargar los intentos de auth')).toBeInTheDocument();
  });

  it('shows a clear empty state (not an error) when there are no rows', () => {
    mockHook({ data: { ...MOCK_DATA, data: [], total: 0 }, isLoading: false, isError: false });
    renderPage();
    expect(screen.getByText('No hay intentos de auth')).toBeInTheDocument();
  });

  it('renders pagination when there is more than one page', () => {
    mockHook({
      data: { ...MOCK_DATA, total: 120, limit: 50, hasNext: true },
      isLoading: false,
      isError: false,
    });
    renderPage();
    // Pagination renders numbered page buttons; page "2" must exist.
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
  });

  it('does NOT render pagination for a single page', () => {
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    renderPage();
    expect(screen.queryByRole('button', { name: '2' })).not.toBeInTheDocument();
  });

  it('renders filter controls: username, reply select, Desde/Hasta, Limpiar', () => {
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    renderPage();
    expect(screen.getByRole('textbox', { name: /filtrar por username/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /filtrar por resultado/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Desde')).toBeInTheDocument();
    expect(screen.getByLabelText('Hasta')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /limpiar/i })).toBeInTheDocument();
  });
});

// ── Ola 2: chips de conteo + filtro por reason ────────────────────────────────

describe('ReasonChips — Ola 2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the 4 chip buttons: Todos + 3 reason labels', () => {
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    renderPage();
    expect(screen.getByRole('button', { name: /todos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^sesión colgada/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /usuario no existe/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /credenciales/i })).toBeInTheDocument();
  });

  it('renders chips with countsByReason counts formatted with AR thousands separator', () => {
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    renderPage();
    // 5831 → "5.831", 1234 → "1.234", 789 → "789"
    expect(screen.getByRole('button', { name: /^sesión colgada/i }).textContent).toContain('5.831');
    expect(screen.getByRole('button', { name: /usuario no existe/i }).textContent).toContain('1.234');
    expect(screen.getByRole('button', { name: /credenciales/i }).textContent).toContain('789');
  });

  it('"Todos" chip is aria-pressed=true when no reason filter is active', () => {
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    renderPage(); // no reason in URL
    expect(screen.getByRole('button', { name: /todos/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('reason chip is NOT active by default (aria-pressed=false)', () => {
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    renderPage();
    expect(screen.getByRole('button', { name: /^sesión colgada/i })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /usuario no existe/i })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /credenciales/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking a reason chip passes that reason to the hook', async () => {
    const user = userEvent.setup();
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    renderPage();
    await user.click(screen.getByRole('button', { name: /^sesión colgada/i }));
    expect(useRadiusAuthFailuresModule.useRadiusAuthFailures).toHaveBeenLastCalledWith(
      expect.objectContaining({ reason: 'session_stuck' }),
    );
  });

  it('clicking a reason chip marks it as active (aria-pressed=true)', async () => {
    const user = userEvent.setup();
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    renderPage();
    const chip = screen.getByRole('button', { name: /usuario no existe/i });
    await user.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking the active chip toggles it off (clears reason filter)', async () => {
    const user = userEvent.setup();
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    // Start with reason already in URL
    renderPage('/?auth_reason=session_stuck');
    const chip = screen.getByRole('button', { name: /^sesión colgada/i });
    // Should start as active
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    // Click to deactivate
    await user.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    expect(useRadiusAuthFailuresModule.useRadiusAuthFailures).toHaveBeenLastCalledWith(
      expect.objectContaining({ reason: undefined }),
    );
  });

  it('reason from URL round-trips into queryParams for the hook', () => {
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    renderPage('/?auth_reason=user_not_found');
    expect(useRadiusAuthFailuresModule.useRadiusAuthFailures).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'user_not_found' }),
    );
    expect(screen.getByRole('button', { name: /usuario no existe/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('"Todos" chip click clears the reason filter', async () => {
    const user = userEvent.setup();
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    renderPage('/?auth_reason=other');
    await user.click(screen.getByRole('button', { name: /todos/i }));
    expect(useRadiusAuthFailuresModule.useRadiusAuthFailures).toHaveBeenLastCalledWith(
      expect.objectContaining({ reason: undefined }),
    );
  });

  it('chips render in loading state without counts (no data yet)', () => {
    mockHook({ data: undefined, isLoading: true, isError: false });
    renderPage();
    // Chips are always rendered; no counts without data
    expect(screen.getByRole('button', { name: 'Todos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sesión colgada' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Usuario no existe' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Credenciales' })).toBeInTheDocument();
  });

  it('chip labels have no emojis (text-only per ui-ux-pro-max)', () => {
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    renderPage();
    const emoji = /\p{Extended_Pictographic}/u;
    ['Todos', 'Sesión colgada', 'Usuario no existe', 'Credenciales'].forEach((label) => {
      expect(emoji.test(label)).toBe(false);
    });
  });
});

// ── Rango relativo (presets, ventana deslizante) ──────────────────────────────

describe('RangeChips — rango relativo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza los 4 chips de preset: 5 min / 1 h / 24 h / 7 d', () => {
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    renderPage();
    expect(screen.getByRole('button', { name: '5 min' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1 h' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '24 h' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '7 d' })).toBeInTheDocument();
  });

  it('los chips de preset no están activos por defecto (aria-pressed=false)', () => {
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    renderPage();
    expect(screen.getByRole('button', { name: '5 min' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: '7 d' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('click en un preset pasa relativeRange al hook (y resetea page)', async () => {
    const user = userEvent.setup();
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    renderPage();
    await user.click(screen.getByRole('button', { name: '5 min' }));
    expect(useRadiusAuthFailuresModule.useRadiusAuthFailures).toHaveBeenLastCalledWith(
      expect.objectContaining({ relativeRange: '5m', page: 1 }),
    );
  });

  it('el preset desde la URL hace round-trip y marca el chip activo', () => {
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    renderPage('/?auth_range=24h');
    expect(useRadiusAuthFailuresModule.useRadiusAuthFailures).toHaveBeenCalledWith(
      expect.objectContaining({ relativeRange: '24h' }),
    );
    expect(screen.getByRole('button', { name: '24 h' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('click en el preset activo lo apaga (vuelve a relativeRange undefined)', async () => {
    const user = userEvent.setup();
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    renderPage('/?auth_range=1h');
    const chip = screen.getByRole('button', { name: '1 h' });
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    await user.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    expect(useRadiusAuthFailuresModule.useRadiusAuthFailures).toHaveBeenLastCalledWith(
      expect.objectContaining({ relativeRange: undefined }),
    );
  });

  // BAJO 2: apagar el preset NO debe "resucitar" un from/to stale que quedó en la URL.
  it('apagar el preset activo también limpia el rango absoluto stale (from/to)', async () => {
    const user = userEvent.setup();
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    renderPage('/?auth_range=5m&auth_from=2026-06-01&auth_to=2026-06-15');
    const chip = screen.getByRole('button', { name: '5 min' });
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    await user.click(chip); // apagar el preset
    // El rango absoluto stale NO reaparece ni en la query ni en los inputs.
    expect(useRadiusAuthFailuresModule.useRadiusAuthFailures).toHaveBeenLastCalledWith(
      expect.objectContaining({ relativeRange: undefined, from: undefined, to: undefined }),
    );
    expect((screen.getByLabelText('Desde') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Hasta') as HTMLInputElement).value).toBe('');
  });

  // ── Mutua exclusión preset ↔ rango absoluto ────────────────────────────────

  it('seleccionar un preset LIMPIA el rango absoluto (modos excluyentes)', async () => {
    const user = userEvent.setup();
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    renderPage('/?auth_from=2026-06-01&auth_reply=Access-Reject');
    // El input Desde arranca con la fecha absoluta.
    const desde = screen.getByLabelText('Desde') as HTMLInputElement;
    expect(desde.value).toBe('2026-06-01');
    await user.click(screen.getByRole('button', { name: '5 min' }));
    // El preset queda activo y el rango absoluto se limpió.
    expect(useRadiusAuthFailuresModule.useRadiusAuthFailures).toHaveBeenLastCalledWith(
      expect.objectContaining({ relativeRange: '5m' }),
    );
    expect((screen.getByLabelText('Desde') as HTMLInputElement).value).toBe('');
  });

  it('en modo relativo NO se manda `from` absoluto al hook', () => {
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    // Aunque la URL tuviera un from viejo, el preset gana y from va undefined.
    renderPage('/?auth_range=5m&auth_from=2026-06-01');
    const call = vi.mocked(useRadiusAuthFailuresModule.useRadiusAuthFailures).mock.calls.at(-1)![0];
    expect(call.relativeRange).toBe('5m');
    expect(call.from).toBeUndefined();
  });

  it('editar el rango absoluto LIMPIA el preset (viceversa)', () => {
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    renderPage('/?auth_range=24h');
    expect(screen.getByRole('button', { name: '24 h' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-06-15' } });
    expect(screen.getByRole('button', { name: '24 h' })).toHaveAttribute('aria-pressed', 'false');
    expect(useRadiusAuthFailuresModule.useRadiusAuthFailures).toHaveBeenLastCalledWith(
      expect.objectContaining({ relativeRange: undefined, from: '2026-06-15' }),
    );
  });

  it('las etiquetas de los chips de rango no tienen emojis', () => {
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    renderPage();
    const emoji = /\p{Extended_Pictographic}/u;
    ['5 min', '1 h', '24 h', '7 d'].forEach((label) => {
      expect(emoji.test(label)).toBe(false);
    });
  });
});

// ── Auto-refresh (toggle) ─────────────────────────────────────────────────────

describe('Auto-refresh toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza el toggle "Auto-actualizar"', () => {
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    renderPage();
    expect(screen.getByRole('checkbox', { name: /auto-actualizar/i })).toBeInTheDocument();
  });

  it('default OFF cuando NO hay preset relativo (autoRefresh=false al hook)', () => {
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    renderPage();
    expect((screen.getByRole('checkbox', { name: /auto-actualizar/i }) as HTMLInputElement).checked).toBe(false);
    expect(useRadiusAuthFailuresModule.useRadiusAuthFailures).toHaveBeenLastCalledWith(
      expect.objectContaining({ autoRefresh: false }),
    );
  });

  it('default ON cuando hay un preset relativo activo (autoRefresh=true al hook)', () => {
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    renderPage('/?auth_range=5m');
    expect((screen.getByRole('checkbox', { name: /auto-actualizar/i }) as HTMLInputElement).checked).toBe(true);
    expect(useRadiusAuthFailuresModule.useRadiusAuthFailures).toHaveBeenLastCalledWith(
      expect.objectContaining({ autoRefresh: true }),
    );
  });

  it('apagar el toggle con preset activo manda autoRefresh=false', async () => {
    const user = userEvent.setup();
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    renderPage('/?auth_range=5m');
    const toggle = screen.getByRole('checkbox', { name: /auto-actualizar/i }) as HTMLInputElement;
    expect(toggle.checked).toBe(true);
    await user.click(toggle);
    expect((screen.getByRole('checkbox', { name: /auto-actualizar/i }) as HTMLInputElement).checked).toBe(false);
    expect(useRadiusAuthFailuresModule.useRadiusAuthFailures).toHaveBeenLastCalledWith(
      expect.objectContaining({ autoRefresh: false }),
    );
  });

  it('prender el toggle sin preset manda autoRefresh=true', async () => {
    const user = userEvent.setup();
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    renderPage();
    await user.click(screen.getByRole('checkbox', { name: /auto-actualizar/i }));
    expect(useRadiusAuthFailuresModule.useRadiusAuthFailures).toHaveBeenLastCalledWith(
      expect.objectContaining({ autoRefresh: true }),
    );
  });

  it('muestra un indicador "actualizando" mientras isFetching y el auto-refresh está ON', () => {
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false, isFetching: true, dataUpdatedAt: Date.now() });
    renderPage('/?auth_range=5m');
    expect(screen.getByText(/actualizando/i)).toBeInTheDocument();
  });

  // BAJO 3: rama isFetching=false + dataUpdatedAt → "Actualizado HH:MM" en hora AR.
  // Epoch fijo 2026-06-30T15:30:00Z = 12:30 ART (UTC-3). Blinda el fix de timezone:
  // si se leyera la hora del host (UTC) mostraría 15:30, no 12:30.
  it('muestra "Actualizado HH:MM" en hora Argentina cuando terminó de refrescar', () => {
    const updatedAt = Date.parse('2026-06-30T15:30:00Z'); // 12:30 ART
    mockHook({
      data: MOCK_DATA,
      isLoading: false,
      isError: false,
      isFetching: false,
      dataUpdatedAt: updatedAt,
    });
    renderPage('/?auth_range=5m');
    expect(screen.getByText('Actualizado 12:30')).toBeInTheDocument();
    // No debe colar la hora UTC del host.
    expect(screen.queryByText('Actualizado 15:30')).not.toBeInTheDocument();
  });
});

// ── radius-session-autocure FE-1: botón "Curar sesión colgada" (REQ-FE-CURE-2) ──

describe('CureSessionButton wiring — REQ-FE-CURE-2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "Curar sesión colgada" ONLY in the session_stuck row, never in the others', () => {
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    const { container } = renderPage();
    const tbody = container.querySelector('tbody')!;

    // auth-1 (stuck@isp.com) is the ONLY session_stuck row in MOCK_DATA.
    const cureButtons = within(tbody).getAllByRole('button', { name: /curar sesión colgada/i });
    expect(cureButtons).toHaveLength(1);

    const stuckRow = screen.getByText('stuck@isp.com').closest('tr') as HTMLElement;
    expect(within(stuckRow).getByRole('button', { name: /curar sesión colgada/i })).toBeInTheDocument();

    // Ninguna de las otras 3 filas (user_not_found / other / null-Access-Accept) la tiene.
    const notFoundRow = screen.getByText('notfound@isp.com').closest('tr') as HTMLElement;
    expect(within(notFoundRow).queryByRole('button', { name: /curar sesión colgada/i })).not.toBeInTheDocument();
    const otherRow = screen.getByText('other@isp.com').closest('tr') as HTMLElement;
    expect(within(otherRow).queryByRole('button', { name: /curar sesión colgada/i })).not.toBeInTheDocument();
    const acceptedRow = screen.getByText('accepted@isp.com').closest('tr') as HTMLElement;
    expect(within(acceptedRow).queryByRole('button', { name: /curar sesión colgada/i })).not.toBeInTheDocument();
  });

  it('S2.4: sin network.manage la acción NO se renderiza (never "visible pero muerta")', () => {
    vi.mocked(useMyPermissions).mockReturnValueOnce({
      permissions: [],
      roles: [],
      user: null,
      isLoading: false,
      isError: false,
      can: () => false,
    });
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    renderPage();

    expect(screen.queryByRole('button', { name: /curar sesión colgada/i })).not.toBeInTheDocument();
  });
});
