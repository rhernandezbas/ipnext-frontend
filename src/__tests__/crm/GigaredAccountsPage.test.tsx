import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { GigaredAccount, GigaredSummary } from '@/types/gigared';

vi.mock('@/hooks/useGigared', () => ({
  useGigaredSummary: vi.fn(),
  useGigaredAllAccounts: vi.fn(),
  // #61 fix wave — the page imports this constant for the cap notice; the mock
  // must expose the real value (200) or the import resolves to undefined.
  MAX_FETCHED_ACCOUNTS: 200,
}));

import { useGigaredSummary, useGigaredAllAccounts } from '@/hooks/useGigared';
import GigaredAccountsPage from '@/pages/crm/GigaredAccountsPage';

const accounts: GigaredAccount[] = [
  {
    cic: '0000000001', gigaredId: 'g1', email: 'a@b.com', firstName: 'Ana', lastName: 'García',
    registrationDate: '2026-01-01T00:00:00Z', services: [{ id: 's1', name: 'Play Full' }],
    // #47j Fix 1 — OTT status is the FROZEN 'enabled' | 'disabled' | null.
    internalId: 'c1', ott: { id: 'o1', stationaryLicenses: 1, mobileLicenses: 0, registeredDevices: 1, status: 'enabled' },
  },
  {
    cic: '0000000002', gigaredId: 'g2', email: 'b@b.com', firstName: 'Beto', lastName: 'López',
    registrationDate: null, services: [], internalId: null, ott: null,
  },
];

const summary: GigaredSummary = {
  accounts: { registered: 5, unregistered: 2, total: 7 },
  services: [{ id: 's1', name: 'Play Full', qtyAvailable: 3, qtyUsed: 2, qtyPurchased: 5 }],
};

