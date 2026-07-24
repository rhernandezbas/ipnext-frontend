/**
 * NocAlertsTelegramSendCard tests — flag `noc-alerts-telegram-send` (change
 * `noc-alerts-config`, Fase F FE). Molde EXACTO de RadiusAutoCureCard.test.tsx.
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
import { NocAlertsTelegramSendCard } from '@/components/settings/NocAlertsTelegramSendCard';

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
    can: (p: string | string[]) => {
      const perms = Array.isArray(p) ? p : [p];
      return perms.some((perm) => permissions.includes(perm));
    },
  } as never);

  vi.mocked(useCan).mockImplementation((perm: string) => permissions.includes(perm));

  vi.mocked(useFeatureFlag).mockReturnValue({
    data:
      flagLoading || flagError
        ? undefined
        : { key: 'noc-alerts-telegram-send', enabled: flagEnabled },
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

describe('NocAlertsTelegramSendCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state while flag is loading', () => {
    setupHooks({ flagLoading: true });
    render(<NocAlertsTelegramSendCard />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('renders card title', () => {
    setupHooks();
    render(<NocAlertsTelegramSendCard />);
    expect(screen.getByRole('heading', { name: /env[ií]o de alertas a telegram/i })).toBeInTheDocument();
  });

  it('renders "Inactivo" badge when flag is OFF', () => {
    setupHooks({ flagEnabled: false });
    render(<NocAlertsTelegramSendCard />);
    expect(screen.getByText(/inactivo/i)).toBeInTheDocument();
    expect(screen.queryByText(/^activo$/i)).not.toBeInTheDocument();
  });

  it('renders "Activo" badge when flag is ON', () => {
    setupHooks({ flagEnabled: true });
    render(<NocAlertsTelegramSendCard />);
    expect(screen.getByText(/^activo$/i)).toBeInTheDocument();
    expect(screen.queryByText(/inactivo/i)).not.toBeInTheDocument();
  });

  it('turning ON asks for confirmation mentioning it starts sending to Telegram', async () => {
    const { mutateFn, confirmFn } = setupHooks({ flagEnabled: false, confirmResult: true });
    render(<NocAlertsTelegramSendCard />);

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(mutateFn).toHaveBeenCalledWith({ key: 'noc-alerts-telegram-send', enabled: true });
    });
    expect(confirmFn).toHaveBeenCalledTimes(1);
    expect(confirmFn).toHaveBeenCalledWith(
      expect.objectContaining({
        tone: 'danger',
        message: expect.stringMatching(/telegram/i),
      }),
    );
  });

  it('turning ON does NOT mutate when the confirmation is cancelled', async () => {
    const { mutateFn, confirmFn } = setupHooks({ flagEnabled: false, confirmResult: false });
    render(<NocAlertsTelegramSendCard />);

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => expect(confirmFn).toHaveBeenCalledTimes(1));
    expect(mutateFn).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('turning OFF asks for confirmation mentioning the team stops getting notified', async () => {
    const { mutateFn, confirmFn } = setupHooks({ flagEnabled: true, confirmResult: true });
    render(<NocAlertsTelegramSendCard />);

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(mutateFn).toHaveBeenCalledWith({ key: 'noc-alerts-telegram-send', enabled: false });
    });
    expect(confirmFn).toHaveBeenCalledTimes(1);
    expect(confirmFn).toHaveBeenCalledWith(
      expect.objectContaining({
        tone: 'danger',
        message: expect.stringMatching(/deja de recibir/i),
      }),
    );
  });

  it('turning OFF does NOT mutate when the confirmation is cancelled', async () => {
    const { mutateFn, confirmFn } = setupHooks({ flagEnabled: true, confirmResult: false });
    render(<NocAlertsTelegramSendCard />);

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => expect(confirmFn).toHaveBeenCalledTimes(1));
    expect(mutateFn).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('toggle is disabled while mutation is pending', () => {
    setupHooks({ flagEnabled: false, setFlagPending: true });
    render(<NocAlertsTelegramSendCard />);
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });

  it('toggle is NOT rendered when user lacks admin.flags', () => {
    setupHooks({ permissions: [] });
    render(<NocAlertsTelegramSendCard />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('renders error banner when setFlag fails', () => {
    setupHooks({ setFlagError: true });
    render(<NocAlertsTelegramSendCard />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/no se pudo cambiar/i)).toBeInTheDocument();
  });

  it('flag-fetch error shows "Estado desconocido", never a confident "Inactivo"', () => {
    setupHooks({ flagError: true });
    render(<NocAlertsTelegramSendCard />);
    expect(screen.getByText(/estado desconocido/i)).toBeInTheDocument();
    expect(screen.queryByText(/inactivo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^activo$/i)).not.toBeInTheDocument();
  });

  it('flag-fetch error offers a retry button that refetches the flag', () => {
    const { refetchFn } = setupHooks({ flagError: true });
    render(<NocAlertsTelegramSendCard />);
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(refetchFn).toHaveBeenCalledTimes(1);
  });
});
