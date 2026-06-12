import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Contract, ContractService, ServiceCatalogEntry } from '@/types/customer';

// --- Mock data hooks (DeviceTypesBody pattern: control them directly) ---
vi.mock('@/hooks/useCustomers', () => ({
  useClientContracts: vi.fn(),
  useUpdateContractName: vi.fn(),
}));
vi.mock('@/hooks/useContractServices', () => ({
  useAddContractService: vi.fn(),
  useUpdateContractService: vi.fn(),
  useRemoveContractService: vi.fn(),
}));
vi.mock('@/hooks/useServiceCatalog', () => ({
  useServiceCatalog: vi.fn(),
}));
// #47b — ContractCard reads the Gigared config to decide whether the TV catalog
// pick / chip diverts to the panel. Default: integration OFF (plain item path),
// which preserves the existing #42 behaviour these tests assert.
vi.mock('@/hooks/useGigared', () => ({
  useGigaredConfig: vi.fn(() => ({ data: { configured: false, enabled: false }, isLoading: false })),
  // #47k — ContractCard now reads the linked account to flag a suspended TV chip.
  // Gigared is OFF in these tests, so return an unlinked account (chip stays plain).
  useGigaredCustomerAccount: vi.fn(() => ({
    data: { linked: false, account: null },
    isLoading: false,
    isError: false,
  })),
}));
// ServiceInventorySection has its own deep hook tree; stub it out here.
vi.mock('@/pages/customers/tabs/ServiceInventorySection', () => ({
  ServiceInventorySection: ({ serviceId }: { serviceId: string }) => (
    <div data-testid="equipos" data-service-id={serviceId} />
  ),
}));
import { useMyPermissions } from '@/hooks/useMyPermissions';

import { useClientContracts, useUpdateContractName } from '@/hooks/useCustomers';
import {
  useAddContractService,
  useUpdateContractService,
  useRemoveContractService,
} from '@/hooks/useContractServices';
import { useServiceCatalog } from '@/hooks/useServiceCatalog';
import { useConfirm } from '@/context/ConfirmContext';
import { ContractsTab } from '@/pages/customers/tabs/ContractsTab';

const svc = (over: Partial<ContractService> = {}): ContractService => ({
  id: 'cs-1',
  serviceCatalogId: 'sc-int',
  name: 'INTERNET',
  label: 'Internet',
  status: 'active',
  notes: null,
  createdAt: '2026-06-01T00:00:00.000Z',
  ...over,
});

const contract = (over: Partial<Contract> = {}): Contract => ({
  id: 'ctr-1',
  name: null,
  type: 'internet',
  plan: 'FIBRA 100MB',
  status: 'active',
  price: 3000,
  startDate: '2024-01-01',
  endDate: null,
  ip: '10.0.1.5',
  description: '',
  address: 'Av. Corrientes 500',
  technology: 'FTTH',
  services: [svc()],
  ...over,
});

const catalogEntry = (over: Partial<ServiceCatalogEntry> = {}): ServiceCatalogEntry => ({
  id: 'sc-tv',
  name: 'TV',
  label: 'Televisión',
  active: true,
  sortOrder: 2,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
  ...over,
});

const noop = vi.fn().mockResolvedValue(undefined);

function setup({
  contracts = [contract()],
  isLoading = false,
  catalog = [catalogEntry()],
  updateNameMutate = noop,
  addMutate = noop,
  toggleMutate = noop,
  removeMutate = noop,
}: {
  contracts?: Contract[];
  isLoading?: boolean;
  catalog?: ServiceCatalogEntry[];
  updateNameMutate?: ReturnType<typeof vi.fn>;
  addMutate?: ReturnType<typeof vi.fn>;
  toggleMutate?: ReturnType<typeof vi.fn>;
  removeMutate?: ReturnType<typeof vi.fn>;
} = {}) {
  vi.mocked(useClientContracts).mockReturnValue({ data: contracts, isLoading } as ReturnType<typeof useClientContracts>);
  vi.mocked(useServiceCatalog).mockReturnValue({ data: catalog, isLoading: false } as ReturnType<typeof useServiceCatalog>);
  vi.mocked(useUpdateContractName).mockReturnValue({ mutateAsync: updateNameMutate, isPending: false } as unknown as ReturnType<typeof useUpdateContractName>);
  vi.mocked(useAddContractService).mockReturnValue({ mutateAsync: addMutate, isPending: false } as unknown as ReturnType<typeof useAddContractService>);
  vi.mocked(useUpdateContractService).mockReturnValue({ mutateAsync: toggleMutate, isPending: false } as unknown as ReturnType<typeof useUpdateContractService>);
  vi.mocked(useRemoveContractService).mockReturnValue({ mutateAsync: removeMutate, isPending: false } as unknown as ReturnType<typeof useRemoveContractService>);
}

