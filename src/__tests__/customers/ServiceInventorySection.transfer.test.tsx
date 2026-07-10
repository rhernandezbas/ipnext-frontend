/**
 * ServiceInventorySection — botón "Transferir equipos" (service-transfer W4)
 *
 * Cubre:
 *  SIT-1  Con inventory.transfer + ítems activos → el botón aparece habilitado en la toolbar
 *  SIT-2  Sin ítems activos (todos removed) → el botón aparece deshabilitado
 *  SIT-3  Sin inventory.transfer → el botón NO aparece
 *  SIT-4  Click → abre el TransferServiceModal (variante equipment) SOLO con los ítems activos
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ServiceInstalledItem } from '@/types/serviceInventory';
import { mockQuery } from '@/__tests__/_utils/reactQueryMocks';

vi.mock('@/hooks/useServiceInventory', () => ({
  useServiceInstalledItems: vi.fn(),
  useAddInstalledItem: vi.fn(),
  useUpdateInstalledItem: vi.fn(),
  useRetireInstalledItem: vi.fn(),
  useInspectPppoeDevices: vi.fn(),
  useTransferEquipment: vi.fn(),
}));
vi.mock('@/hooks/useDeviceTypes', () => ({
  useDeviceTypes: vi.fn(() => ({ data: [], isLoading: false })),
}));
// Stub del modal de transferencia — internals en TransferServiceModal.test.tsx
vi.mock('@/components/molecules/TransferServiceModal/TransferServiceModal', () => ({
  TransferServiceModal: ({
    variant,
    sourceClientId,
    sourceContractId,
  }: {
    variant: { kind: string; items?: { id: string }[] };
    sourceClientId: string;
    sourceContractId: string;
  }) => (
    <div
      data-testid="transfer-service-modal"
      data-kind={variant.kind}
      data-item-ids={(variant.items ?? []).map((i) => i.id).join(',')}
      data-source-client={sourceClientId}
      data-source-contract={sourceContractId}
    />
  ),
}));

import {
  useServiceInstalledItems,
  useAddInstalledItem,
  useUpdateInstalledItem,
  useRetireInstalledItem,
  useInspectPppoeDevices,
} from '@/hooks/useServiceInventory';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { ServiceInventorySection } from '@/pages/customers/tabs/ServiceInventorySection';

function makeItem(id: string, status: ServiceInstalledItem['status']): ServiceInstalledItem {
  return {
    id,
    serviceId: 'ct-s1',
    type: 'ANTENA',
    serialNumber: `SN-${id}`,
    mac: null,
    model: null,
    source: 'MANUAL',
    sourceTaskId: null,
    addedByUserId: null,
    addedByUserName: null,
    confirmedAt: null,
    status,
    notes: null,
    createdAt: '2026-06-01T00:00:00Z',
  };
}

function neutralMutation() {
  return { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false } as never;
}

function setup({
  items = [makeItem('item-1', 'active'), makeItem('item-2', 'removed')],
  canTransfer = true,
}: { items?: ServiceInstalledItem[]; canTransfer?: boolean } = {}) {
  vi.mocked(useServiceInstalledItems).mockReturnValue(mockQuery({ data: items }) as never);
  vi.mocked(useAddInstalledItem).mockReturnValue(neutralMutation());
  vi.mocked(useUpdateInstalledItem).mockReturnValue(neutralMutation());
  vi.mocked(useRetireInstalledItem).mockReturnValue(neutralMutation());
  vi.mocked(useInspectPppoeDevices).mockReturnValue({ inspect: vi.fn(), isPending: false });

  vi.mocked(useMyPermissions).mockReturnValue({
    permissions: [],
    roles: [],
    user: null,
    isLoading: false,
    isError: false,
    can: (p: string | string[]) => {
      const perms = Array.isArray(p) ? p : [p];
      return perms.every((x) => (x === 'inventory.transfer' ? canTransfer : true));
    },
  } as unknown as ReturnType<typeof useMyPermissions>);
}

function renderSection() {
  return render(
    <ServiceInventorySection
      serviceId="ct-s1"
      clientId="client-42"
      customerName="MARTINO AGUSTINA"
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SIT-1: botón habilitado con permiso + ítems activos', () => {
  it('muestra "Transferir equipos" habilitado', () => {
    setup();
    renderSection();
    const btn = screen.getByRole('button', { name: /transferir equipos/i });
    expect(btn).toBeEnabled();
  });
});

describe('SIT-2: sin ítems activos → deshabilitado', () => {
  it('con solo ítems removed el botón queda deshabilitado', () => {
    setup({ items: [makeItem('item-1', 'removed')] });
    renderSection();
    expect(screen.getByRole('button', { name: /transferir equipos/i })).toBeDisabled();
  });
});

describe('SIT-3: gating sin inventory.transfer', () => {
  it('sin el permiso el botón NO aparece', () => {
    setup({ canTransfer: false });
    renderSection();
    expect(screen.queryByRole('button', { name: /transferir equipos/i })).not.toBeInTheDocument();
  });
});

describe('SIT-4: click abre el modal con SOLO los ítems activos', () => {
  it('abre TransferServiceModal variante equipment con los activos', async () => {
    const user = userEvent.setup();
    setup();
    renderSection();

    await user.click(screen.getByRole('button', { name: /transferir equipos/i }));

    const modal = screen.getByTestId('transfer-service-modal');
    expect(modal).toHaveAttribute('data-kind', 'equipment');
    expect(modal).toHaveAttribute('data-item-ids', 'item-1');
    expect(modal).toHaveAttribute('data-source-client', 'client-42');
    expect(modal).toHaveAttribute('data-source-contract', 'ct-s1');
  });
});
