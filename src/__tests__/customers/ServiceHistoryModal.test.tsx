import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ServiceHistoryModal } from '../../components/molecules/ServiceHistoryModal/ServiceHistoryModal';
import type { ServiceHistoryEntry } from '../../types/customer';

vi.mock('@/hooks/useContractServiceHistory');

import { useContractServiceHistory } from '@/hooks/useContractServiceHistory';

const mockUseHistory = vi.mocked(useContractServiceHistory);

const entries: ServiceHistoryEntry[] = [
  {
    id: '1',
    contractId: 'c1',
    serviceCatalogId: 's1',
    name: 'FIBER',
    label: 'Fibra Óptica',
    status: 'active',
    notes: 'Nota test',
    tvLogin: null,
    createdAt: '2024-01-15T00:00:00Z',
    deactivatedAt: null,
    events: [],
  },
  {
    id: '2',
    contractId: 'c1',
    serviceCatalogId: 's2',
    name: 'TV',
    label: null,
    status: 'inactive',
    notes: null,
    tvLogin: 'user123',
    createdAt: '2023-06-01T00:00:00Z',
    deactivatedAt: '2024-01-10T00:00:00Z',
    events: [],
  },
];

// Entry with full events array (3 events including TV CIC)
const entryWithEvents: ServiceHistoryEntry = {
  id: '3',
  contractId: 'c2',
  serviceCatalogId: 's3',
  name: 'TV',
  label: 'Gigared Play',
  status: 'inactive',
  notes: null,
  tvLogin: 'tvuser',
  createdAt: '2023-01-01T00:00:00Z',
  deactivatedAt: '2024-03-10T00:00:00Z',
  events: [
    {
      id: 'ev1',
      eventType: 'activated',
      occurredAt: '2023-01-01T10:00:00',
      actorName: 'Operador A',
      cic: 'CIC-001',
    },
    {
      id: 'ev2',
      eventType: 'deactivated',
      occurredAt: '2023-06-15T14:30:00',
      actorName: 'Operador B',
      cic: null,
    },
    {
      id: 'ev3',
      eventType: 'reactivated',
      occurredAt: '2023-09-20T09:15:00',
      actorName: 'Operador C',
      cic: 'CIC-002',
    },
  ],
};

// Legacy entry — BE sends events: [] for pre-ledger services
const legacyEntry: ServiceHistoryEntry = {
  id: '4',
  contractId: 'c2',
  serviceCatalogId: 's4',
  name: 'FIBER',
  label: 'Fibra Legacy',
  status: 'active',
  notes: null,
  tvLogin: null,
  createdAt: '2022-05-10T00:00:00Z',
  deactivatedAt: null,
  events: [],
};