function denyWrite() {
  vi.mocked(useMyPermissions).mockReturnValue({
    permissions: ['clients.read'],
    roles: [],
    user: null,
    isLoading: false,
    isError: false,
    can: (p: string | string[]) => {
      const perms = Array.isArray(p) ? p : [p];
      return perms.some(x => x === 'clients.read');
    },
  });
}

describe('ContractsTab (#42)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useConfirm).mockReturnValue(vi.fn().mockResolvedValue(true));
    setup();
  });

  // --- CTU-3: layout / header ---
  it('shows the contract name in the header when set', () => {
    setup({ contracts: [contract({ name: 'Fibra Casa' })] });
    render(<ContractsTab clientId="c-1" active />);
    expect(screen.getByText('Fibra Casa')).toBeInTheDocument();
  });

  it('falls back to plan in the header when name is null', () => {
    setup({ contracts: [contract({ name: null, plan: 'FIBRA 100MB' })] });
    render(<ContractsTab clientId="c-1" active />);
    expect(screen.getByText('FIBRA 100MB')).toBeInTheDocument();
  });

  // --- CTU-2: ip drift fix ---
  it('renders the real ip value (not a dash)', () => {
    setup({ contracts: [contract({ ip: '10.0.1.5' })] });
    render(<ContractsTab clientId="c-1" active />);
    expect(screen.getByText('10.0.1.5')).toBeInTheDocument();
  });

  // --- CTU-3.3: address labelled Instalación ---
  it('labels the address as "Instalación"', () => {
    setup({ contracts: [contract({ address: 'Av. Corrientes 500' })] });
    render(<ContractsTab clientId="c-1" active />);
    expect(screen.getByText(/Instalación/i)).toBeInTheDocument();
    expect(screen.getByText('Av. Corrientes 500')).toBeInTheDocument();
  });

  // --- CTU-5: chips ---
  it('renders a chip per contract service', () => {
    setup({ contracts: [contract({ services: [svc({ label: 'Internet' }), svc({ id: 'cs-2', name: 'TV', label: 'TV' })] })] });
    render(<ContractsTab clientId="c-1" active />);
    expect(screen.getByText('Internet')).toBeInTheDocument();
    expect(screen.getByText('TV')).toBeInTheDocument();
  });

  // --- CTU-7.1: empty state, no CTA ---
  it('shows the informational empty state with NO add-contract CTA when there are no contracts', () => {
    setup({ contracts: [] });
    render(<ContractsTab clientId="c-1" active />);
    expect(screen.getByText(/se sincronizan desde Gestión Real/i)).toBeInTheDocument();
    expect(screen.queryByText(/Agregar contrato/i)).not.toBeInTheDocument();
  });

  // --- CTU-4.1: inline name edit Enter → patchContractName(uuid, name) ---
  it('saves the name on Enter via useUpdateContractName with the contract UUID', async () => {
    const updateNameMutate = vi.fn().mockResolvedValue(undefined);
    setup({ contracts: [contract({ id: 'ctr-uuid-9', name: null, plan: 'FIBRA 100MB' })], updateNameMutate });
    const user = userEvent.setup();
    render(<ContractsTab clientId="c-1" active />);
    await user.click(screen.getByText('FIBRA 100MB'));
    const input = screen.getByRole('textbox');
    await user.type(input, 'Nueva Fibra');
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(updateNameMutate).toHaveBeenCalledWith({ contractId: 'ctr-uuid-9', name: 'Nueva Fibra' }),
    );
  });

  // --- CTU-4.2: Esc cancels, no PATCH ---
  it('cancels the name edit on Esc without calling the mutation', async () => {
    const updateNameMutate = vi.fn().mockResolvedValue(undefined);
    setup({ contracts: [contract({ name: null, plan: 'FIBRA 100MB' })], updateNameMutate });
    const user = userEvent.setup();
    render(<ContractsTab clientId="c-1" active />);
    await user.click(screen.getByText('FIBRA 100MB'));
    await user.type(screen.getByRole('textbox'), 'Algo');
    await user.keyboard('{Escape}');
    expect(updateNameMutate).not.toHaveBeenCalled();
    expect(screen.getByText('FIBRA 100MB')).toBeInTheDocument();
  });

  // --- CTU-4.3: empty input → name null ---
  it('sends name: null when the input is cleared and submitted', async () => {
    const updateNameMutate = vi.fn().mockResolvedValue(undefined);
    setup({ contracts: [contract({ id: 'ctr-x', name: 'Vieja', plan: 'PLAN' })], updateNameMutate });
    const user = userEvent.setup();
    render(<ContractsTab clientId="c-1" active />);
    await user.click(screen.getByText('Vieja'));
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(updateNameMutate).toHaveBeenCalledWith({ contractId: 'ctr-x', name: null }),
    );
  });

  // --- CTU-5.1: add service via picker, excluding already-added ---
  it('adds a service from the picker (catalog excludes already-added entries)', async () => {
    const addMutate = vi.fn().mockResolvedValue(undefined);
    setup({
      contracts: [contract({ id: 'ctr-1', services: [svc({ serviceCatalogId: 'sc-int', name: 'INTERNET' })] })],
      catalog: [
        catalogEntry({ id: 'sc-int', name: 'INTERNET' }), // already added → must be excluded
        catalogEntry({ id: 'sc-tv', name: 'TV', label: 'Televisión' }),
      ],
      addMutate,
    });
    const user = userEvent.setup();
    render(<ContractsTab clientId="c-1" active />);
    await user.click(screen.getByText(/Agregar servicio/i));
    // INTERNET is already on the contract → not offered
    const picker = screen.getByRole('menu');
    expect(within(picker).queryByText('INTERNET')).not.toBeInTheDocument();
    await user.click(within(picker).getByText(/Televisión/i));
    await waitFor(() =>
      expect(addMutate).toHaveBeenCalledWith({ contractId: 'ctr-1', payload: { serviceCatalogId: 'sc-tv' } }),
    );
  });

  // --- Fix #1: duplicate service surfaces a toast (not window.alert) ---
  it('surfaces a toast when adding a duplicate service (409 CONTRACT_SERVICE_DUPLICATE)', async () => {
    const addMutate = vi.fn().mockRejectedValue({
      response: { status: 409, data: { code: 'CONTRACT_SERVICE_DUPLICATE' } },
    });
    setup({
      contracts: [contract({ id: 'ctr-1', services: [] })],
      catalog: [catalogEntry({ id: 'sc-tv', name: 'TV', label: 'Televisión' })],
      addMutate,
    });
    const user = userEvent.setup();
    render(<ContractsTab clientId="c-1" active />);
    await user.click(screen.getByText(/Agregar servicio/i));
    await user.click(within(screen.getByRole('menu')).getByText(/Televisión/i));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/ya está agregado al contrato/i),
    );
  });

  // --- CTU-5.4: toggle status ---
  it('toggles a service status to inactive on chip click', async () => {
    const toggleMutate = vi.fn().mockResolvedValue(undefined);
    setup({
      contracts: [contract({ id: 'ctr-1', services: [svc({ id: 'cs-1', label: 'Internet', status: 'active' })] })],
      toggleMutate,
    });
    const user = userEvent.setup();
    render(<ContractsTab clientId="c-1" active />);
    await user.click(screen.getByRole('button', { name: 'Internet' }));
    await waitFor(() =>
      expect(toggleMutate).toHaveBeenCalledWith({ contractId: 'ctr-1', id: 'cs-1', payload: { status: 'inactive' } }),
    );
  });

  // --- CTU-5.3: remove with confirm ---
  it('removes a service after confirm', async () => {
    const removeMutate = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useConfirm).mockReturnValue(vi.fn().mockResolvedValue(true));
    setup({
      contracts: [contract({ id: 'ctr-1', services: [svc({ id: 'cs-1', label: 'Internet' })] })],
      removeMutate,
    });
    const user = userEvent.setup();
    render(<ContractsTab clientId="c-1" active />);
    await user.click(screen.getByRole('button', { name: /quitar Internet/i }));
    await waitFor(() =>
      expect(removeMutate).toHaveBeenCalledWith({ contractId: 'ctr-1', id: 'cs-1' }),
    );
  });

  // --- CTU-7.2: no services → actionable hint for writers ---
  it('shows an actionable hint when a contract has no services and the user can write', () => {
    setup({ contracts: [contract({ services: [] })] });
    render(<ContractsTab clientId="c-1" active />);
    expect(screen.getByText(/Agregá un servicio/i)).toBeInTheDocument();
  });

  // --- CTU-4.4 / CTU-5.6 / CTU-7.3: read-only without clients.write ---
  it('hides mutation controls and is read-only without clients.write', async () => {
    denyWrite();
    setup({ contracts: [contract({ name: 'Fibra Casa', services: [svc({ label: 'Internet' })] })] });
    const user = userEvent.setup();
    render(<ContractsTab clientId="c-1" active />);
    // No add-service button
    expect(screen.queryByText(/Agregar servicio/i)).not.toBeInTheDocument();
    // Chip is not a toggle button
    expect(screen.queryByRole('button', { name: /Internet/i })).not.toBeInTheDocument();
    // Name is not click-to-edit
    await user.click(screen.getByText('Fibra Casa'));
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
