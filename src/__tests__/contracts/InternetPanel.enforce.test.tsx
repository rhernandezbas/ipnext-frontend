/**
 * InternetPanel — Corte individual (Reducir / Cortar / Restaurar)
 *
 * Cubre:
 *  CE-1a  enforcedState:'active'  → botones "Reducir" y "Cortar" visibles, "Restaurar" NO
 *  CE-1b  enforcedState:'reduced' → botones "Cortar" y "Restaurar" visibles, "Reducir" NO
 *  CE-1c  enforcedState:'blocked' → solo botón "Restaurar" visible
 *  CE-2   Click en "Cortar" → abre ServiceRemovalReasonModal
 *  CE-3   Confirmar motivo → llama enforce con { id, action:'block', reason }
 *  CE-4   Sin pppoe.cut → los botones de enforce NO se renderizan
 *  CE-5   Error del enforce → muestra banner role="alert"
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { InternetPanel } from '@/pages/customers/tabs/contracts/InternetPanel';
import * as usePppoeModule from '@/hooks/usePppoe';
import * as useNasModule from '@/hooks/useNas';
import * as useMyPermissionsModule from '@/hooks/useMyPermissions';
import * as useContractServicesModule from '@/hooks/useContractServices';
import * as usePlansModule from '@/hooks/usePlans';
import type { PppoeServiceDto } from '@/types/pppoe';
import { mockQuery } from '@/__tests__/_utils/reactQueryMocks';

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock('@/hooks/usePppoe');
vi.mock('@/hooks/useNas');
vi.mock('@/hooks/useMyPermissions');
vi.mock('@/hooks/useContractServices');
vi.mock('@/hooks/usePlans');

/**
 * ServiceRemovalReasonModal mock — back-compat with existing tests.
 * Now also forwards title and confirmLabel so we can assert on them.
 */
vi.mock(
  '@/components/molecules/ServiceRemovalReasonModal/ServiceRemovalReasonModal',
  () => ({
    ServiceRemovalReasonModal: ({
      open,
      serviceName,
      title,
      confirmLabel,
      onConfirm,
      onCancel,
    }: {
      open: boolean;
      serviceName: string;
      title?: string;
      confirmLabel?: string;
      onConfirm: (reason: string) => void;
      onCancel: () => void;
    }) => {
      if (!open) return null;
      return (
        <div role="dialog" aria-label={title ?? serviceName}>
          <textarea data-testid="reason-textarea" placeholder="Motivo" />
          <button
            type="button"
            onClick={() => {
              const el = document.querySelector<HTMLTextAreaElement>('[data-testid="reason-textarea"]');
              onConfirm(el?.value ?? 'motivo-test');
            }}
          >
            {confirmLabel ?? 'Confirmar'}
          </button>
          <button type="button" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      );
    },
  }),
);

// ── Fixtures ──────────────────────────────────────────────────────────────────
const BASE_PPPOE: PppoeServiceDto = {
  id: 'pppoe-1',
  username: 'cliente.test',
  profile: '10M',
  remoteAddress: '10.0.0.9',
  status: 'enabled',
  enforcedState: 'active',
  nasId: 'nas-1',
  contractId: 'contract-1',
  createdAt: '2026-06-01T00:00:00Z',
};

const CONTRACT_SERVICES = [{ id: 'svc-1', name: 'INTERNET', status: 'active' }];

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeQC() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function neutralMutation() {
  return { mutateAsync: vi.fn(), isPending: false } as never;
}

interface SetupOpts {
  enforcedState?: PppoeServiceDto['enforcedState'];
  canCut?: boolean;
  canManage?: boolean;
  enforceAsyncFn?: ReturnType<typeof vi.fn>;
  enforcePending?: boolean;
}

function setup(opts: SetupOpts = {}) {
  const {
    enforcedState = 'active',
    canCut = true,
    canManage = true,
    enforceAsyncFn = vi.fn().mockResolvedValue({}),
    enforcePending = false,
  } = opts;

  vi.mocked(usePlansModule.usePlans).mockReturnValue(mockQuery({
    data: [],
    isLoading: false,
    isError: false,
    isSuccess: true,
  }));

  const pppoe = { ...BASE_PPPOE, enforcedState };

  vi.mocked(usePppoeModule.useContractPppoe).mockReturnValue({
    data: [pppoe],
    isLoading: false,
    isError: false,
    isSuccess: true,
  } as ReturnType<typeof usePppoeModule.useContractPppoe>);

  vi.mocked(usePppoeModule.useUnassignedPppoe).mockReturnValue(mockQuery({
    data: [],
    isLoading: false,
    isError: false,
    isSuccess: true,
  }));

  vi.mocked(usePppoeModule.usePppoeCredentials).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    isSuccess: false,
  } as ReturnType<typeof usePppoeModule.usePppoeCredentials>);

  vi.mocked(usePppoeModule.useCreatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useUpdatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useMovePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useDeactivatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useDeassociatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useAssociatePppoe).mockReturnValue(neutralMutation());

  vi.mocked(usePppoeModule.useEnforcePppoeForContract).mockReturnValue({
    mutateAsync: enforceAsyncFn,
    isPending: enforcePending,
  } as unknown as ReturnType<typeof usePppoeModule.useEnforcePppoeForContract>);
  vi.mocked(usePppoeModule.usePppoeCallerId).mockReturnValue({
    data: undefined, isLoading: false, isError: false, isSuccess: false,
  } as ReturnType<typeof usePppoeModule.usePppoeCallerId>);

  vi.mocked(usePppoeModule.usePinPppoeIp).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useUnpinPppoeIp).mockReturnValue(neutralMutation());

  vi.mocked(useNasModule.useNasServers).mockReturnValue({
    data: [{ id: 'nas-1', name: 'Router Central' }],
  } as ReturnType<typeof useNasModule.useNasServers>);

  vi.mocked(useNasModule.useNextFreeIp).mockReturnValue({
    data: undefined,
    isSuccess: false,
    isError: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useNasModule.useNextFreeIp>);

  vi.mocked(useContractServicesModule.useUpdateContractService).mockReturnValue(
    neutralMutation(),
  );

  vi.mocked(useMyPermissionsModule.useMyPermissions).mockReturnValue({
    can: vi.fn((perm: string | string[]) => {
      const perms = Array.isArray(perm) ? perm : [perm];
      return perms.some((p) => {
        if (p === 'pppoe.cut') return canCut;
        if (p === 'pppoe.manage') return canManage;
        return true;
      });
    }),
    isLoading: false,
    isError: false,
    permissions: [
      ...(canManage ? ['pppoe.manage'] : []),
      ...(canCut ? ['pppoe.cut'] : []),
    ],
    roles: [],
    user: null,
  } as unknown as ReturnType<typeof useMyPermissionsModule.useMyPermissions>);

  return { enforceAsyncFn };
}

