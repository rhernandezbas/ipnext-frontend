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

// client-geolocation: ContractCard now uses useUpdateContractLocation from
// useCustomers. Stub it so tests don't require a QueryClientProvider.
vi.mock('@/hooks/useCustomers', () => ({
  useUpdateContractLocation: vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  })),
  useUpdateContractName: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
}));

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
  useGigaredCustomerAccount: vi.fn(),
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
import { useGigaredConfig, useGigaredCustomerAccount } from '@/hooks/useGigared';
import type { GigaredAccount } from '@/types/gigared';
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
  account = null,
}: {
  contractServices?: ContractService[];
  catalog?: ServiceCatalogEntry[];
  gigaredConfig?: GigaredConfig | undefined;
  /** #47k — the linked Gigared account; drives the TV chip suspended state. */
  account?: GigaredAccount | null;
} = {}) {
  vi.mocked(useServiceCatalog).mockReturnValue({ data: catalog, isLoading: false } as ReturnType<typeof useServiceCatalog>);
  vi.mocked(useAddContractService).mockReturnValue({ mutateAsync: addMutate, isPending: false } as unknown as ReturnType<typeof useAddContractService>);
  vi.mocked(useUpdateContractService).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useUpdateContractService>);
  vi.mocked(useRemoveContractService).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as unknown as ReturnType<typeof useRemoveContractService>);
  vi.mocked(useGigaredConfig).mockReturnValue({ data: gigaredConfig, isLoading: false } as unknown as ReturnType<typeof useGigaredConfig>);
  vi.mocked(useGigaredCustomerAccount).mockReturnValue({
    data: account ? { linked: true, account } : { linked: false, account: null },
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof useGigaredCustomerAccount>);
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

  it('picking a generic service (no TV/INTERNET) always creates the plain item (never the panel)', async () => {
    setup({
      catalog: [catalogEntry({ id: 'sc-voz', name: 'VOZ', label: 'Voz IP' })],
      gigaredConfig: config({ configured: true, enabled: true }),
    });
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByText(/Agregar servicio/i));
    await user.click(within(screen.getByRole('menu')).getByText(/Voz IP/i));
    await waitFor(() =>
      expect(addMutate).toHaveBeenCalledWith({ contractId: 'ctr-9', payload: { serviceCatalogId: 'sc-voz' } }),
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

  it('a generic chip (no TV/INTERNET) toggles status (does NOT open a panel)', async () => {
    const toggleMutate = vi.fn().mockResolvedValue(undefined);
    setup({ gigaredConfig: config({ configured: true, enabled: true }) });
    vi.mocked(useUpdateContractService).mockReturnValue({ mutateAsync: toggleMutate, isPending: false } as unknown as ReturnType<typeof useUpdateContractService>);
    const user = userEvent.setup();
    renderCard({ services: [svc({ id: 'cs-voz', serviceCatalogId: 'sc-voz', name: 'VOZ', label: 'Voz IP' })] });
    await user.click(screen.getByRole('button', { name: /^Voz IP$/ }));
    await waitFor(() => expect(toggleMutate).toHaveBeenCalled());
    expect(screen.queryByTestId('gigared-panel')).not.toBeInTheDocument();
  });

  // ── #83 — Vigencia renders the canonical short date (no raw ISO) ─────────────
  describe('#83 — Vigencia date formatting', () => {
    it('renders a date-only range as "Desde DD mmm YYYY" (no ISO leaks)', () => {
      // Prod serializes a date-only Vigencia as a FULL ISO at UTC midnight
      // ("2025-09-08T00:00:00.000Z"), NOT as a bare "2025-09-08". In AR (UTC-3)
      // that instant is the prior day locally, so a TZ-naive formatter would
      // render "07 sep 2025". The canonical formatter must show the literal day.
      renderCard({ startDate: '2025-09-08T00:00:00.000Z', endDate: null });
      expect(screen.getByText('Desde 08 sep 2025')).toBeInTheDocument();
      // The raw ISO / numeric leftover must NOT be on screen.
      expect(screen.queryByText(/2025-09-08/)).not.toBeInTheDocument();
    });

    it('renders an open→close range with the arrow and both legible dates', () => {
      // Prod shape: full ISO at UTC midnight for both bounds.
      renderCard({ startDate: '2024-01-01T00:00:00.000Z', endDate: '2025-12-31T00:00:00.000Z' });
      expect(screen.getByText('01 ene 2024 → 31 dic 2025')).toBeInTheDocument();
    });
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

  // ── #47k — the TV chip reflects suspension (OTT disabled + has packs) ─────────
  // When the linked Gigared account has OTT disabled AND holds packs, the TV chip
  // turns amber and its title reads "TV suspendida" so the operator sees the
  // suspension without opening the panel.
  describe('#47k — TV chip suspended state', () => {
    const account = (over: Partial<GigaredAccount> = {}): GigaredAccount => ({
      cic: '0000000001',
      gigaredId: 'g-1',
      email: 'a@b.com',
      firstName: 'Ana',
      lastName: 'García',
      registrationDate: '2026-01-01T00:00:00Z',
      services: [{ id: 's1', name: 'Gigared Play Full' }],
      internalId: 'c-1',
      clientId: null,
      ott: { id: 'o1', stationaryLicenses: 1, mobileLicenses: 1, registeredDevices: 0, status: 'disabled' },
      ...over,
    });

    const tvSvc = () => svc({ id: 'cs-tv', serviceCatalogId: 'sc-tv', name: 'TV', label: 'TV' });

    it('OTT disabled + has packs → the TV chip title is "TV suspendida"', () => {
      setup({ gigaredConfig: config(), account: account() });
      renderCard({ services: [tvSvc()] });
      const tvChip = screen.getByRole('button', { name: /^TV$/ });
      expect(tvChip).toHaveAttribute('title', expect.stringMatching(/tv suspendida/i));
    });

    it('OTT enabled → the TV chip is NOT suspended (default "Gestionar TV")', () => {
      setup({ gigaredConfig: config(), account: account({ ott: { id: 'o1', stationaryLicenses: 1, mobileLicenses: 1, registeredDevices: 0, status: 'enabled' } }) });
      renderCard({ services: [tvSvc()] });
      const tvChip = screen.getByRole('button', { name: /^TV$/ });
      expect(tvChip).toHaveAttribute('title', expect.stringMatching(/gestionar tv/i));
    });

    it('OTT disabled but NO packs → not suspended (no packs to suspend)', () => {
      setup({ gigaredConfig: config(), account: account({ services: [] }) });
      renderCard({ services: [tvSvc()] });
      const tvChip = screen.getByRole('button', { name: /^TV$/ });
      expect(tvChip).toHaveAttribute('title', expect.stringMatching(/gestionar tv/i));
    });

    // LOW (review) — the panel treats ott.status === null as SUSPENDED (it shows
    // "Reactivar TV"). The chip must agree: an unknown OTT state WITH packs is
    // amber too, so chip and panel never disagree.
    it('OTT status null (unknown) + has packs → the TV chip title is "TV suspendida"', () => {
      setup({
        gigaredConfig: config(),
        account: account({ ott: { id: 'o1', stationaryLicenses: 1, mobileLicenses: 1, registeredDevices: 0, status: null } }),
      });
      renderCard({ services: [tvSvc()] });
      const tvChip = screen.getByRole('button', { name: /^TV$/ });
      expect(tvChip).toHaveAttribute('title', expect.stringMatching(/tv suspendida/i));
    });

    // But NO OTT object at all (no Gigared OTT account) is NOT a suspension —
    // there is nothing to reactivate, so the chip stays the normal "Gestionar TV".
    it('no OTT object (ott null) → not suspended (nothing to reactivate)', () => {
      setup({ gigaredConfig: config(), account: account({ ott: null }) });
      renderCard({ services: [tvSvc()] });
      const tvChip = screen.getByRole('button', { name: /^TV$/ });
      expect(tvChip).toHaveAttribute('title', expect.stringMatching(/gestionar tv/i));
    });
  });

  // ── #55: contract code badge (the identity sent to IClass) ──────────────────
  describe('#55 — contract code badge', () => {
    it('renders the GR contract code as a mono badge when present', () => {
      renderCard({ code: 'CTR-204382' });
      const badge = screen.getByText('CTR-204382');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute('title', expect.stringMatching(/código de contrato/i));
    });

    it('renders no code badge when code is null (non-GR contract)', () => {
      renderCard({ code: null });
      expect(screen.queryByText(/CTR-/)).not.toBeInTheDocument();
    });
  });

  // ── #5A — stale TV chip filter ────────────────────────────────────────────
  // After a baja the reconcile leaves the TV row status='inactive' but does NOT
  // delete the ContractService row. That stale row must NOT produce a TV chip.
  describe('#5A — stale inactive TV chip', () => {
    it('inactive TV service is NOT rendered as a chip', () => {
      setup({ gigaredConfig: config({ configured: true, enabled: true }) });
      renderCard({
        services: [svc({ id: 'cs-tv', serviceCatalogId: 'sc-tv', name: 'TV', label: 'TV', status: 'inactive' })],
      });
      // No TV chip button (the chip is a button when Gigared is active).
      expect(screen.queryByRole('button', { name: /^TV$/ })).not.toBeInTheDocument();
      // No static TV text either.
      expect(screen.queryByText(/^TV$/)).not.toBeInTheDocument();
    });

    it('active TV service IS rendered as a chip', () => {
      setup({ gigaredConfig: config({ configured: true, enabled: true }) });
      renderCard({
        services: [svc({ id: 'cs-tv', serviceCatalogId: 'sc-tv', name: 'TV', label: 'TV', status: 'active' })],
      });
      expect(screen.getByRole('button', { name: /^TV$/ })).toBeInTheDocument();
    });

    it('inactive generic service (no TV/INTERNET) is still rendered (filter is TV+INTERNET-specific)', () => {
      setup({ gigaredConfig: config({ configured: true, enabled: true }) });
      renderCard({
        services: [
          svc({ id: 'cs-voz', serviceCatalogId: 'sc-voz', name: 'VOZ', label: 'Voz IP', status: 'inactive' }),
        ],
      });
      // Un chip genérico inactivo renderiza como span estático; el filtro NO toca los genéricos
      // (solo descarta TV e INTERNET inactivos, que son servicios gestionados por panel).
      expect(screen.getByText(/Voz IP/)).toBeInTheDocument();
    });
  });
});