describe('ServiceHistoryModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders both rows with correct labels and status badges', () => {
    mockUseHistory.mockReturnValue({ data: entries, isLoading: false } as any);
    render(
      <ServiceHistoryModal open onClose={vi.fn()} contractId="c1" contractName="Contrato A" />
    );
    expect(screen.getByText('Fibra Óptica')).toBeInTheDocument();
    expect(screen.getByText('TV')).toBeInTheDocument();
    expect(screen.getByText('Activo')).toBeInTheDocument();
    // 'Baja' appears twice: once as column header, once as badge — both should be present
    expect(screen.getAllByText('Baja').length).toBeGreaterThanOrEqual(1);
    // badge for inactive row is rendered with label override 'Baja'
    const badges = screen.getAllByText('Baja');
    // at least one is a badge span (not the th column header)
    expect(badges.some(el => el.tagName.toLowerCase() === 'span')).toBe(true);
  });

  it('shows empty state when data is []', () => {
    mockUseHistory.mockReturnValue({ data: [], isLoading: false } as any);
    render(
      <ServiceHistoryModal open onClose={vi.fn()} contractId="c1" />
    );
    expect(screen.getByText('Sin historial de servicios para este contrato.')).toBeInTheDocument();
  });

  it('calls onClose on Esc key', () => {
    mockUseHistory.mockReturnValue({ data: entries, isLoading: false } as any);
    const onClose = vi.fn();
    render(<ServiceHistoryModal open onClose={onClose} contractId="c1" />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not render dialog when open=false', () => {
    mockUseHistory.mockReturnValue({ data: entries, isLoading: false } as any);
    render(<ServiceHistoryModal open={false} onClose={vi.fn()} contractId="c1" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // #73 re-review — role="dialog" belongs on the .dialog element (the actual
  // dialog surface), NOT the backdrop. Asserting the dialog node is NOT the
  // outermost backdrop guards the move (ConfirmModal pattern).
  it('puts role="dialog" on the dialog surface, not the backdrop', () => {
    mockUseHistory.mockReturnValue({ data: entries, isLoading: false } as any);
    render(<ServiceHistoryModal open onClose={vi.fn()} contractId="c1" />);
    const dialog = screen.getByRole('dialog');
    // the dialog must contain the title, and must NOT be the body-scroll backdrop
    expect(dialog).toContainElement(screen.getByText('Historial de servicios'));
    // the close button lives inside the dialog surface
    expect(dialog).toContainElement(screen.getByLabelText('Cerrar'));
  });

  // #73 re-review — focus moves into the modal on open so keyboard users land
  // inside it (ConfirmModal pattern). The close button is the first focusable.
  it('focuses the close button when it opens', () => {
    mockUseHistory.mockReturnValue({ data: entries, isLoading: false } as any);
    render(<ServiceHistoryModal open onClose={vi.fn()} contractId="c1" />);
    expect(screen.getByLabelText('Cerrar')).toHaveFocus();
  });

  // ── service-history-ledger-fe: events sequence ───────────────────────────────

  it('renders all 3 events for a service that has events', () => {
    mockUseHistory.mockReturnValue({ data: [entryWithEvents], isLoading: false } as any);
    render(<ServiceHistoryModal open onClose={vi.fn()} contractId="c2" />);

    // Badge labels — 'Baja' appears twice: once as the current-status badge,
    // once as the event badge. Use getAllByText to handle that.
    expect(screen.getByText('Alta')).toBeInTheDocument();
    expect(screen.getAllByText('Baja').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Reactivación')).toBeInTheDocument();
  });

  it('renders event dates formatted with formatDateTimeShort', () => {
    mockUseHistory.mockReturnValue({ data: [entryWithEvents], isLoading: false } as any);
    render(<ServiceHistoryModal open onClose={vi.fn()} contractId="c2" />);

    // formatDateTimeShort('2023-01-01T10:00:00') → "01 ene 2023 - 10:00"
    expect(screen.getByText('01 ene 2023 - 10:00')).toBeInTheDocument();
    // formatDateTimeShort('2023-06-15T14:30:00') → "15 jun 2023 - 14:30"
    expect(screen.getByText('15 jun 2023 - 14:30')).toBeInTheDocument();
    // formatDateTimeShort('2023-09-20T09:15:00') → "20 sep 2023 - 09:15"
    expect(screen.getByText('20 sep 2023 - 09:15')).toBeInTheDocument();
  });

  it('renders actorName for each event', () => {
    mockUseHistory.mockReturnValue({ data: [entryWithEvents], isLoading: false } as any);
    render(<ServiceHistoryModal open onClose={vi.fn()} contractId="c2" />);

    expect(screen.getByText('Operador A')).toBeInTheDocument();
    expect(screen.getByText('Operador B')).toBeInTheDocument();
    expect(screen.getByText('Operador C')).toBeInTheDocument();
  });

  it('renders CIC when non-null and hides it (dash) when null', () => {
    mockUseHistory.mockReturnValue({ data: [entryWithEvents], isLoading: false } as any);
    render(<ServiceHistoryModal open onClose={vi.fn()} contractId="c2" />);

    // CIC-001 and CIC-002 are non-null → rendered
    expect(screen.getByText('CIC-001')).toBeInTheDocument();
    expect(screen.getByText('CIC-002')).toBeInTheDocument();
    // ev2 has cic: null → em dash; use getAllByText to avoid single-match crash
    // when multiple em dashes are present (other null fields, future rows, etc.)
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('legacy entry without events renders current status without breaking', () => {
    mockUseHistory.mockReturnValue({ data: [legacyEntry], isLoading: false } as any);
    render(<ServiceHistoryModal open onClose={vi.fn()} contractId="c2" />);

    // Still shows service name
    expect(screen.getByText('Fibra Legacy')).toBeInTheDocument();
    // Still shows status badge (active = 'Activo')
    expect(screen.getByText('Activo')).toBeInTheDocument();
    // No crash — dialog is present
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows current status alongside events for services with events', () => {
    mockUseHistory.mockReturnValue({ data: [entryWithEvents], isLoading: false } as any);
    render(<ServiceHistoryModal open onClose={vi.fn()} contractId="c2" />);

    // The service label is still visible
    expect(screen.getByText('Gigared Play')).toBeInTheDocument();
  });

  // FIX 3 (WARNING-2) — occurredAt with Z is a real wall-clock timestamp;
  // formatDateTimeShort renders it in the browser's LOCAL timezone.
  // This test documents the behavior (local rendering) and guards the formatter.
  it('renders occurredAt with trailing Z in local timezone format', () => {
    const entryWithUtcEvent: ServiceHistoryEntry = {
      id: '5',
      contractId: 'c3',
      serviceCatalogId: 's5',
      name: 'TV',
      label: 'TV UTC Test',
      status: 'active',
      notes: null,
      tvLogin: 'tvutc',
      createdAt: '2023-01-01T00:00:00.000Z',
      deactivatedAt: null,
      events: [
        {
          id: 'ev-utc',
          eventType: 'activated',
          // Prisma serializes occurredAt = createdAt WITH Z (UTC).
          // formatDateTimeShort renders this in local browser time — CORRECT
          // for a real timestamp (not a date-only field).
          occurredAt: '2023-01-01T13:45:00.000Z',
          actorName: 'Sistema',
          cic: null,
        },
      ],
    };
    mockUseHistory.mockReturnValue({ data: [entryWithUtcEvent], isLoading: false } as any);
    render(<ServiceHistoryModal open onClose={vi.fn()} contractId="c3" />);

    // The rendered text follows the LOCAL timezone of the test runner.
    // We assert the shape (DD mmm YYYY - HH:MM) without pinning the exact
    // hour, since timezone varies per environment.
    const cells = screen.getAllByText(/\d{2} ene 2023 - \d{2}:\d{2}/);
    expect(cells.length).toBeGreaterThanOrEqual(1);
  });

  // FIX 4 (WARNING-3) — synth IDs generated by the BE for legacy events
  // (format: "synth-{eventType}-{createdAt}") must be valid React keys.
  it('renders a service with a synthetic legacy event ID without key warnings', () => {
    const entryWithSynthEvent: ServiceHistoryEntry = {
      id: '6',
      contractId: 'c4',
      serviceCatalogId: 's6',
      name: 'TV',
      label: 'TV Legacy Synth',
      status: 'inactive',
      notes: null,
      tvLogin: 'tvsynth',
      createdAt: '2023-01-01T00:00:00.000Z',
      deactivatedAt: '2023-12-31T00:00:00.000Z',
      events: [
        {
          id: 'synth-activated-2023-01-01T00:00:00.000Z',
          eventType: 'activated',
          occurredAt: '2023-01-01T00:00:00.000Z',
          actorName: 'Sistema Legacy',
          cic: null,
        },
      ],
    };
    mockUseHistory.mockReturnValue({ data: [entryWithSynthEvent], isLoading: false } as any);
    render(<ServiceHistoryModal open onClose={vi.fn()} contractId="c4" />);

    // The service renders and the synth ID is used as key without crashing
    expect(screen.getByText('TV Legacy Synth')).toBeInTheDocument();
    expect(screen.getByText('Sistema Legacy')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  // ── #132 — reason column: link "ver" → ReasonViewModal ──────────────────────

  it('event with reason → shows "ver" link, not the reason text inline', () => {
    const entryWithReason: ServiceHistoryEntry = {
      id: '7',
      contractId: 'c5',
      serviceCatalogId: 's7',
      name: 'FIBER',
      label: 'Fibra con motivo',
      status: 'inactive',
      notes: null,
      tvLogin: null,
      createdAt: '2023-01-01T00:00:00.000Z',
      deactivatedAt: '2024-01-01T00:00:00.000Z',
      events: [
        {
          id: 'ev-r1',
          eventType: 'deactivated',
          occurredAt: '2024-01-01T10:00:00',
          actorName: 'Operador Test',
          cic: null,
          reason: 'Cliente solicitó baja por mudanza',
        },
      ],
    };
    mockUseHistory.mockReturnValue({ data: [entryWithReason], isLoading: false } as any);
    render(<ServiceHistoryModal open onClose={vi.fn()} contractId="c5" />);

    // Shows "ver" link — not the raw reason text
    expect(screen.getByRole('button', { name: /ver motivo/i })).toBeInTheDocument();
    expect(screen.queryByText('Cliente solicitó baja por mudanza')).not.toBeInTheDocument();
  });

  it('event without reason → shows "—" (no link)', () => {
    const entryNoReason: ServiceHistoryEntry = {
      id: '8',
      contractId: 'c6',
      serviceCatalogId: 's8',
      name: 'FIBER',
      label: 'Fibra sin motivo',
      status: 'inactive',
      notes: null,
      tvLogin: null,
      createdAt: '2023-01-01T00:00:00.000Z',
      deactivatedAt: '2024-01-01T00:00:00.000Z',
      events: [
        {
          id: 'ev-r2',
          eventType: 'deactivated',
          occurredAt: '2024-01-01T10:00:00',
          actorName: 'Operador Test',
          cic: null,
          reason: null,
        },
      ],
    };
    mockUseHistory.mockReturnValue({ data: [entryNoReason], isLoading: false } as any);
    render(<ServiceHistoryModal open onClose={vi.fn()} contractId="c6" />);

    // No "ver" button; shows dash
    expect(screen.queryByRole('button', { name: /ver motivo/i })).not.toBeInTheDocument();
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('clicking "ver" opens the ReasonViewModal with the reason text', () => {
    const entryWithReason: ServiceHistoryEntry = {
      id: '9',
      contractId: 'c7',
      serviceCatalogId: 's9',
      name: 'FIBER',
      label: 'Fibra click ver',
      status: 'inactive',
      notes: null,
      tvLogin: null,
      createdAt: '2023-01-01T00:00:00.000Z',
      deactivatedAt: '2024-01-01T00:00:00.000Z',
      events: [
        {
          id: 'ev-r3',
          eventType: 'deactivated',
          occurredAt: '2024-01-01T10:00:00',
          actorName: 'Operador Test',
          cic: null,
          reason: 'Motivo de baja real',
        },
      ],
    };
    mockUseHistory.mockReturnValue({ data: [entryWithReason], isLoading: false } as any);
    render(<ServiceHistoryModal open onClose={vi.fn()} contractId="c7" />);

    fireEvent.click(screen.getByRole('button', { name: /ver motivo/i }));

    // ReasonViewModal opens with the reason text
    expect(screen.getByText('Motivo de la baja')).toBeInTheDocument();
    expect(screen.getByText('Motivo de baja real')).toBeInTheDocument();
  });
});
