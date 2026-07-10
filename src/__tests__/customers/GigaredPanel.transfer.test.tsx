/**
 * GigaredPanel — botón "Transferir a otro cliente" (service-transfer W4)
 *
 * Cubre:
 *  GPT-1  Con tv.transfer y cuenta linkeada → el botón aparece en la vista linked
 *  GPT-2  Sin tv.transfer → el botón NO aparece
 *  GPT-3  Click → abre el TransferServiceModal (variante tv) con el cliente/contrato origen
 *  GPT-4  FIX 4: sourceContractId SNAPSHOTEADO al abrir — no deriva si el owner
 *         efectivo cambia tras las invalidaciones del 207 (el Reintentar debe
 *         re-enviar el MISMO request)
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { GigaredAccount } from '@/types/gigared';
import { mockQuery, mockMutation } from '@/__tests__/_utils/reactQueryMocks';

vi.mock('@/hooks/useGigared', () => ({
  useGigaredCustomerAccount: vi.fn(),
  useGigaredSummary: vi.fn(),
  useGigaredAllAccounts: vi.fn(),
  useLinkCic: vi.fn(),
  useRegisterAccount: vi.fn(),
  useAddTvService: vi.fn(),
  useRemoveTvService: vi.fn(),
  useSetOtt: vi.fn(),
  useCancelTv: vi.fn(),
  useCancelTvStatus: vi.fn(),
  useChangeTvPassword: vi.fn(),
  useTvCredentials: vi.fn(),
}));
vi.mock('@/hooks/useCustomers', () => ({
  useClientContracts: vi.fn(),
}));
vi.mock('@/hooks/useContractServices', () => ({
  useRemoveContractService: vi.fn(),
  useAddContractService: vi.fn(),
}));
vi.mock('@/hooks/useServiceCatalog', () => ({
  useServiceCatalog: vi.fn(),
}));
// Stub del historial TV — internals testeados en su propia suite (patrón GigaredPanel.test.tsx)
vi.mock('@/components/molecules/ActivationHistoryModal/ActivationHistoryModal', () => ({
  ActivationHistoryModal: () => null,
}));
// Stub del modal de transferencia — sus internals se testean en TransferServiceModal.test.tsx
vi.mock('@/components/molecules/TransferServiceModal/TransferServiceModal', () => ({
  TransferServiceModal: ({
    variant,
    sourceClientId,
    sourceContractId,
  }: {
    variant: { kind: string };
    sourceClientId: string;
    sourceContractId: string;
  }) => (
    <div
      data-testid="transfer-service-modal"
      data-kind={variant.kind}
      data-source-client={sourceClientId}
      data-source-contract={sourceContractId}
    />
  ),
}));

import {
  useGigaredCustomerAccount,
  useGigaredSummary,
  useGigaredAllAccounts,
  useLinkCic,
  useRegisterAccount,
  useAddTvService,
  useRemoveTvService,
  useSetOtt,
  useCancelTv,
  useCancelTvStatus,
  useChangeTvPassword,
  useTvCredentials,
} from '@/hooks/useGigared';
import { useClientContracts } from '@/hooks/useCustomers';
import { useRemoveContractService, useAddContractService } from '@/hooks/useContractServices';
import { useServiceCatalog } from '@/hooks/useServiceCatalog';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { GigaredPanel } from '@/pages/customers/tabs/contracts/GigaredPanel';

const linkedAccount: GigaredAccount = {
  cic: '0000000001',
  gigaredId: 'g-1',
  email: 'a@b.com',
  firstName: 'Ana',
  lastName: 'García',
  registrationDate: '2026-01-01T00:00:00Z',
  services: [{ id: 's1', name: 'Gigared Play Full' }],
  internalId: 'cust-1',
  clientId: 'client-abc',
  ott: { id: 'o1', stationaryLicenses: 1, mobileLicenses: 1, registeredDevices: 0, status: 'enabled' },
};

function setup({ canTransfer = true }: { canTransfer?: boolean } = {}) {
  vi.mocked(useGigaredCustomerAccount).mockReturnValue(
    mockQuery({ data: { linked: true, account: linkedAccount } }) as never,
  );
  vi.mocked(useGigaredSummary).mockReturnValue(
    mockQuery({ data: { accounts: { registered: 1, unregistered: 0, total: 1 }, services: [] } }) as never,
  );
  vi.mocked(useGigaredAllAccounts).mockReturnValue(mockQuery({ data: [] }) as never);
  vi.mocked(useLinkCic).mockReturnValue(mockMutation() as never);
  vi.mocked(useRegisterAccount).mockReturnValue(mockMutation() as never);
  vi.mocked(useAddTvService).mockReturnValue(mockMutation() as never);
  vi.mocked(useRemoveTvService).mockReturnValue(mockMutation() as never);
  vi.mocked(useSetOtt).mockReturnValue(mockMutation() as never);
  vi.mocked(useCancelTv).mockReturnValue(mockMutation() as never);
  vi.mocked(useCancelTvStatus).mockReturnValue(mockQuery({ data: undefined, isSuccess: false }) as never);
  vi.mocked(useChangeTvPassword).mockReturnValue(mockMutation() as never);
  vi.mocked(useTvCredentials).mockReturnValue(mockQuery({ data: undefined, isSuccess: false }) as never);
  vi.mocked(useClientContracts).mockReturnValue(
    mockQuery({
      data: [{ id: 'ct-1', plan: 'Plan TV', status: 'active', services: [{ id: 'cs-1', name: 'TV', status: 'active' }] }],
    }) as never,
  );
  vi.mocked(useRemoveContractService).mockReturnValue(mockMutation() as never);
  vi.mocked(useAddContractService).mockReturnValue(mockMutation() as never);
  vi.mocked(useServiceCatalog).mockReturnValue(mockQuery({ data: [] }) as never);

  vi.mocked(useMyPermissions).mockReturnValue({
    permissions: [],
    roles: [],
    user: null,
    isLoading: false,
    isError: false,
    can: (p: string | string[]) => {
      const perms = Array.isArray(p) ? p : [p];
      return perms.every((x) => (x === 'tv.transfer' ? canTransfer : true));
    },
  } as unknown as ReturnType<typeof useMyPermissions>);
}

function renderPanel() {
  return render(
    <GigaredPanel
      customerId="client-abc"
      contractId="ct-1"
      customer={{ name: 'MARTINO AGUSTINA', email: 'a@b.com' }}
      grContratoId="GR-1"
      onClose={vi.fn()}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GPT-1: botón visible con tv.transfer', () => {
  it('muestra "Transferir a otro cliente" en la vista linked', () => {
    setup();
    renderPanel();
    expect(screen.getByRole('button', { name: /transferir a otro cliente/i })).toBeInTheDocument();
  });
});

describe('GPT-2: gating sin tv.transfer', () => {
  it('sin el permiso el botón NO aparece', () => {
    setup({ canTransfer: false });
    renderPanel();
    expect(screen.queryByRole('button', { name: /transferir a otro cliente/i })).not.toBeInTheDocument();
  });
});

describe('GPT-3: click abre el modal de transferencia', () => {
  it('abre TransferServiceModal variante tv con cliente/contrato origen', async () => {
    const user = userEvent.setup();
    setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: /transferir a otro cliente/i }));

    const modal = screen.getByTestId('transfer-service-modal');
    expect(modal).toHaveAttribute('data-kind', 'tv');
    expect(modal).toHaveAttribute('data-source-client', 'client-abc');
    expect(modal).toHaveAttribute('data-source-contract', 'ct-1');
  });
});

describe('GPT-4 FIX 4: snapshot del sourceContractId al abrir el modal', () => {
  it('el modal conserva el contrato origen aunque el owner efectivo cambie tras el 207', async () => {
    const user = userEvent.setup();
    setup();
    const panelProps = {
      customerId: 'client-abc',
      contractId: 'ct-1',
      customer: { name: 'MARTINO AGUSTINA', email: 'a@b.com' },
      grContratoId: 'GR-1',
      onClose: vi.fn(),
    };
    const view = render(<GigaredPanel {...panelProps} />);

    await user.click(screen.getByRole('button', { name: /transferir a otro cliente/i }));
    expect(screen.getByTestId('transfer-service-modal')).toHaveAttribute(
      'data-source-contract',
      'ct-1',
    );

    // Post-207: la invalidación de contratos recalcula el owner efectivo — ahora
    // la línea TV activa vive en ct-2 (destino). Sin snapshot, el Reintentar
    // mandaría OTRO sourceContractId y rompería el "mismo request/resume".
    vi.mocked(useClientContracts).mockReturnValue(
      mockQuery({
        data: [
          { id: 'ct-1', plan: 'Plan TV', status: 'active', services: [] },
          {
            id: 'ct-2',
            plan: 'Plan TV 2',
            status: 'active',
            services: [{ id: 'cs-2', name: 'TV', status: 'active' }],
          },
        ],
      }) as never,
    );
    view.rerender(<GigaredPanel {...panelProps} />);

    expect(screen.getByTestId('transfer-service-modal')).toHaveAttribute(
      'data-source-contract',
      'ct-1',
    );
  });
});
