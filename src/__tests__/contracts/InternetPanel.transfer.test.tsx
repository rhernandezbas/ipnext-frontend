/**
 * InternetPanel — botón "Transferir a otro cliente" en Ciclo de vida (service-transfer W4)
 *
 * Cubre:
 *  IPT-1  Con PPPoE activo + pppoe.transfer → el botón aparece en la sección Ciclo de vida
 *  IPT-2  Sin pppoe.transfer → el botón NO aparece
 *  IPT-3  Click → abre el TransferServiceModal (variante pppoe) con el PPPoE y el contrato origen
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { InternetPanel } from '@/pages/customers/tabs/contracts/InternetPanel';
import * as usePppoeModule from '@/hooks/usePppoe';
import * as useNasModule from '@/hooks/useNas';
import * as useMyPermissionsModule from '@/hooks/useMyPermissions';
import * as usePlansModule from '@/hooks/usePlans';
import type { PppoeServiceDto } from '@/types/pppoe';
import { mockQuery } from '@/__tests__/_utils/reactQueryMocks';

vi.mock('@/hooks/usePppoe');
vi.mock('@/hooks/useNas');
vi.mock('@/hooks/useMyPermissions');
vi.mock('@/hooks/usePlans');
// Stub del modal de transferencia — internals en TransferServiceModal.test.tsx
vi.mock('@/components/molecules/TransferServiceModal/TransferServiceModal', () => ({
  TransferServiceModal: ({
    variant,
    sourceClientId,
    sourceContractId,
  }: {
    variant: { kind: string; pppoe?: { id: string } };
    sourceClientId: string;
    sourceContractId: string;
  }) => (
    <div
      data-testid="transfer-service-modal"
      data-kind={variant.kind}
      data-pppoe-id={variant.pppoe?.id ?? ''}
      data-source-client={sourceClientId}
      data-source-contract={sourceContractId}
    />
  ),
}));

const ACTIVE_PPPOE: PppoeServiceDto = {
  id: 'pppoe-active',
  username: 'cliente.activo',
  profile: '10M',
  remoteAddress: '10.0.0.9',
  status: 'enabled',
  enforcedState: 'active',
  nasId: 'nas-1',
  contractId: 'contract-1',
  createdAt: '2026-06-01T00:00:00Z',
  ipMode: 'fixed',
  ipTypePreference: 'cgnat',
};

function neutralMutation() {
  return { mutateAsync: vi.fn(), isPending: false } as never;
}

function setup({ canTransfer = true }: { canTransfer?: boolean } = {}) {
  vi.mocked(usePlansModule.usePlans).mockReturnValue(mockQuery({ data: [] }));
  vi.mocked(usePppoeModule.useContractPppoe).mockReturnValue(
    mockQuery({ data: [ACTIVE_PPPOE] }) as never,
  );
  vi.mocked(usePppoeModule.useUnassignedPppoe).mockReturnValue(mockQuery({ data: [] }));
  vi.mocked(usePppoeModule.usePppoeCredentials).mockReturnValue(
    mockQuery({ data: undefined, isSuccess: false }) as never,
  );
  vi.mocked(usePppoeModule.useCreatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useUpdatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useMovePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useDeactivatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useAssociatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useDeassociatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useEnforcePppoeForContract).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.usePppoeCallerId).mockReturnValue(
    mockQuery({ data: undefined, isSuccess: false }) as never,
  );
  vi.mocked(useNasModule.useNasServers).mockReturnValue({
    data: [{ id: 'nas-1', name: 'Router Central' }],
  } as ReturnType<typeof useNasModule.useNasServers>);
  vi.mocked(useNasModule.useNextFreeIp).mockReturnValue(
    mockQuery({ data: undefined, isSuccess: false }) as never,
  );

  vi.mocked(useMyPermissionsModule.useMyPermissions).mockReturnValue({
    can: vi.fn((perm: string | string[]) => {
      const perms = Array.isArray(perm) ? perm : [perm];
      return perms.some((p) => (p === 'pppoe.transfer' ? canTransfer : true));
    }),
    isLoading: false,
    isError: false,
    permissions: [],
    roles: [],
    user: null,
  } as unknown as ReturnType<typeof useMyPermissionsModule.useMyPermissions>);
}

function renderPanel() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <InternetPanel
        contractId="contract-1"
        clientId="client-42"
        customerName="MARTINO AGUSTINA"
        contractServices={[] as never}
        onClose={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('IPT-1: botón visible con pppoe.transfer', () => {
  it('muestra "Transferir a otro cliente" en la sección Ciclo de vida', () => {
    setup();
    renderPanel();
    expect(screen.getByRole('button', { name: /transferir a otro cliente/i })).toBeInTheDocument();
  });
});

describe('IPT-2: gating sin pppoe.transfer', () => {
  it('sin el permiso el botón NO aparece', () => {
    setup({ canTransfer: false });
    renderPanel();
    expect(screen.queryByRole('button', { name: /transferir a otro cliente/i })).not.toBeInTheDocument();
  });
});

describe('IPT-3: click abre el modal de transferencia', () => {
  it('abre TransferServiceModal variante pppoe con el PPPoE activo y el origen', async () => {
    const user = userEvent.setup();
    setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: /transferir a otro cliente/i }));

    const modal = screen.getByTestId('transfer-service-modal');
    expect(modal).toHaveAttribute('data-kind', 'pppoe');
    expect(modal).toHaveAttribute('data-pppoe-id', 'pppoe-active');
    expect(modal).toHaveAttribute('data-source-client', 'client-42');
    expect(modal).toHaveAttribute('data-source-contract', 'contract-1');
  });
});
