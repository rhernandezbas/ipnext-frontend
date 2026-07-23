/**
 * TDD — ActivationHistoryModal (#2 history modal + #5B per-client TV history).
 *
 * Contract:
 *   - open=false → not rendered
 *   - open=true → renders rows from the hook (event type badges, CIC, date, operator)
 *   - Esc / backdrop click → onClose
 *   - customerId provided → per-client hook called
 *   - customerId absent → global hook called (with filters bar)
 *   - CIC column present
 *   - role=dialog, aria-modal, aria-labelledby on the inner dialog surface
 *   - close button focuses on open
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { TvActivationEvent } from '@/types/gigared';

// ── Mock hooks ───────────────────────────────────────────────────────────────

vi.mock('@/hooks/useGigared', () => ({
  useGigaredActivationHistory: vi.fn(),
  useGigaredCustomerActivationHistory: vi.fn(),
}));

import {
  useGigaredActivationHistory,
  useGigaredCustomerActivationHistory,
} from '@/hooks/useGigared';

// Import the component AFTER mocks
import { ActivationHistoryModal } from '@/components/molecules/ActivationHistoryModal/ActivationHistoryModal';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const events: TvActivationEvent[] = [
  {
    id: 'ev-1',
    clientId: 'cust-abc',
    customerName: 'Ana García',
    cic: '1234567890',
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
    cic: '9876543210',
    eventType: 'baja',
    actorId: 'op-2',
    actorName: 'Operador Dos',
    internalId: null,
    seq: undefined,
    contractId: undefined,
    createdAt: '2026-06-12T09:00:00.000Z',
  },
];

const noopClose = vi.fn();

function mockGlobal(data: TvActivationEvent[] = events, overrides: { isLoading?: boolean } = {}) {
  vi.mocked(useGigaredActivationHistory).mockReturnValue({
    data,
    isLoading: overrides.isLoading ?? false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useGigaredActivationHistory>);
}

function mockPerClient(data: TvActivationEvent[] = events, overrides: { isLoading?: boolean } = {}) {
  vi.mocked(useGigaredCustomerActivationHistory).mockReturnValue({
    data,
    isLoading: overrides.isLoading ?? false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useGigaredCustomerActivationHistory>);
}

function renderModal(props: { open?: boolean; onClose?: () => void; customerId?: string } = {}) {
  const { open = true, onClose = noopClose, customerId } = props;
  return render(
    <MemoryRouter>
      <ActivationHistoryModal open={open} onClose={onClose} customerId={customerId} />
    </MemoryRouter>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockGlobal();
  mockPerClient();
});

describe('ActivationHistoryModal', () => {
  // ── open=false ──────────────────────────────────────────────────────────────

  it('open=false → does not render the dialog', () => {
    renderModal({ open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // ── open=true, global mode (no customerId) ──────────────────────────────────

  it('open=true without customerId → renders modal with global hook data', () => {
    renderModal();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // Rows
    expect(screen.getByText('Operador Uno')).toBeInTheDocument();
    expect(screen.getByText('Operador Dos')).toBeInTheDocument();
  });

  it('renders "Alta" badge for eventType=alta', () => {
    renderModal();
    expect(screen.getByText('Alta')).toBeInTheDocument();
  });

  it('renders "Baja" badge for eventType=baja', () => {
    renderModal();
    expect(screen.getByText('Baja')).toBeInTheDocument();
  });

  it('shows a CIC column header', () => {
    renderModal();
    // "CIC" as a table header
    expect(screen.getByText('CIC')).toBeInTheDocument();
  });

  it('shows CIC values in the rows', () => {
    renderModal();
    expect(screen.getByText('1234567890')).toBeInTheDocument();
    expect(screen.getByText('9876543210')).toBeInTheDocument();
  });

  it('global mode: shows filter bar (date inputs) when no customerId', () => {
    renderModal();
    expect(screen.getByLabelText(/desde/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/hasta/i)).toBeInTheDocument();
  });

  // ── open=true, per-client mode (customerId provided) ────────────────────────

  it('open=true with customerId → uses per-client hook, NOT global hook', () => {
    renderModal({ customerId: 'cust-123' });
    expect(useGigaredCustomerActivationHistory).toHaveBeenCalledWith('cust-123', true);
    expect(useGigaredActivationHistory).not.toHaveBeenCalled();
  });

  it('per-client mode: renders rows from per-client hook', () => {
    mockPerClient([events[0]]);
    renderModal({ customerId: 'cust-123' });
    expect(screen.getByText('Operador Uno')).toBeInTheDocument();
    // Beto López row NOT present (per-client data only has ev-1)
    expect(screen.queryByText('Operador Dos')).not.toBeInTheDocument();
  });

  it('per-client mode: does NOT show filter bar (single customer, no cross-client filters)', () => {
    renderModal({ customerId: 'cust-123' });
    expect(screen.queryByLabelText(/desde/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/hasta/i)).not.toBeInTheDocument();
  });

  // ── Accessibility / interaction ──────────────────────────────────────────────

  it('role="dialog" is on the inner dialog surface, not the backdrop', () => {
    renderModal();
    const dialog = screen.getByRole('dialog');
    // Title text must be inside the dialog
    expect(dialog).toContainElement(screen.getByText(/historial tv/i));
    // Close button must be inside the dialog
    expect(dialog).toContainElement(screen.getByLabelText('Cerrar'));
  });

  it('the dialog has aria-modal="true"', () => {
    renderModal();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('Esc key calls onClose', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking backdrop calls onClose', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    // The backdrop is the element directly behind the dialog (has the modal classes)
    // fireEvent on the portal root backdrop
    const dialog = screen.getByRole('dialog');
    const backdrop = dialog.parentElement!;
    fireEvent.mouseDown(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking the close button calls onClose', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByLabelText('Cerrar'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('close button is focused when modal opens', () => {
    renderModal();
    expect(screen.getByLabelText('Cerrar')).toHaveFocus();
  });

  // ── Empty / loading states ───────────────────────────────────────────────────

  it('shows empty state message when data is []', () => {
    mockGlobal([]);
    renderModal();
    expect(screen.getByText(/sin eventos/i)).toBeInTheDocument();
  });

  it('loading state: hook isLoading=true → modal renders without crashing', () => {
    mockGlobal([], { isLoading: true });
    renderModal();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  // ── #133-FE — Motivo column ─────────────────────────────────────────────────

  it('shows "Motivo" column header in the table', () => {
    renderModal();
    expect(screen.getByText('Motivo')).toBeInTheDocument();
  });

  it('event with reason → shows "ver" link, not the reason text inline', () => {
    const eventsWithReason: TvActivationEvent[] = [
      {
        ...events[0],
        reason: 'Solicitud del cliente',
      },
    ];
    mockGlobal(eventsWithReason);
    renderModal();
    expect(screen.getByRole('button', { name: /ver motivo/i })).toBeInTheDocument();
    expect(screen.queryByText('Solicitud del cliente')).not.toBeInTheDocument();
  });

  it('event without reason → shows "—" in the Motivo column (no link)', () => {
    const eventsNoReason: TvActivationEvent[] = [
      {
        ...events[0],
        reason: null,
      },
    ];
    mockGlobal(eventsNoReason);
    renderModal();
    expect(screen.queryByRole('button', { name: /ver motivo/i })).not.toBeInTheDocument();
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('clicking "ver" opens ReasonViewModal with the reason text', () => {
    const eventsWithReason: TvActivationEvent[] = [
      {
        ...events[0],
        reason: 'Baja por mudanza TV',
      },
    ];
    mockGlobal(eventsWithReason);
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /ver motivo/i }));
    expect(screen.getByText('Motivo de la baja')).toBeInTheDocument();
    expect(screen.getByText('Baja por mudanza TV')).toBeInTheDocument();
  });

  // ── FE-4 — gigared-tv-identity-hardening (D7): eventType 'transferencia' ──────
  // Bug detectado en el plan: EventTypeBadge NO tenía rama default — un evento
  // 'transferencia' caía en el fallback y se mostraba como "Reactivación" (mislabel).
  describe("FE-4 — badge 'transferencia' + rama default segura", () => {
    it("eventType='transferencia' → badge \"Transferencia\", NUNCA \"Reactivación\"", () => {
      const withTransfer: TvActivationEvent[] = [
        { ...events[0], eventType: 'transferencia' },
      ];
      mockGlobal(withTransfer);
      renderModal();
      expect(screen.getByText('Transferencia')).toBeInTheDocument();
      expect(screen.queryByText('Reactivación')).not.toBeInTheDocument();
    });

    it("eventType='reactivacion' sigue mostrando \"Reactivación\" (regresión)", () => {
      const withReactivacion: TvActivationEvent[] = [
        { ...events[0], eventType: 'reactivacion' },
      ];
      mockGlobal(withReactivacion);
      renderModal();
      expect(screen.getByText('Reactivación')).toBeInTheDocument();
    });

    it('un eventType futuro/desconocido → rama default segura (muestra el valor crudo, NUNCA "Reactivación")', () => {
      const withUnknown = [
        { ...events[0], eventType: 'algo-nuevo' as unknown as TvActivationEvent['eventType'] },
      ];
      mockGlobal(withUnknown);
      renderModal();
      expect(screen.queryByText('Reactivación')).not.toBeInTheDocument();
      expect(screen.queryByText('Alta')).not.toBeInTheDocument();
      expect(screen.queryByText('Baja')).not.toBeInTheDocument();
      expect(screen.queryByText('Transferencia')).not.toBeInTheDocument();
      expect(screen.getByText('algo-nuevo')).toBeInTheDocument();
    });
  });
});
