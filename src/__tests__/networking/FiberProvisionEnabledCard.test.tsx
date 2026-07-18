/**
 * FiberProvisionEnabledCard tests — flag `fiber-auto-provision` (K2-FE,
 * espejo EXACTO de FiberAutoProvisionCard / RadiusAutoCureCard: mismo CSS
 * module por composición, mismos hooks).
 *
 * OJO — no confundir con FiberAutoProvisionCard: esa es el WATCHER (flag
 * `fiber-auto-provision-watcher`, full-auto). ESTA es el flag base
 * `fiber-auto-provision`, que habilita el BOTÓN manual "Aprovisionar ONU"
 * (wizard con dry-run) en las tareas de instalación de fibra. Requiere los
 * envs SMARTOLT_BASE_URL / SMARTOLT_API_TOKEN en el servidor (si faltan, las
 * llamadas dan 503). TANTO el ON como el OFF piden confirmación.
 *
 * Covers:
 *  1. Loading state
 *  2. Badge de estado ON/OFF
 *  3. Título + descripción honesta (botón "Aprovisionar ONU", manual,
 *     SMARTOLT_BASE_URL, 503)
 *  4. Toggle ON → confirm (tone danger, menciona ONUs reales + SmartOLT) → mutate({ key: 'fiber-auto-provision', enabled: true })
 *  5. Toggle ON cancelado → NO mutate
 *  6. Toggle OFF → confirm (tone danger, menciona el botón) → mutate({ enabled: false })
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
import { FiberProvisionEnabledCard } from '@/components/settings/FiberProvisionEnabledCard';

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
        : { key: 'fiber-auto-provision', enabled: flagEnabled },
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

describe('FiberProvisionEnabledCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state while flag is loading', () => {
    setupHooks({ flagLoading: true });
    render(<FiberProvisionEnabledCard />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('renders card title (motor / botón, NOT watcher)', () => {
    setupHooks();
    render(<FiberProvisionEnabledCard />);
    expect(
      screen.getByRole('heading', { name: /aprovisionamiento de onus \(motor \/ botón\)/i }),
    ).toBeInTheDocument();
    // heading must NOT be the watcher card's heading (they are siblings, easy to confuse)
    expect(screen.queryByRole('heading', { name: /watcher/i })).not.toBeInTheDocument();
  });

  it('renders "Inactivo" badge when flag is OFF', () => {
    setupHooks({ flagEnabled: false });
    render(<FiberProvisionEnabledCard />);
    expect(screen.getByText(/inactivo/i)).toBeInTheDocument();
    expect(screen.queryByText(/^activo$/i)).not.toBeInTheDocument();
  });

  it('renders "Activo" badge when flag is ON', () => {
    setupHooks({ flagEnabled: true });
    render(<FiberProvisionEnabledCard />);
    expect(screen.getByText(/^activo$/i)).toBeInTheDocument();
    expect(screen.queryByText(/inactivo/i)).not.toBeInTheDocument();
  });

  it('renders an honest description: botón "Aprovisionar ONU", manual, SMARTOLT_BASE_URL, 503', () => {
    setupHooks();
    render(<FiberProvisionEnabledCard />);
    expect(screen.getByText(/aprovisionar onu/i)).toBeInTheDocument();
    expect(screen.getByText(/manual/i)).toBeInTheDocument();
    expect(screen.getByText(/SMARTOLT_BASE_URL/)).toBeInTheDocument();
    expect(screen.getByText(/503/)).toBeInTheDocument();
  });

  it('turning ON asks for confirmation with danger tone mentioning real ONUs + SmartOLT envs', async () => {
    const { mutateFn, confirmFn } = setupHooks({ flagEnabled: false, confirmResult: true });
    render(<FiberProvisionEnabledCard />);

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(mutateFn).toHaveBeenCalledWith({ key: 'fiber-auto-provision', enabled: true });
    });
    expect(confirmFn).toHaveBeenCalledTimes(1);
    expect(confirmFn).toHaveBeenCalledWith(
      expect.objectContaining({
        tone: 'danger',
        message: expect.stringMatching(/onus reales/i),
      }),
    );
    expect(String((confirmFn.mock.calls[0]![0] as { message: string }).message)).toMatch(/smartolt/i);
  });

  it('turning ON does NOT mutate when the confirmation is cancelled', async () => {
    const { mutateFn, confirmFn } = setupHooks({ flagEnabled: false, confirmResult: false });
    render(<FiberProvisionEnabledCard />);

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => expect(confirmFn).toHaveBeenCalledTimes(1));
    expect(mutateFn).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('turning OFF also asks for confirmation, mentioning the button disappears', async () => {
    const { mutateFn, confirmFn } = setupHooks({ flagEnabled: true, confirmResult: true });
    render(<FiberProvisionEnabledCard />);

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(mutateFn).toHaveBeenCalledWith({ key: 'fiber-auto-provision', enabled: false });
    });
    expect(confirmFn).toHaveBeenCalledTimes(1);
    expect(confirmFn).toHaveBeenCalledWith(
      expect.objectContaining({
        tone: 'danger',
        message: expect.stringMatching(/bot[oó]n/i),
      }),
    );
  });

  it('turning OFF does NOT mutate when the confirmation is cancelled', async () => {
    const { mutateFn, confirmFn } = setupHooks({ flagEnabled: true, confirmResult: false });
    render(<FiberProvisionEnabledCard />);

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => expect(confirmFn).toHaveBeenCalledTimes(1));
    expect(mutateFn).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('toggle is disabled while mutation is pending', () => {
    setupHooks({ flagEnabled: false, setFlagPending: true });
    render(<FiberProvisionEnabledCard />);
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });

  it('toggle is NOT rendered when user lacks admin.flags', () => {
    setupHooks({ permissions: [] });
    render(<FiberProvisionEnabledCard />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('renders error banner when setFlag fails', () => {
    setupHooks({ setFlagError: true });
    render(<FiberProvisionEnabledCard />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/no se pudo cambiar/i)).toBeInTheDocument();
  });

  it('flag-fetch error shows "Estado desconocido", never a confident "Inactivo"', () => {
    setupHooks({ flagError: true });
    render(<FiberProvisionEnabledCard />);
    expect(screen.getByText(/estado desconocido/i)).toBeInTheDocument();
    expect(screen.queryByText(/inactivo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^activo$/i)).not.toBeInTheDocument();
  });

  it('flag-fetch error offers a retry button that refetches the flag', () => {
    const { refetchFn } = setupHooks({ flagError: true });
    render(<FiberProvisionEnabledCard />);
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(refetchFn).toHaveBeenCalledTimes(1);
  });

  it('flag-fetch error does NOT render the switch even WITH admin.flags', () => {
    setupHooks({ flagError: true, permissions: ['admin.flags'] });
    render(<FiberProvisionEnabledCard />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
