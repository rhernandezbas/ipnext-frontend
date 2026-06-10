import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/hooks/useFeatureFlags', () => ({
  useFeatureFlag: vi.fn(),
  useSetFeatureFlag: vi.fn(),
}));
vi.mock('@/hooks/useMyPermissions', () => ({ useMyPermissions: vi.fn() }));

import { useFeatureFlag, useSetFeatureFlag } from '@/hooks/useFeatureFlags';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { AutomationsBody } from '@/pages/inventory/settings/AutomationsBody';

const RETURNS_FLAG = 'iclass-inventory-returns';
const DEDUCT_FLAG = 'inventory-material-auto-deduct';
const RETURNS_TOGGLE = /devoluciones por retiro/i;
const DEDUCT_TOGGLE = /descuento de materiales/i;

const idleMutation = {
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  reset: vi.fn(),
};

/**
 * Mock both flags simultaneously. Pass `null` to simulate key absence
 * (returns `enabled: false` per AD-3 convention).
 */
function mockFlags(
  returns: boolean | null,
  deduct: boolean | null = returns,
  loading = false,
  error = false,
) {
  vi.mocked(useFeatureFlag).mockImplementation(((key: string) => {
    const enabled = key === DEDUCT_FLAG ? deduct : returns;
    return {
      data: enabled === null ? undefined : { key, enabled },
      isLoading: loading,
      isError: error,
      isSuccess: !loading && !error && enabled !== null,
      refetch: vi.fn(),
    };
  }) as never);
}

function mockPerms(can: (p: string | string[]) => boolean) {
  vi.mocked(useMyPermissions).mockReturnValue({
    user: null,
    roles: [],
    permissions: [],
    isLoading: false,
    isError: false,
    can,
  } as never);
}

function renderBody() {
  return render(
    <MemoryRouter>
      <AutomationsBody />
    </MemoryRouter>,
  );
}

