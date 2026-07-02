/**
 * PppoeAutoMoveCard tests — pppoe-move-nas W2 FE (REQ-AUTO-4, lado FE).
 *
 * Card del flag `pppoe-auto-move` en la config de Gestión de red (patrón EXACTO
 * de RadiusAuthIngestCard) + confirmación al PRENDER: el toggle enciende una
 * automatización que mueve clientes PPPoE REALES, así que ON pide confirm
 * (useConfirm, tone danger) y OFF apaga directo sin fricción.
 *
 * Covers:
 *  1. Loading state
 *  2. Badge de estado ON/OFF desde el hook
 *  3. Título de la card
 *  4. Toggle ON → confirm (tone danger) → mutate({ enabled: true })
 *  5. Toggle ON cancelado → NO mutate
 *  6. Toggle OFF → directo, SIN confirm
 *  7. Gate admin.flags (mismo permiso que las cards vecinas)
 *  8. Error states (flag fetch / setFlag)
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/hooks/useFeatureFlags', () => ({
  useFeatureFlag: vi.fn(),
  useSetFeatureFlag: vi.fn(),
}));
vi.mock('@/hooks/useMyPermissions', () => ({
  useMyPermissions: vi.fn(),
  useCan: vi.fn(),
}));

import { useFeatureFlag, useSetFeatureFlag } from '@/hooks/useFeatureFlags';
import { useMyPermissions, useCan } from '@/hooks/useMyPermissions';
import { useConfirm } from '@/context/ConfirmContext';
import { PppoeAutoMoveCard } from '@/components/settings/PppoeAutoMoveCard';

function setupHooks({
  flagEnabled = false,
  flagLoading = false,
  flagError = false,
  setFlagPending = false,
  setFlagError = false,
  permissions = ['admin.flags'],
  confirmResult = true,
}: {
  flagEnabled?: boolean;
  flagLoading?: boolean;
  flagError?: boolean;
  setFlagPending?: boolean;
  setFlagError?: boolean;
  permissions?: string[];
  confirmResult?: boolean;
} = {}) {
  const mutateFn = vi.fn();
  const confirmFn = vi.fn().mockResolvedValue(confirmResult);

  vi.mocked(useMyPermissions).mockReturnValue({
    user: null,
    roles: [],
    permissions,
    isLoading: false,
    isError: false,
    can: (p: string | string[], _mode?: string) => {
      const perms = Array.isArray(p) ? p : [p];
      return perms.some(perm => permissions.includes(perm));
    },
  } as never);

  vi.mocked(useCan).mockImplementation((perm: string) => permissions.includes(perm));

  vi.mocked(useFeatureFlag).mockReturnValue({
    data: flagLoading ? undefined : { key: 'pppoe-auto-move', enabled: flagEnabled },
    isLoading: flagLoading,
    isError: flagError,
  } as ReturnType<typeof useFeatureFlag>);

  vi.mocked(useSetFeatureFlag).mockReturnValue({
    mutate: mutateFn,
    isPending: setFlagPending,
    isError: setFlagError,
  } as unknown as ReturnType<typeof useSetFeatureFlag>);

  // useConfirm viene mockeado global desde test/setup.ts; acá lo pisamos con
  // una fn controlable por test (clearAllMocks del beforeEach lo limpia).
  vi.mocked(useConfirm).mockReturnValue(confirmFn);

  return { mutateFn, confirmFn };
}

describe('PppoeAutoMoveCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Loading ────────────────────────────────────────────────────────────────

  it('renders loading state while flag is loading', () => {
    setupHooks({ flagLoading: true });
    render(<PppoeAutoMoveCard />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  // ── Flag status ────────────────────────────────────────────────────────────

  it('renders card title', () => {
    setupHooks();
    render(<PppoeAutoMoveCard />);
    expect(
      screen.getByRole('heading', { name: /auto-move de pppoe \(vigilante de nas\)/i }),
    ).toBeInTheDocument();
  });

  it('renders "Inactivo" badge when flag is OFF', () => {
    setupHooks({ flagEnabled: false });
    render(<PppoeAutoMoveCard />);
    expect(screen.getByText(/inactivo/i)).toBeInTheDocument();
    expect(screen.queryByText(/^activo$/i)).not.toBeInTheDocument();
  });

  it('renders "Activo" badge when flag is ON', () => {
    setupHooks({ flagEnabled: true });
    render(<PppoeAutoMoveCard />);
    expect(screen.getByText(/^activo$/i)).toBeInTheDocument();
    expect(screen.queryByText(/inactivo/i)).not.toBeInTheDocument();
  });

  it('renders honest description mentioning Movimientos NAS', () => {
    setupHooks();
    render(<PppoeAutoMoveCard />);
    expect(screen.getByText(/cada 2 minutos detecta clientes pppoe/i)).toBeInTheDocument();
    expect(screen.getByText(/movimientos nas/i)).toBeInTheDocument();
  });

  // ── Toggle ON: confirmación obligatoria ────────────────────────────────────

  it('turning ON asks for confirmation with danger tone before mutating', async () => {
    const { mutateFn, confirmFn } = setupHooks({ flagEnabled: false, confirmResult: true });
    render(<PppoeAutoMoveCard />);

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(mutateFn).toHaveBeenCalledWith({ key: 'pppoe-auto-move', enabled: true });
    });
    expect(confirmFn).toHaveBeenCalledTimes(1);
    expect(confirmFn).toHaveBeenCalledWith(
      expect.objectContaining({
        tone: 'danger',
        message: expect.stringMatching(/clientes/i),
      }),
    );
    expect(mutateFn).toHaveBeenCalledTimes(1);
  });

  it('turning ON does NOT mutate when the confirmation is cancelled', async () => {
    const { mutateFn, confirmFn } = setupHooks({ flagEnabled: false, confirmResult: false });
    render(<PppoeAutoMoveCard />);

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => expect(confirmFn).toHaveBeenCalledTimes(1));
    expect(mutateFn).not.toHaveBeenCalled();
    // el checkbox controlado queda como estaba (OFF)
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  // ── Toggle OFF: directo, sin fricción ──────────────────────────────────────

  it('turning OFF mutates directly WITHOUT confirmation', async () => {
    const { mutateFn, confirmFn } = setupHooks({ flagEnabled: true });
    render(<PppoeAutoMoveCard />);

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(mutateFn).toHaveBeenCalledWith({ key: 'pppoe-auto-move', enabled: false });
    });
    expect(confirmFn).not.toHaveBeenCalled();
  });

  it('toggle is checked when flag is ON and unchecked when OFF', () => {
    setupHooks({ flagEnabled: true });
    const { unmount } = render(<PppoeAutoMoveCard />);
    expect(screen.getByRole('checkbox')).toBeChecked();
    unmount();

    setupHooks({ flagEnabled: false });
    render(<PppoeAutoMoveCard />);
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('toggle is disabled while mutation is pending', () => {
    setupHooks({ flagEnabled: false, setFlagPending: true });
    render(<PppoeAutoMoveCard />);
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });

  // ── Permission gate (mismo permiso que las cards vecinas) ─────────────────

  it('toggle is NOT rendered when user lacks admin.flags', () => {
    setupHooks({ permissions: [] });
    render(<PppoeAutoMoveCard />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('toggle is NOT rendered with unrelated permissions (no admin.flags)', () => {
    setupHooks({ permissions: ['uisp.read', 'network.read', 'pppoe.read'] });
    render(<PppoeAutoMoveCard />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  // ── Error states ───────────────────────────────────────────────────────────

  it('renders error banner when setFlag fails', () => {
    setupHooks({ setFlagError: true });
    render(<PppoeAutoMoveCard />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/no se pudo cambiar/i)).toBeInTheDocument();
  });

  it('does NOT render toggle when there is a flag-fetch error', () => {
    setupHooks({ flagError: true });
    render(<PppoeAutoMoveCard />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
