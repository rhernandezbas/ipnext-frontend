/**
 * ChatwootSendPathCard tests — flag `messaging-send-via-chatwoot`
 * (chatwoot-hub-sendpath, eje central). Espejo EXACTO de
 * FiberAutoProvisionCard.test.tsx / RadiusAutoCureCard.test.tsx: mismo CSS
 * module por composición, mismos hooks, mismo manejo de error de fetch
 * ("Estado desconocido" + reintentar), TANTO el ON como el OFF piden
 * confirmación (useConfirm, tone danger).
 *
 * El flag cambia el camino de salida de los templates (hilo + envíos
 * masivos): ACTIVO → vía Chatwoot (registrado en la conversación); INACTIVO →
 * directo por Twilio (sin registrar en Chatwoot).
 *
 * Covers:
 *  1. Loading state
 *  2. Badge de estado ON/OFF
 *  3. Título + descripción honesta del impacto (Chatwoot registra vs directo
 *     por Twilio sin registrar) + aviso de dependencia (sync de templates)
 *  4. Toggle ON → confirm (tone danger, menciona el sync de templates) →
 *     mutate({ enabled: true })
 *  5. Toggle ON cancelado → NO mutate
 *  6. Toggle OFF → confirm (tone danger, menciona que no queda registrado) →
 *     mutate({ enabled: false })
 *  7. Toggle OFF cancelado → NO mutate
 *  8. Gate admin.flags
 *  9. Error states (flag fetch / setFlag) — incluye "Estado desconocido" +
 *     reintentar
 * 10. Feedback de éxito (role="status", aria-live="polite") tras un toggle
 *     confirmado
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
import { ChatwootSendPathCard } from '@/components/settings/ChatwootSendPathCard';

function setupHooks({
  flagEnabled = false,
  flagLoading = false,
  flagError = false,
  setFlagPending = false,
  setFlagError = false,
  setFlagSuccess = false,
  permissions = ['admin.flags'],
  confirmResult = true,
}: {
  flagEnabled?: boolean;
  flagLoading?: boolean;
  flagError?: boolean;
  setFlagPending?: boolean;
  setFlagError?: boolean;
  setFlagSuccess?: boolean;
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
        : { key: 'messaging-send-via-chatwoot', enabled: flagEnabled },
    isLoading: flagLoading,
    isError: flagError,
    refetch: refetchFn,
  } as unknown as ReturnType<typeof useFeatureFlag>);

  vi.mocked(useSetFeatureFlag).mockReturnValue({
    mutate: mutateFn,
    isPending: setFlagPending,
    isError: setFlagError,
    isSuccess: setFlagSuccess,
  } as unknown as ReturnType<typeof useSetFeatureFlag>);

  vi.mocked(useConfirm).mockReturnValue(confirmFn);

  return { mutateFn, confirmFn, refetchFn };
}

describe('ChatwootSendPathCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Loading ────────────────────────────────────────────────────────────────

  it('renders loading state while flag is loading', () => {
    setupHooks({ flagLoading: true });
    render(<ChatwootSendPathCard />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  // ── Title / status ────────────────────────────────────────────────────────

  it('renders card title', () => {
    setupHooks();
    render(<ChatwootSendPathCard />);
    expect(
      screen.getByRole('heading', { name: /envío vía chatwoot \(eje central\)/i }),
    ).toBeInTheDocument();
  });

  it('renders "Inactivo" badge when flag is OFF', () => {
    setupHooks({ flagEnabled: false });
    render(<ChatwootSendPathCard />);
    expect(screen.getByText(/inactivo/i)).toBeInTheDocument();
    expect(screen.queryByText(/^activo$/i)).not.toBeInTheDocument();
  });

  it('renders "Activo" badge when flag is ON', () => {
    setupHooks({ flagEnabled: true });
    render(<ChatwootSendPathCard />);
    expect(screen.getByText(/^activo$/i)).toBeInTheDocument();
    expect(screen.queryByText(/inactivo/i)).not.toBeInTheDocument();
  });

  it('renders an honest description: Chatwoot registra vs directo por Twilio sin registrar', () => {
    setupHooks();
    render(<ChatwootSendPathCard />);
    expect(screen.getByText(/chatwoot registra el mensaje/i)).toBeInTheDocument();
    expect(screen.getByText(/directo por twilio/i)).toBeInTheDocument();
    expect(screen.getByText(/no queda registrado en chatwoot/i)).toBeInTheDocument();
  });

  it('renders the Chatwoot template sync dependency notice', () => {
    setupHooks();
    render(<ChatwootSendPathCard />);
    expect(screen.getByText(/sync de templates de chatwoot activo/i)).toBeInTheDocument();
  });

  // ── Toggle ON ──────────────────────────────────────────────────────────────

  it('turning ON asks for confirmation with danger tone mentioning the template sync dependency', async () => {
    const { mutateFn, confirmFn } = setupHooks({ flagEnabled: false, confirmResult: true });
    render(<ChatwootSendPathCard />);

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(mutateFn).toHaveBeenCalledWith({ key: 'messaging-send-via-chatwoot', enabled: true });
    });
    expect(confirmFn).toHaveBeenCalledTimes(1);
    expect(confirmFn).toHaveBeenCalledWith(
      expect.objectContaining({
        tone: 'danger',
        message: expect.stringMatching(/sync de templates de chatwoot/i),
      }),
    );
  });

  it('turning ON does NOT mutate when the confirmation is cancelled', async () => {
    const { mutateFn, confirmFn } = setupHooks({ flagEnabled: false, confirmResult: false });
    render(<ChatwootSendPathCard />);

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => expect(confirmFn).toHaveBeenCalledTimes(1));
    expect(mutateFn).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  // ── Toggle OFF ─────────────────────────────────────────────────────────────

  it('turning OFF also asks for confirmation, mentioning it stops being registered in Chatwoot', async () => {
    const { mutateFn, confirmFn } = setupHooks({ flagEnabled: true, confirmResult: true });
    render(<ChatwootSendPathCard />);

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(mutateFn).toHaveBeenCalledWith({ key: 'messaging-send-via-chatwoot', enabled: false });
    });
    expect(confirmFn).toHaveBeenCalledTimes(1);
    expect(confirmFn).toHaveBeenCalledWith(
      expect.objectContaining({
        tone: 'danger',
        message: expect.stringMatching(/no va a quedar registrado/i),
      }),
    );
  });

  it('turning OFF does NOT mutate when the confirmation is cancelled', async () => {
    const { mutateFn, confirmFn } = setupHooks({ flagEnabled: true, confirmResult: false });
    render(<ChatwootSendPathCard />);

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => expect(confirmFn).toHaveBeenCalledTimes(1));
    expect(mutateFn).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('toggle is disabled while mutation is pending', () => {
    setupHooks({ flagEnabled: false, setFlagPending: true });
    render(<ChatwootSendPathCard />);
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });

  // ── Permission gate ────────────────────────────────────────────────────────

  it('toggle is NOT rendered when user lacks admin.flags', () => {
    setupHooks({ permissions: [] });
    render(<ChatwootSendPathCard />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  // ── Success feedback ───────────────────────────────────────────────────────

  it('renders success feedback (aria-live) after a confirmed toggle', () => {
    setupHooks({ flagEnabled: true, setFlagSuccess: true });
    render(<ChatwootSendPathCard />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent(/envío vía chatwoot activado/i);
  });

  it('does NOT render success feedback before any mutation', () => {
    setupHooks();
    render(<ChatwootSendPathCard />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  // ── Error states ───────────────────────────────────────────────────────────

  it('renders error banner when setFlag fails', () => {
    setupHooks({ setFlagError: true });
    render(<ChatwootSendPathCard />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/no se pudo cambiar/i)).toBeInTheDocument();
  });

  it('flag-fetch error shows "Estado desconocido", never a confident "Inactivo"', () => {
    setupHooks({ flagError: true });
    render(<ChatwootSendPathCard />);
    expect(screen.getByText(/estado desconocido/i)).toBeInTheDocument();
    expect(screen.queryByText(/inactivo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^activo$/i)).not.toBeInTheDocument();
  });

  it('flag-fetch error offers a retry button that refetches the flag', () => {
    const { refetchFn } = setupHooks({ flagError: true });
    render(<ChatwootSendPathCard />);
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(refetchFn).toHaveBeenCalledTimes(1);
  });

  it('flag-fetch error does NOT render the switch even WITH admin.flags', () => {
    setupHooks({ flagError: true, permissions: ['admin.flags'] });
    render(<ChatwootSendPathCard />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