// useGigaredAllAccounts returns GigaredAccount[] directly (not wrapped).
function mockHooks(over: {
  allAccountsData?: GigaredAccount[];
  allAccountsError?: unknown;
  allAccountsLoading?: boolean;
  summaryData?: GigaredSummary;
} = {}) {
  vi.mocked(useGigaredSummary).mockReturnValue({
    data: over.summaryData ?? summary,
    isLoading: false,
    isError: false,
  } as ReturnType<typeof useGigaredSummary>);

  vi.mocked(useGigaredAllAccounts).mockReturnValue({
    data: over.allAccountsData ?? accounts,
    isLoading: over.allAccountsLoading ?? false,
    isError: !!over.allAccountsError,
    error: over.allAccountsError,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useGigaredAllAccounts>);
}

function renderPage() {
  return render(
    <MemoryRouter>
      <GigaredAccountsPage />
    </MemoryRouter>,
  );
}

describe('GigaredAccountsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the summary counts', () => {
    mockHooks();
    renderPage();
    expect(screen.getByText('7')).toBeInTheDocument();
    // "Play Full" shows in both the summary service table and the row chips.
    expect(screen.getAllByText(/Play Full/).length).toBeGreaterThan(0);
  });

  it('renders account rows', () => {
    mockHooks();
    renderPage();
    expect(screen.getByText('0000000001')).toBeInTheDocument();
    expect(screen.getByText('a@b.com')).toBeInTheDocument();
    expect(screen.getByText('0000000002')).toBeInTheDocument();
  });

  // ── #47j Fix 1: the OTT column reads the FROZEN 'enabled' status ─────────────
  describe('#47j Fix 1 — OTT column reflects normalized status', () => {
    it("status 'enabled' → renders 'Activo'", () => {
      mockHooks();
      renderPage();
      expect(screen.getByText('Activo')).toBeInTheDocument();
    });

    it("status 'disabled' → renders the dash", () => {
      const disabled = [
        { ...accounts[0], ott: { ...accounts[0].ott!, status: 'disabled' as const } },
      ];
      mockHooks({ allAccountsData: disabled });
      renderPage();
      expect(screen.queryByText('Activo')).not.toBeInTheDocument();
    });
  });

  // ── #47j Fix 3: the name links to the customer view when linked ──────────────
  describe('#47j Fix 3 — name hyperlinks the linked customer', () => {
    it('linked account → name is a link to /admin/customers/view/{internalId}', () => {
      mockHooks();
      renderPage();
      // accounts[0] has internalId 'c1' and name "Ana García".
      const link = screen.getByRole('link', { name: /Ana García/i });
      expect(link).toHaveAttribute('href', '/admin/customers/view/c1');
    });

    it('unlinked account (no internalId) → name is plain text, not a link', () => {
      mockHooks();
      renderPage();
      // accounts[1] "Beto López" has internalId null → no link.
      expect(screen.queryByRole('link', { name: /Beto López/i })).not.toBeInTheDocument();
      expect(screen.getByText('Beto López')).toBeInTheDocument();
    });
  });

  // ── #47j Fix 4: the summary service copy is human, not "0/102" ───────────────
  describe('#47j Fix 4 — readable service usage copy', () => {
    it('renders "En uso {used} de {purchased}" with available sub', () => {
      // summary service: used 2, purchased 5, available 3.
      mockHooks();
      renderPage();
      expect(screen.getByText(/en uso 2 de 5/i)).toBeInTheDocument();
      expect(screen.getByText(/3 disponibles/i)).toBeInTheDocument();
    });

    it('available 0 → warns "sin cupo disponible"', () => {
      const full: GigaredSummary = {
        accounts: { registered: 5, unregistered: 2, total: 7 },
        services: [{ id: 's1', name: 'Play Full', qtyAvailable: 0, qtyUsed: 5, qtyPurchased: 5 }],
      };
      mockHooks({ summaryData: full });
      renderPage();
      expect(screen.getByText(/en uso 5 de 5/i)).toBeInTheDocument();
      expect(screen.getByText(/sin cupo disponible/i)).toBeInTheDocument();
    });
  });

  // ── #61 — single LIKE search input ──────────────────────────────────────────
  // The 2 old inputs (email + CIC) are GONE. ONE input replaces them.
  it('renders a single search input with correct placeholder', () => {
    mockHooks();
    renderPage();
    expect(screen.getByPlaceholderText(/buscar por nombre, cic o email/i)).toBeInTheDocument();
    // The OLD separate inputs must NOT be present.
    expect(screen.queryByPlaceholderText(/filtrar por email/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/cic o id interno/i)).not.toBeInTheDocument();
  });

  it('filters by NAME substring (case-insensitive) after debounce', async () => {
    const user = userEvent.setup();
    mockHooks();
    renderPage();
    await user.type(screen.getByPlaceholderText(/buscar por nombre, cic o email/i), 'ana');
    await waitFor(() => {
      expect(screen.getByText('0000000001')).toBeInTheDocument(); // Ana García matched
      expect(screen.queryByText('0000000002')).not.toBeInTheDocument(); // Beto filtered out
    }, { timeout: 1000 });
  });

  it('filters by CIC substring (case-insensitive) after debounce', async () => {
    const user = userEvent.setup();
    mockHooks();
    renderPage();
    await user.type(screen.getByPlaceholderText(/buscar por nombre, cic o email/i), '0000000002');
    await waitFor(() => {
      expect(screen.getByText('0000000002')).toBeInTheDocument(); // matched
      expect(screen.queryByText('0000000001')).not.toBeInTheDocument(); // filtered out
    }, { timeout: 1000 });
  });

  it('filters by EMAIL substring (case-insensitive) after debounce', async () => {
    const user = userEvent.setup();
    mockHooks();
    renderPage();
    await user.type(screen.getByPlaceholderText(/buscar por nombre, cic o email/i), 'a@b.com');
    await waitFor(() => {
      expect(screen.getByText('a@b.com')).toBeInTheDocument(); // Ana matched
      expect(screen.queryByText('b@b.com')).not.toBeInTheDocument(); // Beto filtered out
    }, { timeout: 1000 });
  });

  // #61 fix wave — copy-paste of a CIC often drags a trailing space ("2354 ").
  // The term must be trimmed or it matches nothing.
  it('trims the search term so a trailing space still matches (#61 fix wave)', async () => {
    const user = userEvent.setup();
    mockHooks();
    renderPage();
    await user.type(
      screen.getByPlaceholderText(/buscar por nombre, cic o email/i),
      '  0000000002  ',
    );
    await waitFor(() => {
      expect(screen.getByText('0000000002')).toBeInTheDocument(); // matched despite spaces
      expect(screen.queryByText('0000000001')).not.toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('no search term → all accounts visible', () => {
    mockHooks();
    renderPage();
    expect(screen.getByText('0000000001')).toBeInTheDocument();
    expect(screen.getByText('0000000002')).toBeInTheDocument();
  });

  // ── #61 fix wave — honest cap notice ───────────────────────────────────────
  // The full-fetch loop stops at 200 accounts (MAX_PAGES*PAGE_LIMIT). When the
  // list comes back exactly full, the page warns the filter searches a subset.
  it('shows a cap notice when the fetched list hits 200 accounts (#61 fix wave)', () => {
    const capped = Array.from({ length: 200 }, (_, i) => ({
      ...accounts[0], cic: `cic-${i}`, email: `u${i}@t.com`,
    }));
    mockHooks({ allAccountsData: capped });
    renderPage();
    expect(screen.getByText(/primeras 200 cuentas/i)).toBeInTheDocument();
  });

  it('does NOT show the cap notice below the 200 limit', () => {
    mockHooks(); // 2 accounts
    renderPage();
    expect(screen.queryByText(/primeras 200 cuentas/i)).not.toBeInTheDocument();
  });

  // ── Status filter — still parametrizes useGigaredAllAccounts ───────────────
  it('passes status=registered to useGigaredAllAccounts', async () => {
    const user = userEvent.setup();
    mockHooks();
    renderPage();
    await user.selectOptions(screen.getByLabelText(/estado/i), 'registered');
    await waitFor(() =>
      expect(useGigaredAllAccounts).toHaveBeenCalledWith(
        'registered',
        true,
      ),
    );
  });

  it('passes status=unregistered to useGigaredAllAccounts', async () => {
    const user = userEvent.setup();
    mockHooks();
    renderPage();
    await user.selectOptions(screen.getByLabelText(/estado/i), 'unregistered');
    await waitFor(() =>
      expect(useGigaredAllAccounts).toHaveBeenCalledWith(
        'unregistered',
        true,
      ),
    );
  });

  // ── Error states ──────────────────────────────────────────────────────────
  it('shows the not-configured banner on GIGARED_NOT_CONFIGURED', () => {
    mockHooks({ allAccountsError: { response: { status: 503, data: { code: 'GIGARED_NOT_CONFIGURED' } } } });
    renderPage();
    expect(screen.getByText(/no está configurada/i)).toBeInTheDocument();
  });

  it('shows a retry notice on GIGARED_UNAVAILABLE', () => {
    mockHooks({ allAccountsError: { response: { status: 503, data: { code: 'GIGARED_UNAVAILABLE' } } } });
    renderPage();
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
  });

  it('shows the partner detail on GIGARED_UNAVAILABLE when present', () => {
    mockHooks({
      allAccountsError: {
        response: { status: 502, data: { code: 'GIGARED_UNAVAILABLE', detail: 'Gigared devolvió 502' } },
      },
    });
    renderPage();
    expect(screen.getByText(/gigared devolvió 502/i)).toBeInTheDocument();
  });

  it('shows an empty state when there are no accounts', () => {
    mockHooks({ allAccountsData: [] });
    renderPage();
    expect(screen.getByText(/sin cuentas/i)).toBeInTheDocument();
  });

  // ── #61 — client-side pagination ──────────────────────────────────────────
  // PAGE_SIZE=20. Filtered list drives totalPages = ceil(filtered.length / 20).
  it('client-side pagination: 2 accounts → 1 page (no pagination buttons)', () => {
    mockHooks(); // 2 accounts → ceil(2/20)=1
    renderPage();
    // With 1 page there should be no numbered pagination buttons (only page 1 which
    // the Pagination component may or may not render — just verify no page 2).
    expect(screen.queryByRole('button', { name: '2' })).not.toBeInTheDocument();
  });

  it('client-side pagination: 21 unfiltered accounts → 2 pages', () => {
    const big = Array.from({ length: 21 }, (_, i) => ({
      ...accounts[0],
      cic: `cic-${i}`,
      email: `user${i}@test.com`,
    }));
    mockHooks({ allAccountsData: big });
    renderPage();
    // ceil(21/20)=2 → page 2 button visible.
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '3' })).not.toBeInTheDocument();
  });

  it('client-side pagination: filter reduces pages', async () => {
    const user = userEvent.setup();
    // 21 accounts: only the first has name "Ana García" (from fixture accounts[0])
    const big = Array.from({ length: 21 }, (_, i) => ({
      ...accounts[0],
      cic: `cic-${i}`,
      firstName: i === 0 ? 'Ana' : 'Other',
      lastName: i === 0 ? 'García' : `User${i}`,
      email: `user${i}@test.com`,
    }));
    mockHooks({ allAccountsData: big });
    renderPage();
    // Before filter: 2 pages
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
    // Type in search — "Ana" matches only 1 account → 1 page
    await user.type(screen.getByPlaceholderText(/buscar por nombre, cic o email/i), 'Ana');
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '2' })).not.toBeInTheDocument();
    }, { timeout: 1000 });
  });
});