function renderPanel() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <InternetPanel
        contractId="contract-1"
        clientId="client-42"
        contractServices={CONTRACT_SERVICES as never}
        onClose={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CE-1a: enforcedState:"active" → Reducir + Cortar, sin Restaurar', () => {
  it('con enforcedState=active muestra "Reducir" y "Cortar", no "Restaurar"', () => {
    setup({ enforcedState: 'active' });
    renderPanel();

    expect(screen.getByRole('button', { name: /^Reducir$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Cortar$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Restaurar$/i })).not.toBeInTheDocument();
  });
});

describe('CE-1b: enforcedState:"reduced" → Cortar + Restaurar, sin Reducir', () => {
  it('con enforcedState=reduced muestra "Cortar" y "Restaurar", no "Reducir"', () => {
    setup({ enforcedState: 'reduced' });
    renderPanel();

    expect(screen.queryByRole('button', { name: /^Reducir$/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Cortar$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Restaurar$/i })).toBeInTheDocument();
  });
});

describe('CE-1c: enforcedState:"blocked" → solo Restaurar', () => {
  it('con enforcedState=blocked muestra solo "Restaurar"', () => {
    setup({ enforcedState: 'blocked' });
    renderPanel();

    expect(screen.queryByRole('button', { name: /^Reducir$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Cortar$/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Restaurar$/i })).toBeInTheDocument();
  });
});

describe('CE-2: click en "Cortar" abre ServiceRemovalReasonModal', () => {
  it('al hacer click en "Cortar" aparece el modal con textarea', async () => {
    const user = userEvent.setup();
    setup({ enforcedState: 'active' });
    renderPanel();

    await user.click(screen.getByRole('button', { name: /^Cortar$/i }));

    expect(screen.getByTestId('reason-textarea')).toBeInTheDocument();
  });
});

describe('CE-3: confirmar motivo llama enforce con { id, action:"block", reason }', () => {
  it('confirmar en el modal llama enforceAsyncFn con action:block y el motivo', async () => {
    const user = userEvent.setup();
    const enforceFn = vi.fn().mockResolvedValue({});
    setup({ enforcedState: 'active', enforceAsyncFn: enforceFn });
    renderPanel();

    // Abre el modal de "Cortar"
    await user.click(screen.getByRole('button', { name: /^Cortar$/i }));

    // El modal mock se abre — el testid uniquely identifies the reason textarea
    await user.type(screen.getByTestId('reason-textarea'), 'Deuda impaga');

    // Confirma — dentro del div que contiene el textarea, el confirm button es el que NO dice "Cancelar"
    const textarea = screen.getByTestId('reason-textarea');
    const modalDiv = textarea.closest('[role="dialog"]') as HTMLElement;
    const confirmBtn = within(modalDiv).getAllByRole('button').find((b) => b.textContent !== 'Cancelar')!;
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(enforceFn).toHaveBeenCalledWith({
        id: 'pppoe-1',
        action: 'block',
        reason: 'Deuda impaga',
      });
    });
  });
});

describe('CE-4: sin pppoe.cut → botones de enforce no se renderizan', () => {
  it('sin permiso pppoe.cut los botones Reducir/Cortar/Restaurar no aparecen', () => {
    setup({ canCut: false });
    renderPanel();

    expect(screen.queryByRole('button', { name: /^Reducir$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Cortar$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Restaurar$/i })).not.toBeInTheDocument();
  });
});

describe('CE-5: error del enforce → banner role="alert"', () => {
  it('cuando enforceAsyncFn rechaza se muestra un banner role="alert"', async () => {
    const user = userEvent.setup();
    const enforceFn = vi.fn().mockRejectedValue(new Error('502'));
    setup({ enforcedState: 'active', enforceAsyncFn: enforceFn });
    renderPanel();

    await user.click(screen.getByRole('button', { name: /^Cortar$/i }));
    await user.type(screen.getByTestId('reason-textarea'), 'Deuda');
    const textarea = screen.getByTestId('reason-textarea');
    const modalDiv = textarea.closest('[role="dialog"]') as HTMLElement;
    const confirmBtn = within(modalDiv).getAllByRole('button').find((b) => b.textContent !== 'Cancelar')!;
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
