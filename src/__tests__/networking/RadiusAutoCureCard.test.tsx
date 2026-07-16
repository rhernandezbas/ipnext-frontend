/**
 * RadiusAutoCureCard tests — radius-auto-cure flag card (patrón EXACTO de
 * ContractNetworkAutoAssignCard: mismo CSS module, mismos hooks).
 *
 * El flag `radius-auto-cure` prende un watcher que cura sesiones PPPoE colgadas (>5 min sin
 * actividad) cada 5 minutos, dejando un log auditable en Networking → Auditoría / Logs → pestaña
 * "Sesiones curadas". A diferencia de ContractNetworkAutoAssignCard (donde el OFF es directo),
 * acá TANTO el ON como el OFF piden confirmación: prender empieza a curar automáticamente,
 * apagar deja sesiones colgadas sin curar hasta que se haga a mano — ambos son cambios de
 * comportamiento con impacto real sobre sesiones de clientes.
 *
 * Covers:
 *  1. Loading state
 *  2. Badge de estado ON/OFF
 *  3. Título + descripción honesta (colgada >5 min, log auditable, "Sesiones curadas")
 *  4. Toggle ON → confirm (tone danger, menciona cada 5 min / automáticamente) → mutate({ enabled: true })
 *  5. Toggle ON cancelado → NO mutate
 *  6. Toggle OFF → confirm (tone danger, menciona "deja de curar") → mutate({ enabled: false })
 *  7. Toggle OFF cancelado → NO mutate
 *  8. Gate admin.flags
 *  9. Error states (flag fetch / setFlag)
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
import { RadiusAutoCureCard } from '@/components/settings/RadiusAutoCureCard';

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
  const refetchFn = vi.fn();

  vi.mocked(useMyPermissions).mockReturnValue({
    user: null,
    roles: [],
    permissions,
    isLoading: false,
    isError: false,
    can: (p: string | string[], _mode?: string) => {
      const perms = Array.isArray(p) ? p : [p];
      return perms.some((perm) => permissions.includes(perm));
    },
  } as never);

  vi.mocked(useCan).mockImplementation((perm: string) => permissions.includes(perm));

  vi.mocked(useFeatureFlag).mockReturnValue({
    data:
      flagLoading || flagError
        ? undefined
        : { key: 'radius-auto-cure', enabled: flagEnabled },
    isLoading: flagLoading,
    isError: flagError,
    refetch: refetchFn,
  } as unknown as ReturnType<typeof useFeatureFlag>);

  vi.mocked(useSetFeatureFlag).mockReturnValue({
    mutate: mutateFn,
    isPending: setFlagPending,
    isError: setFlagError,
  } as unknown as ReturnType<typeof useSetFeatureFlag>);

  vi.mocked(useConfirm).mockReturnValue(confirmFn);

  return { mutateFn, confirmFn, refetchFn };
}

describe('RadiusAutoCureCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state while flag is loading', () => {
    setupHooks({ flagLoading: true });
    render(<RadiusAutoCureCard />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('renders card title', () => {
    setupHooks();
    render(<RadiusAutoCureCard />);
    expect(
      screen.getByRole('heading', { name: /auto-cure de sesiones radius/i }),
    ).toBeInTheDocument();
  });

  it('renders "Inactivo" badge when flag is OFF', () => {
    setupHooks({ flagEnabled: false });
    render(<RadiusAutoCureCard />);
    expect(screen.getByText(/inactivo/i)).toBeInTheDocument();
    expect(screen.queryByText(/^activo$/i)).not.toBeInTheDocument();
  });

  it('renders "Activo" badge when flag is ON', () => {
    setupHooks({ flagEnabled: true });
    render(<RadiusAutoCureCard />);
    expect(screen.getByText(/^activo$/i)).toBeInTheDocument();
    expect(screen.queryByText(/inactivo/i)).not.toBeInTheDocument();
  });

  it('renders an honest description mentioning hung sessions (>5 min) and the auditable log', () => {
    setupHooks();
    render(<RadiusAutoCureCard />);
    expect(screen.getByText(/colgada/i)).toBeInTheDocument();
    expect(screen.getByText(/5 min/i)).toBeInTheDocument();
    expect(screen.getByText(/sesiones curadas/i)).toBeInTheDocument();
  });

  it('turning ON asks for confirmation with danger tone mentioning it cures automatically every 5 min', async () => {
    const { mutateFn, confirmFn } = setupHooks({ flagEnabled: false, confirmResult: true });
    render(<RadiusAutoCureCard />);

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(mutateFn).toHaveBeenCalledWith({ key: 'radius-auto-cure', enabled: true });
    });
    expect(confirmFn).toHaveBeenCalledTimes(1);
    expect(confirmFn).toHaveBeenCalledWith(
      expect.objectContaining({
        tone: 'danger',
        message: expect.stringMatching(/5 min/i),
      }),
    );
  });

  it('turning ON does NOT mutate when the confirmation is cancelled', async () => {
    const { mutateFn, confirmFn } = setupHooks({ flagEnabled: false, confirmResult: false });
    render(<RadiusAutoCureCard />);

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => expect(confirmFn).toHaveBeenCalledTimes(1));
    expect(mutateFn).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('turning OFF also asks for confirmation, mentioning it stops curing', async () => {
    const { mutateFn, confirmFn } = setupHooks({ flagEnabled: true, confirmResult: true });
    render(<RadiusAutoCureCard />);

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(mutateFn).toHaveBeenCalledWith({ key: 'radius-auto-cure', enabled: false });
    });
    expect(confirmFn).toHaveBeenCalledTimes(1);
    expect(confirmFn).toHaveBeenCalledWith(
      expect.objectContaining({
        tone: 'danger',
        message: expect.stringMatching(/deja de curar/i),
      }),
    );
  });

  it('turning OFF does NOT mutate when the confirmation is cancelled', async () => {
    const { mutateFn, confirmFn } = setupHooks({ flagEnabled: true, confirmResult: false });
    render(<RadiusAutoCureCard />);

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => expect(confirmFn).toHaveBeenCalledTimes(1));
    expect(mutateFn).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('toggle is disabled while mutation is pending', () => {
    setupHooks({ flagEnabled: false, setFlagPending: true });
    render(<RadiusAutoCureCard />);
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });

  it('toggle is NOT rendered when user lacks admin.flags', () => {
    setupHooks({ permissions: [] });
    render(<RadiusAutoCureCard />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('renders error banner when setFlag fails', () => {
    setupHooks({ setFlagError: true });
    render(<RadiusAutoCureCard />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/no se pudo cambiar/i)).toBeInTheDocument();
  });

  it('flag-fetch error shows "Estado desconocido", never a confident "Inactivo"', () => {
    setupHooks({ flagError: true });
    render(<RadiusAutoCureCard />);
    expect(screen.getByText(/estado desconocido/i)).toBeInTheDocument();
    expect(screen.queryByText(/inactivo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^activo$/i)).not.toBeInTheDocument();
  });

  it('flag-fetch error offers a retry button that refetches the flag', () => {
    const { refetchFn } = setupHooks({ flagError: true });
    render(<RadiusAutoCureCard />);
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(refetchFn).toHaveBeenCalledTimes(1);
  });

  it('flag-fetch error does NOT render the switch even WITH admin.flags', () => {
    setupHooks({ flagError: true, permissions: ['admin.flags'] });
    render(<RadiusAutoCureCard />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