describe('AutomationsBody', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSetFeatureFlag).mockReturnValue(idleMutation as never);
    mockPerms(() => true); // default: all permissions granted
  });

  // ── Loading & error states ───────────────────────────────────────────────

  it('renders loading state while any flag query is loading', () => {
    mockFlags(null, null, true);
    renderBody();
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('renders error state when a flag query errors', () => {
    mockFlags(null, null, false, true);
    renderBody();
    expect(screen.getByText(/no se pudo cargar el estado de las automatizaciones/i)).toBeInTheDocument();
  });

  // ── Badge per flag state ─────────────────────────────────────────────────

  it('renders both cards with Inactivo badges when both flags are disabled', () => {
    mockFlags(false, false);
    renderBody();
    const badges = screen.getAllByText('Inactivo');
    expect(badges).toHaveLength(2);
  });

  it('renders Activo badge for returns flag when enabled', () => {
    mockFlags(true, false);
    renderBody();
    expect(screen.getByText('Activo')).toBeInTheDocument();
    expect(screen.getByText('Inactivo')).toBeInTheDocument();
  });

  it('renders Activo badge for deduct flag when enabled', () => {
    mockFlags(false, true);
    renderBody();
    expect(screen.getByText('Activo')).toBeInTheDocument();
    expect(screen.getByText('Inactivo')).toBeInTheDocument();
  });

  it('renders both Activo badges when both flags are enabled', () => {
    mockFlags(true, true);
    renderBody();
    const badges = screen.getAllByText('Activo');
    expect(badges).toHaveLength(2);
  });

  // ── Description changes with state ──────────────────────────────────────

  it('shows ON description for returns when enabled', () => {
    mockFlags(true, false);
    renderBody();
    expect(screen.getByText(/encola en Devoluciones pendientes/i)).toBeInTheDocument();
  });

  it('shows OFF description for returns when disabled', () => {
    mockFlags(false, false);
    renderBody();
    expect(screen.getByText(/los retiros cierran sin encolar/i)).toBeInTheDocument();
  });

  it('shows ON description for deduct when enabled', () => {
    mockFlags(false, true);
    renderBody();
    expect(screen.getByText(/encola un descuento en Descuentos pendientes/i)).toBeInTheDocument();
  });

  it('shows OFF description for deduct when disabled', () => {
    mockFlags(false, false);
    renderBody();
    expect(screen.getByText(/el consumo de materiales se registra pero no propone/i)).toBeInTheDocument();
  });

  // ── Links ────────────────────────────────────────────────────────────────

  it('renders link to /admin/inventory/returns', () => {
    mockFlags(false, false);
    renderBody();
    const link = screen.getByRole('link', { name: /ver devoluciones pendientes/i });
    expect(link).toHaveAttribute('href', '/admin/inventory/returns');
  });

  it('renders link to /admin/inventory/deductions', () => {
    mockFlags(false, false);
    renderBody();
    const link = screen.getByRole('link', { name: /ver descuentos pendientes/i });
    expect(link).toHaveAttribute('href', '/admin/inventory/deductions');
  });

  // ── Toggle interactions ──────────────────────────────────────────────────

  it('clicking the returns toggle calls mutate with the right key and inverted enabled', () => {
    mockFlags(false, false);
    const mutate = vi.fn();
    vi.mocked(useSetFeatureFlag).mockReturnValue({ ...idleMutation, mutate } as never);

    renderBody();
    fireEvent.click(screen.getByRole('checkbox', { name: RETURNS_TOGGLE }));

    expect(mutate).toHaveBeenCalledWith({ key: RETURNS_FLAG, enabled: true });
  });

  it('clicking the deduct toggle calls mutate with the right key and inverted enabled', () => {
    mockFlags(false, false);
    const mutate = vi.fn();
    vi.mocked(useSetFeatureFlag).mockReturnValue({ ...idleMutation, mutate } as never);

    renderBody();
    fireEvent.click(screen.getByRole('checkbox', { name: DEDUCT_TOGGLE }));

    expect(mutate).toHaveBeenCalledWith({ key: DEDUCT_FLAG, enabled: true });
  });

  it('clicking the returns toggle flips from ON to OFF', () => {
    mockFlags(true, false);
    const mutate = vi.fn();
    vi.mocked(useSetFeatureFlag).mockReturnValue({ ...idleMutation, mutate } as never);

    renderBody();
    fireEvent.click(screen.getByRole('checkbox', { name: RETURNS_TOGGLE }));

    expect(mutate).toHaveBeenCalledWith({ key: RETURNS_FLAG, enabled: false });
  });

  // ── Pending state ────────────────────────────────────────────────────────

  it('disables both toggles while the mutation is pending', () => {
    mockFlags(false, false);
    vi.mocked(useSetFeatureFlag).mockReturnValue({ ...idleMutation, isPending: true } as never);

    renderBody();
    expect(screen.getByRole('checkbox', { name: RETURNS_TOGGLE })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: DEDUCT_TOGGLE })).toBeDisabled();
  });

  // ── Error banner ─────────────────────────────────────────────────────────

  it('shows error banner when the mutation fails', () => {
    mockFlags(false, false);
    vi.mocked(useSetFeatureFlag).mockReturnValue({ ...idleMutation, isError: true } as never);

    renderBody();
    expect(screen.getByText(/no se pudo cambiar el estado de la automatización/i)).toBeInTheDocument();
  });

  // ── Permission gate (admin.flags) ───────────────────────────────────────

  it('hides toggles when user lacks admin.flags permission, but state badges are still visible', () => {
    mockFlags(true, true);
    mockPerms((p) => !(Array.isArray(p) ? p : [p]).includes('admin.flags'));

    renderBody();

    // switches not present
    expect(screen.queryByRole('checkbox', { name: RETURNS_TOGGLE })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: DEDUCT_TOGGLE })).not.toBeInTheDocument();
    // but badges still rendered
    const badges = screen.getAllByText('Activo');
    expect(badges).toHaveLength(2);
  });

  it('shows toggles when user has admin.flags permission', () => {
    mockFlags(false, false);
    mockPerms(() => true);

    renderBody();

    expect(screen.getByRole('checkbox', { name: RETURNS_TOGGLE })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: DEDUCT_TOGGLE })).toBeInTheDocument();
  });

  // ── Shared clarification note ────────────────────────────────────────────

  it('renders the shared clarification note about suggestions vs stock mutations', () => {
    mockFlags(false, false);
    renderBody();
    // The note has a <strong> inside so we match via the container paragraph text
    expect(
      screen.getByText((_, el) => {
        if (!el || el.tagName !== 'P') return false;
        return /encolan sugerencias/i.test(el.textContent ?? '');
      }),
    ).toBeInTheDocument();
  });
});
