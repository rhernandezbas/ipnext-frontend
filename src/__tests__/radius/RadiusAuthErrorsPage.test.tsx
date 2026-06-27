import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import RadiusAuthErrorsPage from '@/pages/radius/RadiusAuthErrorsPage';
import * as useRadiusAuthFailuresModule from '@/hooks/useRadiusAuthFailures';
import type { PaginatedRadiusAuthEvents } from '@/types/networkAudit';

vi.mock('@/hooks/useRadiusAuthFailures');

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

  it('maps reason=other → "Otro / revisar" badge in the table', () => {
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    const { container } = renderPage();
    const tbody = container.querySelector('tbody')!;
    expect(within(tbody).getByText('Otro / revisar')).toBeInTheDocument();
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
    expect(within(tbody).queryByText('Otro / revisar')).toBeNull();
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
    const labels = ['Sesión colgada', 'Usuario no existe', 'Otro / revisar'];
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
    expect(screen.getByRole('button', { name: /sesión colgada/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /usuario no existe/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /otro.*revisar/i })).toBeInTheDocument();
  });

  it('renders chips with countsByReason counts formatted with AR thousands separator', () => {
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    renderPage();
    // 5831 → "5.831", 1234 → "1.234", 789 → "789"
    expect(screen.getByRole('button', { name: /sesión colgada/i }).textContent).toContain('5.831');
    expect(screen.getByRole('button', { name: /usuario no existe/i }).textContent).toContain('1.234');
    expect(screen.getByRole('button', { name: /otro.*revisar/i }).textContent).toContain('789');
  });

  it('"Todos" chip is aria-pressed=true when no reason filter is active', () => {
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    renderPage(); // no reason in URL
    expect(screen.getByRole('button', { name: /todos/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('reason chip is NOT active by default (aria-pressed=false)', () => {
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    renderPage();
    expect(screen.getByRole('button', { name: /sesión colgada/i })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /usuario no existe/i })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /otro.*revisar/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking a reason chip passes that reason to the hook', async () => {
    const user = userEvent.setup();
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    renderPage();
    await user.click(screen.getByRole('button', { name: /sesión colgada/i }));
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
    const chip = screen.getByRole('button', { name: /sesión colgada/i });
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
    expect(screen.getByRole('button', { name: 'Otro / revisar' })).toBeInTheDocument();
  });

  it('chip labels have no emojis (text-only per ui-ux-pro-max)', () => {
    mockHook({ data: MOCK_DATA, isLoading: false, isError: false });
    renderPage();
    const emoji = /\p{Extended_Pictographic}/u;
    ['Todos', 'Sesión colgada', 'Usuario no existe', 'Otro / revisar'].forEach((label) => {
      expect(emoji.test(label)).toBe(false);
    });
  });
});
