import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { GigaredAccount, GigaredSummary, ListAccountsResult } from '@/types/gigared';

vi.mock('@/hooks/useGigared', () => ({
  useGigaredSummary: vi.fn(),
  useGigaredAccounts: vi.fn(),
}));

import { useGigaredSummary, useGigaredAccounts } from '@/hooks/useGigared';
import GigaredAccountsPage from '@/pages/crm/GigaredAccountsPage';

const accounts: GigaredAccount[] = [
  {
    cic: '0000000001', gigaredId: 'g1', email: 'a@b.com', firstName: 'Ana', lastName: 'García',
    registrationDate: '2026-01-01T00:00:00Z', services: [{ id: 's1', name: 'Play Full' }],
    internalId: 'c1', ott: { id: 'o1', stationaryLicenses: 1, mobileLicenses: 0, registeredDevices: 1, status: 'active' },
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

function mockHooks(over: {
  accountsData?: ListAccountsResult;
  accountsError?: unknown;
  accountsLoading?: boolean;
} = {}) {
  vi.mocked(useGigaredSummary).mockReturnValue({
    data: summary,
    isLoading: false,
    isError: false,
  } as ReturnType<typeof useGigaredSummary>);

  vi.mocked(useGigaredAccounts).mockReturnValue({
    data: over.accountsData ?? { accounts },
    isLoading: over.accountsLoading ?? false,
    isError: !!over.accountsError,
    error: over.accountsError,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useGigaredAccounts>);
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

  it('passes the email filter to the accounts hook (debounced)', async () => {
    const user = userEvent.setup();
    mockHooks();
    renderPage();
    await user.type(screen.getByPlaceholderText(/email/i), 'a@b.com');
    await waitFor(
      () =>
        expect(useGigaredAccounts).toHaveBeenCalledWith(
          expect.objectContaining({ email: 'a@b.com' }),
        ),
      { timeout: 1000 },
    );
  });

  it('H2: passes the CIC filter to the accounts hook as accountId (debounced)', async () => {
    const user = userEvent.setup();
    mockHooks();
    renderPage();
    await user.type(screen.getByLabelText(/cic o id interno/i), 'CIC123');
    await waitFor(
      () =>
        expect(useGigaredAccounts).toHaveBeenCalledWith(
          expect.objectContaining({ accountId: 'CIC123' }),
        ),
      { timeout: 1000 },
    );
  });

  it('passes the status filter to the accounts hook', async () => {
    const user = userEvent.setup();
    mockHooks();
    renderPage();
    await user.selectOptions(screen.getByLabelText(/estado/i), 'registered');
    await waitFor(() =>
      expect(useGigaredAccounts).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'registered' }),
      ),
    );
  });

  it('shows the not-configured banner on 503 GIGARED_NOT_CONFIGURED', () => {
    mockHooks({ accountsError: { response: { status: 503, data: { code: 'GIGARED_NOT_CONFIGURED' } } } });
    renderPage();
    expect(screen.getByText(/no está configurada/i)).toBeInTheDocument();
  });

  it('shows a retry notice on 503 GIGARED_UNAVAILABLE', () => {
    mockHooks({ accountsError: { response: { status: 503, data: { code: 'GIGARED_UNAVAILABLE' } } } });
    renderPage();
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
  });

  it('shows an empty state when there are no accounts', () => {
    mockHooks({ accountsData: { accounts: [] } });
    renderPage();
    expect(screen.getByText(/sin cuentas/i)).toBeInTheDocument();
  });

  // Fix #47c-1 — the partner API caps pagination_limit at 20 (verified live
  // 2026-06-11: >20 returns 400 "La paginación tiene un límite de 20 cuentas").
  // The page MUST request at most 20 per page or the list errors out always.
  it('requests the accounts hook with paginationLimit capped at 20', () => {
    mockHooks();
    renderPage();
    expect(useGigaredAccounts).toHaveBeenCalledWith(
      expect.objectContaining({ paginationLimit: 20 }),
    );
  });

  it('a full page (20 rows) implies a next page', () => {
    const full = Array.from({ length: 20 }, (_, i) => ({
      ...accounts[0],
      cic: `cic-${i}`,
    }));
    mockHooks({ accountsData: { accounts: full } });
    renderPage();
    // With a full page the Pagination must expose a "next" affordance.
    expect(screen.getByRole('button', { name: /siguiente|next|›|»/i })).toBeInTheDocument();
  });
});
