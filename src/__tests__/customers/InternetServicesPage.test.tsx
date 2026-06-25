import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { PppoeServiceListResult } from '@/types/internetService';

vi.mock('@/hooks/useInternetServices', () => ({
  useAllPppoe: vi.fn(),
}));

// Stub the modal so we can assert it opens without rendering internals.
// data-client refleja el clientId; en modo global (sin clientId) queda "global".
vi.mock('@/components/molecules/InternetActivationHistoryModal/InternetActivationHistoryModal', () => ({
  InternetActivationHistoryModal: ({ open, onClose, clientId }: { open: boolean; onClose: () => void; clientId?: string }) =>
    open ? (
      <div data-testid="internet-history-modal" data-client={clientId ?? 'global'}>
        <button onClick={onClose}>modal-close</button>
      </div>
    ) : null,
}));

import { useAllPppoe } from '@/hooks/useInternetServices';
import InternetServicesPage from '@/pages/customers/InternetServicesPage';

const result: PppoeServiceListResult = {
  data: [
    {
      id: 'p1',
      username: 'juan.perez',
      clientId: 'client-1',
      customerName: 'Juan Pérez',
      status: 'active',
      profile: '50M',
      nasId: 'nas-1',
      createdBy: 'operador1',
      createdAt: '2026-06-01T10:00:00Z',
    },
    {
      id: 'p2',
      username: 'maria.gomez',
      clientId: null,
      customerName: null,
      status: 'baja',
      profile: null,
      nasId: 'nas-2',
      createdBy: null,
      createdAt: '2026-05-01T10:00:00Z',
    },
    {
      id: 'p3',
      username: 'pedro.ruiz',
      clientId: 'client-3',
      customerName: 'Pedro Ruiz',
      status: 'reduced',
      profile: '10M',
      nasId: 'nas-1',
      createdBy: 'operador2',
      createdAt: '2026-04-01T10:00:00Z',
    },
  ],
  total: 3,
  page: 1,
  limit: 20,
};

