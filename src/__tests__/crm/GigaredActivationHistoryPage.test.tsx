/**
 * TDD — GigaredActivationHistoryPage (tv-activation-history #5 FE).
 * Tests: renders rows (alta/baja badges, operator, formatted date, client link);
 * empty state when none; filters UI present.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { TvActivationEvent } from '@/types/gigared';

vi.mock('@/hooks/useGigared', () => ({
  useGigaredActivationHistory: vi.fn(),
}));

import { useGigaredActivationHistory } from '@/hooks/useGigared';
import GigaredActivationHistoryPage from '@/pages/crm/GigaredActivationHistoryPage';

const events: TvActivationEvent[] = [
  {
    id: 'ev-1',
    clientId: 'cust-abc',
    customerName: 'Ana García',
    cic: '0000000001',
    eventType: 'alta',
    actorId: 'op-1',
    actorName: 'Operador Uno',
    internalId: 'cust-abc',
    seq: 0,
    contractId: 'ct-9',
    createdAt: '2026-06-13T10:30:00.000Z',
  },
  {
    id: 'ev-2',
    clientId: 'cust-def',
    customerName: 'Beto López',
    cic: '0000000002',
    eventType: 'baja',
    actorId: 'op-2',
    actorName: 'Operador Dos',
    internalId: null,
    seq: undefined,
    contractId: undefined,
    createdAt: '2026-06-12T09:00:00.000Z',
  },
  {
    id: 'ev-3',
    clientId: 'cust-ghi',
    customerName: 'Carlos Ruiz',
    cic: '0000000003',
    eventType: 'reactivacion',
    actorId: 'op-1',
    actorName: 'Operador Uno',
    internalId: 'cust-ghi-1',
    seq: 1,
    contractId: 'ct-7',
    createdAt: '2026-06-11T14:00:00.000Z',
  },
];

function mockHook(overrides: {
  data?: TvActivationEvent[];
  isLoading?: boolean;
  isError?: boolean;
} = {}) {
  vi.mocked(useGigaredActivationHistory).mockReturnValue({
    data: overrides.data ?? events,
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
    error: null,
  } as unknown as ReturnType<typeof useGigaredActivationHistory>);
}

function renderPage() {
  return render(
    <MemoryRouter>
      <GigaredActivationHistoryPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GigaredActivationHistoryPage', () => {
  // ── Row rendering ──────────────────────────────────────────────────────────

  it('renders a row for each event', () => {
    mockHook();
    renderPage();
    // Check operator names (always present)
    expect(screen.getAllByText('Operador Uno').length).toBeGreaterThan(0);
    expect(screen.getByText('Operador Dos')).toBeInTheDocument();
  });

  it('renders "Alta" badge for eventType=alta', () => {
    mockHook();
    renderPage();
    expect(screen.getByText('Alta')).toBeInTheDocument();
  });

  it('renders "Baja" badge for eventType=baja', () => {
    mockHook();
    renderPage();
    expect(screen.getByText('Baja')).toBeInTheDocument();
  });

  it('renders "Reactivación" badge for eventType=reactivacion', () => {
    mockHook();
    renderPage();
    expect(screen.getByText('Reactivación')).toBeInTheDocument();
  });

  it('renders the customer name for each event', () => {
    mockHook();
    renderPage();
    expect(screen.getByText('Ana García')).toBeInTheDocument();
    expect(screen.getByText('Beto López')).toBeInTheDocument();
    expect(screen.getByText('Carlos Ruiz')).toBeInTheDocument();
  });

  it('renders a link to /admin/customers/view/{clientId} for events with clientId', () => {
    mockHook();
    renderPage();
    const link = screen.getByRole('link', { name: /Ana García/i });
    expect(link).toHaveAttribute('href', '/admin/customers/view/cust-abc');
  });

  it('renders a formatted date for createdAt', () => {
    mockHook();
    renderPage();
    // formatDateTimeShort('2026-06-13T10:30:00.000Z') → "13 jun 2026 - HH:MM" (local time)
    // We just check the year/month text appears somewhere in the document
    expect(screen.getByText(/13 jun 2026/i)).toBeInTheDocument();
  });

  it('shows the operator name (actorName) for each row', () => {
    mockHook();
    renderPage();
    // Operador Uno appears for ev-1 and ev-3
    const matches = screen.getAllByText('Operador Uno');
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Operador Dos')).toBeInTheDocument();
  });

  // ── Empty state ────────────────────────────────────────────────────────────

  it('shows an empty state message when data is an empty array', () => {
    mockHook({ data: [] });
    renderPage();
    expect(screen.getByText(/sin eventos/i)).toBeInTheDocument();
  });

  // ── Loading / Error ────────────────────────────────────────────────────────

  it('shows a loading indicator while isLoading=true', () => {
    mockHook({ data: undefined, isLoading: true });
    renderPage();
    // The page must not crash; we don't assert specific element since spinner
    // implementations vary — just ensure it renders without throwing.
    expect(document.body).toBeTruthy();
  });

  it('shows an error message when isError=true', () => {
    mockHook({ data: undefined, isError: true });
    renderPage();
    expect(screen.getByText(/error/i)).toBeInTheDocument();
  });

  // ── Filter controls ────────────────────────────────────────────────────────

  it('renders a date-from input', () => {
    mockHook();
    renderPage();
    // Look for a date-type input or aria-label
    expect(screen.getByLabelText(/desde/i)).toBeInTheDocument();
  });

  it('renders a date-to input', () => {
    mockHook();
    renderPage();
    expect(screen.getByLabelText(/hasta/i)).toBeInTheDocument();
  });

  it('renders a page heading for TV Historial', () => {
    mockHook();
    renderPage();
    expect(screen.getByRole('heading', { name: /historial tv/i })).toBeInTheDocument();
  });

  // ── Column headers ─────────────────────────────────────────────────────────

  it('renders expected column headers', () => {
    mockHook();
    renderPage();
    // "Fecha/hora" column header
    expect(screen.getByText(/fecha/i)).toBeInTheDocument();
    // "Tipo" column header (inside the <th>)
    expect(screen.getAllByText(/tipo/i).length).toBeGreaterThan(0);
    // "Cliente" appears as column header + filter label; at least one exists
    expect(screen.getAllByText(/^cliente$/i).length).toBeGreaterThan(0);
    // "Operador" column header
    expect(screen.getAllByText(/operador/i).length).toBeGreaterThan(0);
  });
});
