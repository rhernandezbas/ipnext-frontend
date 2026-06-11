/**
 * #47b — TV activation FROM THE CONTRACT card.
 *
 * - Picking the TV catalog service when Gigared is configured+enabled → opens
 *   the GigaredPanel (no plain ContractService is created; the BE reconcile
 *   creates the local item when a pack is added).
 * - Picking TV when Gigared is NOT configured → plain item + informative hint.
 * - Clicking the existing TV chip → opens the GigaredPanel in management mode.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Contract, ContractService, ServiceCatalogEntry } from '@/types/customer';
import type { GigaredConfig } from '@/types/gigared';

vi.mock('@/hooks/useContractServices', () => ({
  useAddContractService: vi.fn(),
  useUpdateContractService: vi.fn(),
  useRemoveContractService: vi.fn(),
}));
vi.mock('@/hooks/useServiceCatalog', () => ({
  useServiceCatalog: vi.fn(),
}));
vi.mock('@/hooks/useGigared', () => ({
  useGigaredConfig: vi.fn(),
}));
// Stub the GigaredPanel — we only assert it opens, not its internals (covered
// by GigaredPanel.test.tsx).
vi.mock('@/pages/customers/tabs/contracts/GigaredPanel', () => ({
  GigaredPanel: ({ contractId, onClose }: { contractId: string; onClose: () => void }) => (
    <div data-testid="gigared-panel" data-contract-id={contractId}>
      <button onClick={onClose}>panel-close</button>
    </div>
  ),
}));
// ServiceInventorySection has a deep hook tree — stub it.
vi.mock('@/pages/customers/tabs/ServiceInventorySection', () => ({
  ServiceInventorySection: () => <div data-testid="equipos" />,
}));
// InlineNameEdit pulls useUpdateContractName — stub it to keep the card simple.
vi.mock('@/pages/customers/tabs/contracts/InlineNameEdit', () => ({
  InlineNameEdit: ({ display }: { display: string }) => <span>{display}</span>,
}));

import { useMyPermissions } from '@/hooks/useMyPermissions';
import { useConfirm } from '@/context/ConfirmContext';
import {
  useAddContractService,
  useUpdateContractService,
  useRemoveContractService,
} from '@/hooks/useContractServices';
import { useServiceCatalog } from '@/hooks/useServiceCatalog';
import { useGigaredConfig } from '@/hooks/useGigared';
import { ContractCard } from '@/pages/customers/tabs/contracts/ContractCard';

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
  id: 'ctr-9',
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
  services: [],
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

const config = (over: Partial<GigaredConfig> = {}): GigaredConfig => ({
  configured: true,
  apiKeyLast4: '1234',
  baseUrl: 'https://gigared.test',
  enabled: true,
  updatedAt: '2026-06-01T00:00:00.000Z',
  ...over,
});

const addMutate = vi.fn().mockResolvedValue(undefined);

function setup({
  contractServices = [],
  catalog = [catalogEntry()],
  gigaredConfig = config(),
}: {
  contractServices?: ContractService[];
  catalog?: ServiceCatalogEntry[];
  gigaredConfig?: GigaredConfig | undefined;
} = {}) {
  vi.mocked(useServiceCatalog).mockReturnValue({ data: catalog, isLoading: false } as ReturnType<typeof useServiceCatalog>);
  vi.mocked(useAddContractService).mockReturnValue({ mutateAsync: addMutate, isPending: false } as unknown as ReturnType<typeof useAddContractService>);
  vi.mocked(useUpdateContractService).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useUpdateContractService>);
  vi.mocked(useRemoveContractService).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useRemoveContractService>);
  vi.mocked(useGigaredConfig).mockReturnValue({ data: gigaredConfig, isLoading: false } as unknown as ReturnType<typeof useGigaredConfig>);
  return contractServices;
}

function renderCard(over: Partial<Contract> = {}) {
  return render(
    <MemoryRouter>
      <ContractCard contract={contract(over)} clientId="c-1" active />
    </MemoryRouter>,
  );
}

describe('ContractCard — TV from contract (#47b)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useConfirm).mockReturnValue(vi.fn().mockResolvedValue(true));
    vi.mocked(useMyPermissions).mockReturnValue({
      permissions: ['*'],
      roles: [],
      user: null,
      isLoading: false,
      isError: false,
      can: () => true,
    } as unknown as ReturnType<typeof useMyPermissions>);
    setup();
  });

  it('picking TV with Gigared configured opens the panel (no plain add)', async () => {
    setup({ gigaredConfig: config({ configured: true, enabled: true }) });
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByText(/Agregar servicio/i));
    await user.click(within(screen.getByRole('menu')).getByText(/Televisión/i));
    await waitFor(() => expect(screen.getByTestId('gigared-panel')).toBeInTheDocument());
    expect(screen.getByTestId('gigared-panel')).toHaveAttribute('data-contract-id', 'ctr-9');
    expect(addMutate).not.toHaveBeenCalled();
  });

  it('picking TV when Gigared is NOT configured creates the plain item + hint', async () => {
    setup({ gigaredConfig: config({ configured: false, enabled: false }) });
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByText(/Agregar servicio/i));
    await user.click(within(screen.getByRole('menu')).getByText(/Televisión/i));
    await waitFor(() =>
      expect(addMutate).toHaveBeenCalledWith({ contractId: 'ctr-9', payload: { serviceCatalogId: 'sc-tv' } }),
    );
    expect(screen.queryByTestId('gigared-panel')).not.toBeInTheDocument();
    expect(screen.getByText(/integración Gigared no está activa/i)).toBeInTheDocument();
  });

  it('picking TV when Gigared is configured but DISABLED creates the plain item', async () => {
    setup({ gigaredConfig: config({ configured: true, enabled: false }) });
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByText(/Agregar servicio/i));
    await user.click(within(screen.getByRole('menu')).getByText(/Televisión/i));
    await waitFor(() =>
      expect(addMutate).toHaveBeenCalledWith({ contractId: 'ctr-9', payload: { serviceCatalogId: 'sc-tv' } }),
    );
    expect(screen.queryByTestId('gigared-panel')).not.toBeInTheDocument();
  });

  it('picking a NON-TV service always creates the plain item (never the panel)', async () => {
    setup({
      catalog: [catalogEntry({ id: 'sc-net', name: 'INTERNET', label: 'Internet Extra' })],
      gigaredConfig: config({ configured: true, enabled: true }),
    });
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByText(/Agregar servicio/i));
    await user.click(within(screen.getByRole('menu')).getByText(/Internet Extra/i));
    await waitFor(() =>
      expect(addMutate).toHaveBeenCalledWith({ contractId: 'ctr-9', payload: { serviceCatalogId: 'sc-net' } }),
    );
    expect(screen.queryByTestId('gigared-panel')).not.toBeInTheDocument();
  });

  it('clicking the existing TV chip opens the management panel', async () => {
    setup({ gigaredConfig: config({ configured: true, enabled: true }) });
    const user = userEvent.setup();
    renderCard({ services: [svc({ id: 'cs-tv', serviceCatalogId: 'sc-tv', name: 'TV', label: 'TV' })] });
    // The TV chip is clickable → opens the panel.
    await user.click(screen.getByRole('button', { name: /^TV$/ }));
    await waitFor(() => expect(screen.getByTestId('gigared-panel')).toBeInTheDocument());
    expect(screen.getByTestId('gigared-panel')).toHaveAttribute('data-contract-id', 'ctr-9');
  });

  it('a NON-TV chip toggles status (does NOT open the panel)', async () => {
    const toggleMutate = vi.fn().mockResolvedValue(undefined);
    setup({ gigaredConfig: config({ configured: true, enabled: true }) });
    vi.mocked(useUpdateContractService).mockReturnValue({ mutateAsync: toggleMutate, isPending: false } as unknown as ReturnType<typeof useUpdateContractService>);
    const user = userEvent.setup();
    renderCard({ services: [svc({ id: 'cs-int', serviceCatalogId: 'sc-int', name: 'INTERNET', label: 'Internet' })] });
    await user.click(screen.getByRole('button', { name: /^Internet$/ }));
    await waitFor(() => expect(toggleMutate).toHaveBeenCalled());
    expect(screen.queryByTestId('gigared-panel')).not.toBeInTheDocument();
  });

  // ── F3: tv.read gates the TV chip + picker diversion ───────────────────────
  describe('F3 — tv.read gating', () => {
    /** Grant clients.write but DENY tv.read. */
    function denyTvRead() {
      vi.mocked(useMyPermissions).mockReturnValue({
        permissions: [],
        roles: [],
        user: null,
        isLoading: false,
        isError: false,
        can: (p: string | string[]) => {
          const perms = Array.isArray(p) ? p : [p];
          return perms.every((x) => x !== 'tv.read');
        },
      } as unknown as ReturnType<typeof useMyPermissions>);
    }

    it('without tv.read the TV chip is static (not a button, never opens the panel)', async () => {
      setup({ gigaredConfig: config({ configured: true, enabled: true }) });
      denyTvRead();
      const user = userEvent.setup();
      renderCard({ services: [svc({ id: 'cs-tv', serviceCatalogId: 'sc-tv', name: 'TV', label: 'TV' })] });
      // No clickable TV control.
      expect(screen.queryByRole('button', { name: /^TV$/ })).not.toBeInTheDocument();
      // The label is still shown (static chip).
      expect(screen.getByText(/^TV$/)).toBeInTheDocument();
      expect(screen.queryByTestId('gigared-panel')).not.toBeInTheDocument();
    });

    it('without tv.read picking TV does NOT divert → creates the plain item', async () => {
      setup({ gigaredConfig: config({ configured: true, enabled: true }) });
      denyTvRead();
      const user = userEvent.setup();
      renderCard();
      await user.click(screen.getByText(/Agregar servicio/i));
      await user.click(within(screen.getByRole('menu')).getByText(/Televisión/i));
      await waitFor(() =>
        expect(addMutate).toHaveBeenCalledWith({ contractId: 'ctr-9', payload: { serviceCatalogId: 'sc-tv' } }),
      );
      expect(screen.queryByTestId('gigared-panel')).not.toBeInTheDocument();
    });
  });
});