function mockList(over: { data?: PppoeServiceListResult; isLoading?: boolean; isError?: boolean } = {}) {
  vi.mocked(useAllPppoe).mockReturnValue({
    data: over.data ?? result,
    isLoading: over.isLoading ?? false,
    isError: over.isError ?? false,
    error: undefined,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useAllPppoe>);
}

function renderPage() {
  return render(
    <MemoryRouter>
      <InternetServicesPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('InternetServicesPage', () => {
  it('renders the page title', () => {
    mockList();
    renderPage();
    expect(screen.getByRole('heading', { name: /servicios de internet|internet/i })).toBeInTheDocument();
  });

  it('renders the expected column headers', () => {
    mockList();
    renderPage();
    expect(screen.getByText('Cliente')).toBeInTheDocument();
    expect(screen.getByText(/usuario pppoe/i)).toBeInTheDocument();
    expect(screen.getByText('Plan')).toBeInTheDocument();
    expect(screen.getByText('Estado')).toBeInTheDocument();
    expect(screen.getByText(/creado por/i)).toBeInTheDocument();
    expect(screen.getByText('Fecha')).toBeInTheDocument();
  });

  it('renders one row per service item', () => {
    mockList();
    renderPage();
    expect(screen.getByText('juan.perez')).toBeInTheDocument();
    expect(screen.getByText('maria.gomez')).toBeInTheDocument();
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    expect(screen.getByText('operador1')).toBeInTheDocument();
  });

  it('links the customer name to the customer view when clientId is present', () => {
    mockList();
    renderPage();
    const link = screen.getByRole('link', { name: /Juan Pérez/i });
    expect(link).toHaveAttribute('href', '/admin/customers/view/client-1');
  });

  it('renders the customer name as plain text when clientId is null', () => {
    mockList();
    renderPage();
    // p2 has clientId null and customerName null → shows a dash, not a link.
    expect(screen.queryByRole('link', { name: /maria/i })).not.toBeInTheDocument();
  });

  it('renders the status as a badge with a human label', () => {
    mockList();
    renderPage();
    // "Activo"/"Baja"/"Reducido" also appear as <option>s in the status filter;
    // scope to the table rows (the badge is rendered inside a <td>, not an <option>).
    const cells = screen.getAllByRole('cell');
    const cellTexts = cells.map((c) => c.textContent);
    expect(cellTexts).toContain('Activo');
    expect(cellTexts).toContain('Baja');
    expect(cellTexts).toContain('Reducido');
  });

  // ── Filtros server-side: el valor DEBE llegar al hook (round-trip del seam) ──
  it('round-trip: typing in the search box passes search to useAllPppoe (debounced)', async () => {
    const user = userEvent.setup();
    mockList();
    renderPage();
    await user.type(screen.getByPlaceholderText(/buscar/i), 'juan');
    await waitFor(
      () => expect(useAllPppoe).toHaveBeenCalledWith(expect.objectContaining({ search: 'juan' })),
      { timeout: 1000 },
    );
  });

  it('round-trip: selecting a status passes status to useAllPppoe', async () => {
    const user = userEvent.setup();
    mockList();
    renderPage();
    await user.selectOptions(screen.getByLabelText(/estado/i), 'baja');
    await waitFor(() =>
      expect(useAllPppoe).toHaveBeenCalledWith(expect.objectContaining({ status: 'baja' })),
    );
  });

  // ── El catálogo de estado DEBE ser el status de NEGOCIO computed del PppoeService,
  //    NO el de Contract. Vocabulario acordado: active|reduced|blocked|baja|inactive ──
  it('status filter offers exactly the computed business vocabulary (active|reduced|blocked|baja|inactive)', () => {
    mockList();
    renderPage();
    const select = screen.getByLabelText(/estado/i) as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    // includes the empty "all" option + the 5 business statuses
    expect(values).toContain('');
    expect(values).toContain('active');
    expect(values).toContain('reduced');
    expect(values).toContain('blocked');
    expect(values).toContain('baja');
    expect(values).toContain('inactive');
    // 5 statuses + the "all" option, nothing else
    expect(values).toHaveLength(6);
    // NOT the Contract-only value we wrongly copied
    expect(values).not.toContain('new');
    // NOT a legacy/RADIUS enum value
    expect(values).not.toContain('enabled');
    expect(values).not.toContain('disabled');
    expect(values).not.toContain('late');
  });

  // ── Paginación server-side: usa total/page/limit del endpoint ──
  it('shows page 2 control when total exceeds the page limit', () => {
    mockList({ data: { ...result, total: 45, page: 1, limit: 20 } });
    renderPage();
    // ceil(45/20) = 3 pages → page 2 + 3 buttons present.
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '3' })).toBeInTheDocument();
  });

  it('does not show pagination when total fits in one page', () => {
    mockList({ data: { ...result, total: 2, page: 1, limit: 20 } });
    renderPage();
    expect(screen.queryByRole('button', { name: '2' })).not.toBeInTheDocument();
  });

  it('round-trip: clicking page 2 passes page=2 to useAllPppoe', async () => {
    const user = userEvent.setup();
    mockList({ data: { ...result, total: 45, page: 1, limit: 20 } });
    renderPage();
    await user.click(screen.getByRole('button', { name: '2' }));
    await waitFor(() =>
      expect(useAllPppoe).toHaveBeenCalledWith(expect.objectContaining({ page: 2 })),
    );
  });

  // ── Loading / empty / error states ──
  it('shows an empty state when there are no services', () => {
    mockList({ data: { data: [], total: 0, page: 1, limit: 20 } });
    renderPage();
    expect(screen.getByText(/sin servicios/i)).toBeInTheDocument();
  });

  it('shows an error banner when the query errors', () => {
    mockList({ isError: true, data: undefined });
    renderPage();
    expect(screen.getByText(/error al cargar/i)).toBeInTheDocument();
  });

  it('does not show the empty state while loading', () => {
    mockList({ isLoading: true, data: undefined });
    renderPage();
    expect(screen.queryByText(/sin servicios/i)).not.toBeInTheDocument();
  });

  // ── "Ver historial" por fila abre el modal con el clientId de la fila ──
  // Las acciones por fila viven dentro de celdas (<td>); el botón global vive en
  // el header. Scopeamos a las celdas para no agarrar el del header.
  function rowHistoryButtons() {
    return screen
      .getAllByRole('button', { name: /ver historial/i })
      .filter((b) => b.closest('td') !== null);
  }

  it('renders a "Ver historial" action per row', () => {
    mockList();
    renderPage();
    expect(rowHistoryButtons().length).toBeGreaterThan(0);
  });

  it('clicking "Ver historial" opens the modal with the row clientId', async () => {
    const user = userEvent.setup();
    mockList();
    renderPage();
    expect(screen.queryByTestId('internet-history-modal')).not.toBeInTheDocument();
    await user.click(rowHistoryButtons()[0]);
    const modal = screen.getByTestId('internet-history-modal');
    expect(modal).toBeInTheDocument();
    expect(modal).toHaveAttribute('data-client', 'client-1');
  });

  it('closing the modal hides it', async () => {
    const user = userEvent.setup();
    mockList();
    renderPage();
    await user.click(rowHistoryButtons()[0]);
    expect(screen.getByTestId('internet-history-modal')).toBeInTheDocument();
    await user.click(screen.getByText('modal-close'));
    expect(screen.queryByTestId('internet-history-modal')).not.toBeInTheDocument();
  });

  // ── "Ver historial" GLOBAL en el header → abre el modal SIN clientId ──
  it('renders a "Ver historial" button in the header', () => {
    mockList();
    renderPage();
    const header = screen.getByRole('heading', { name: /servicios de internet/i }).closest('div')!;
    // El botón del header convive con los "Ver historial" por fila; el del header
    // vive junto al título.
    const headerBtn = within(header).getByRole('button', { name: /ver historial/i });
    expect(headerBtn).toBeInTheDocument();
  });

  it('clicking the header "Ver historial" opens the modal in GLOBAL mode (no clientId)', async () => {
    const user = userEvent.setup();
    mockList();
    renderPage();
    expect(screen.queryByTestId('internet-history-modal')).not.toBeInTheDocument();
    const header = screen.getByRole('heading', { name: /servicios de internet/i }).closest('div')!;
    await user.click(within(header).getByRole('button', { name: /ver historial/i }));
    const modal = screen.getByTestId('internet-history-modal');
    expect(modal).toBeInTheDocument();
    // Modo global → sin clientId (el stub lo refleja como "global").
    expect(modal).toHaveAttribute('data-client', 'global');
  });
});
