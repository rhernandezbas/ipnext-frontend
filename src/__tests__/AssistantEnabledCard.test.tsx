/**
 * AssistantEnabledCard — el kill-switch raíz del asistente (`ai-assistant-enabled`).
 *
 * Hoy este flag SÓLO se puede tocar desde la base: sin esta card el bot es imposible de
 * prender desde la UI.
 *
 * Divergencia deliberada respecto de sus hermanas (NocAlertsHubEnabledCard confirma en ambas
 * direcciones): acá **el ON pregunta y el OFF no**. Prender significa que una IA empieza a
 * escribirle a clientes reales — eso merece una pausa. Apagar es el freno de mano, y un freno
 * de mano que pregunta "¿estás seguro?" es un peor freno de mano.
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
import { AssistantEnabledCard } from '@/components/settings/AssistantEnabledCard';

function setupHooks({
  flagEnabled = false,
  flagLoading = false,
  flagError = false,
  setFlagError = false,
  permissions = ['admin.flags'],
  confirmResult = true,
}: {
  flagEnabled?: boolean;
  flagLoading?: boolean;
  flagError?: boolean;
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
      return perms.some(perm => permissions.includes(perm));
    },
  } as never);

  vi.mocked(useCan).mockImplementation((perm: string) => permissions.includes(perm));

  vi.mocked(useFeatureFlag).mockReturnValue({
    data:
      flagLoading || flagError
        ? undefined
        : { key: 'ai-assistant-enabled', enabled: flagEnabled },
    isLoading: flagLoading,
    isError: flagError,
    refetch: refetchFn,
  } as unknown as ReturnType<typeof useFeatureFlag>);

  vi.mocked(useSetFeatureFlag).mockReturnValue({
    mutate: mutateFn,
    isPending: false,
    isError: setFlagError,
  } as unknown as ReturnType<typeof useSetFeatureFlag>);

  vi.mocked(useConfirm).mockReturnValue(confirmFn);

  return { mutateFn, confirmFn, refetchFn };
}

describe('AssistantEnabledCard — estado', () => {
  beforeEach(() => vi.clearAllMocks());

  it('apagado muestra Inactivo', () => {
    setupHooks({ flagEnabled: false });
    render(<AssistantEnabledCard />);

    expect(screen.getByText('Inactivo')).toBeInTheDocument();
  });

  it('prendido muestra Activo', () => {
    setupHooks({ flagEnabled: true });
    render(<AssistantEnabledCard />);

    expect(screen.getByText('Activo')).toBeInTheDocument();
  });

  it('si NO se pudo leer el flag dice "Estado desconocido", nunca "Inactivo"', () => {
    // Afirmar "Inactivo" a ciegas es peor que no saber: te haría creer que el bot está callado
    // cuando podría estar respondiéndole a clientes.
    setupHooks({ flagError: true });
    render(<AssistantEnabledCard />);

    expect(screen.getByText(/estado desconocido/i)).toBeInTheDocument();
    expect(screen.queryByText('Inactivo')).not.toBeInTheDocument();
  });
});

describe('AssistantEnabledCard — prender PREGUNTA', () => {
  beforeEach(() => vi.clearAllMocks());

  it('prender pide confirmación antes de mutar', async () => {
    const { mutateFn, confirmFn } = setupHooks({ flagEnabled: false });
    render(<AssistantEnabledCard />);

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => expect(confirmFn).toHaveBeenCalled());
    expect(confirmFn.mock.calls[0][0].tone).toBe('danger');
    await waitFor(() =>
      expect(mutateFn).toHaveBeenCalledWith({ key: 'ai-assistant-enabled', enabled: true }),
    );
  });

  it('la confirmación dice que le va a escribir a CLIENTES reales', async () => {
    const { confirmFn } = setupHooks({ flagEnabled: false });
    render(<AssistantEnabledCard />);

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => expect(confirmFn).toHaveBeenCalled());
    expect(confirmFn.mock.calls[0][0].message).toMatch(/cliente/i);
  });

  it('cancelar la confirmación NO prende nada', async () => {
    const { mutateFn, confirmFn } = setupHooks({ flagEnabled: false, confirmResult: false });
    render(<AssistantEnabledCard />);

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => expect(confirmFn).toHaveBeenCalled());
    expect(mutateFn).not.toHaveBeenCalled();
  });
});

describe('AssistantEnabledCard — apagar NO pregunta', () => {
  beforeEach(() => vi.clearAllMocks());

  it('apagar es inmediato: el freno de mano no pide confirmación', async () => {
    const { mutateFn, confirmFn } = setupHooks({ flagEnabled: true });
    render(<AssistantEnabledCard />);

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() =>
      expect(mutateFn).toHaveBeenCalledWith({ key: 'ai-assistant-enabled', enabled: false }),
    );
    expect(confirmFn).not.toHaveBeenCalled();
  });
});

describe('AssistantEnabledCard — permisos y errores', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sin admin.flags no se ofrece el switch', () => {
    setupHooks({ permissions: [] });
    render(<AssistantEnabledCard />);

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('un fallo al cambiar el estado se avisa', () => {
    setupHooks({ setFlagError: true });
    render(<AssistantEnabledCard />);

    expect(screen.getByText(/no se pudo cambiar/i)).toBeInTheDocument();
  });

  it('mientras carga no afirma ningún estado', () => {
    setupHooks({ flagLoading: true });
    render(<AssistantEnabledCard />);

    expect(screen.queryByText('Activo')).not.toBeInTheDocument();
    expect(screen.queryByText('Inactivo')).not.toBeInTheDocument();
  });
});
