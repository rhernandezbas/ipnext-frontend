/**
 * ContractNetworkAutoAssignCard tests — contract-node-ap-auto-assign Fase B FE.
 *
 * Card del flag `contract-network-auto-assign` en la config de Gestión de red (patrón EXACTO de
 * PppoeAutoMoveCard: mismo CSS module, mismos hooks) + confirmación al PRENDER — design §5/§6: el
 * flag habilita una escritura AUTO DURA que PISA asignaciones existentes (incluso manuales,
 * matriz fila 2) cada vez que corre el sync UISP. El OFF es directo, sin fricción (el tick
 * siguiente ya no auto-asigna).
 *
 * Covers:
 *  1. Loading state
 *  2. Badge de estado ON/OFF
 *  3. Título + descripción honesta (auto-asigna por MAC, pisa asignaciones)
 *  4. Toggle ON → confirm (tone danger, menciona "pisa") → mutate({ enabled: true })
 *  5. Toggle ON cancelado → NO mutate
 *  6. Toggle OFF → directo, SIN confirm
 *  7. Gate admin.flags
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
import { ContractNetworkAutoAssignCard } from '@/components/settings/ContractNetworkAutoAssignCard';

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
        : { key: 'contract-network-auto-assign', enabled: flagEnabled },
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

describe('ContractNetworkAutoAssignCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state while flag is loading', () => {
    setupHooks({ flagLoading: true });
    render(<ContractNetworkAutoAssignCard />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('renders card title', () => {
    setupHooks();
    render(<ContractNetworkAutoAssignCard />);
    expect(
      screen.getByRole('heading', { name: /auto-asignación de nodo\/access point/i }),
    ).toBeInTheDocument();
  });

  it('renders "Inactiva" badge when flag is OFF', () => {
    setupHooks({ flagEnabled: false });
    render(<ContractNetworkAutoAssignCard />);
    expect(screen.getByText(/inactiva/i)).toBeInTheDocument();
    expect(screen.queryByText(/^activa$/i)).not.toBeInTheDocument();
  });

  it('renders "Activa" badge when flag is ON', () => {
    setupHooks({ flagEnabled: true });
    render(<ContractNetworkAutoAssignCard />);
    expect(screen.getByText(/^activa$/i)).toBeInTheDocument();
    expect(screen.queryByText(/inactiva/i)).not.toBeInTheDocument();
  });

  it('renders an honest description mentioning MAC-based auto-assign and overwriting', () => {
    setupHooks();
    render(<ContractNetworkAutoAssignCard />);
    expect(screen.getByText(/mac/i)).toBeInTheDocument();
    expect(screen.getByText(/pisa/i)).toBeInTheDocument();
  });

  it('turning ON asks for confirmation with danger tone mentioning it overwrites assignments', async () => {
    const { mutateFn, confirmFn } = setupHooks({ flagEnabled: false, confirmResult: true });
    render(<ContractNetworkAutoAssignCard />);

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(mutateFn).toHaveBeenCalledWith({ key: 'contract-network-auto-assign', enabled: true });
    });
    expect(confirmFn).toHaveBeenCalledTimes(1);
    expect(confirmFn).toHaveBeenCalledWith(
      expect.objectContaining({
        tone: 'danger',
        message: expect.stringMatching(/pisa/i),
      }),
    );
  });

  it('turning ON does NOT mutate when the confirmation is cancelled', async () => {
    const { mutateFn, confirmFn } = setupHooks({ flagEnabled: false, confirmResult: false });
    render(<ContractNetworkAutoAssignCard />);

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => expect(confirmFn).toHaveBeenCalledTimes(1));
    expect(mutateFn).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('turning OFF mutates directly WITHOUT confirmation', async () => {
    const { mutateFn, confirmFn } = setupHooks({ flagEnabled: true });
    render(<ContractNetworkAutoAssignCard />);

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(mutateFn).toHaveBeenCalledWith({ key: 'contract-network-auto-assign', enabled: false });
    });
    expect(confirmFn).not.toHaveBeenCalled();
  });

  it('toggle is disabled while mutation is pending', () => {
    setupHooks({ flagEnabled: false, setFlagPending: true });
    render(<ContractNetworkAutoAssignCard />);
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });

  it('toggle is NOT rendered when user lacks admin.flags', () => {
    setupHooks({ permissions: [] });
    render(<ContractNetworkAutoAssignCard />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('renders error banner when setFlag fails', () => {
    setupHooks({ setFlagError: true });
    render(<ContractNetworkAutoAssignCard />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/no se pudo cambiar/i)).toBeInTheDocument();
  });

  it('flag-fetch error shows "Estado desconocido", never a confident "Inactiva"', () => {
    setupHooks({ flagError: true });
    render(<ContractNetworkAutoAssignCard />);
    expect(screen.getByText(/estado desconocido/i)).toBeInTheDocument();
    expect(screen.queryByText(/inactiva/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^activa$/i)).not.toBeInTheDocument();
  });

  it('flag-fetch error offers a retry button that refetches the flag', () => {
    const { refetchFn } = setupHooks({ flagError: true });
    render(<ContractNetworkAutoAssignCard />);
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(refetchFn).toHaveBeenCalledTimes(1);
  });

  it('flag-fetch error does NOT render the switch even WITH admin.flags', () => {
    setupHooks({ flagError: true, permissions: ['admin.flags'] });
    render(<ContractNetworkAutoAssignCard />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
