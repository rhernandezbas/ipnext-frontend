/**
 * #127 — ServiceHistoryModal: shows reason column in the events table.
 * - When event.reason is a string → renders it.
 * - When event.reason is null or undefined → renders '—'.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ServiceHistoryModal } from '../../components/molecules/ServiceHistoryModal/ServiceHistoryModal';
import type { ServiceHistoryEntry } from '../../types/customer';

vi.mock('@/hooks/useContractServiceHistory');
import { useContractServiceHistory } from '@/hooks/useContractServiceHistory';
const mockUseHistory = vi.mocked(useContractServiceHistory);

const entryWithReason: ServiceHistoryEntry = {
  id: 'e1',
  contractId: 'c1',
  serviceCatalogId: 's1',
  name: 'FIBER',
  label: 'Fibra Óptica',
  status: 'inactive',
  notes: null,
  tvLogin: null,
  createdAt: '2024-01-01T00:00:00Z',
  deactivatedAt: '2024-06-01T00:00:00Z',
  events: [
    {
      id: 'ev1',
      eventType: 'activated',
      occurredAt: '2024-01-01T10:00:00',
      actorName: 'Operador A',
      cic: null,
      reason: 'Alta nueva',
    },
    {
      id: 'ev2',
      eventType: 'deactivated',
      occurredAt: '2024-06-01T14:00:00',
      actorName: 'Operador B',
      cic: null,
      reason: 'Equipo retirado por mora',
    },
  ],
};

const entryWithNullReason: ServiceHistoryEntry = {
  id: 'e2',
  contractId: 'c1',
  serviceCatalogId: 's1',
  name: 'FIBER',
  label: 'Fibra Legacy',
  status: 'inactive',
  notes: null,
  tvLogin: null,
  createdAt: '2023-01-01T00:00:00Z',
  deactivatedAt: '2023-12-01T00:00:00Z',
  events: [
    {
      id: 'ev3',
      eventType: 'deactivated',
      occurredAt: '2023-12-01T10:00:00',
      actorName: 'Operador C',
      cic: null,
      reason: null,
    },
  ],
};

describe('ServiceHistoryModal — #127 reason column', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows "Motivo" column header when events are present', () => {
    mockUseHistory.mockReturnValue({ data: [entryWithReason], isLoading: false } as any);
    render(<ServiceHistoryModal open onClose={vi.fn()} contractId="c1" />);
    expect(screen.getByText('Motivo')).toBeInTheDocument();
  });

  it('renders the reason text for events that have one (via "ver" button → ReasonViewModal)', () => {
    // #132 — reasons are no longer rendered as plain text inline.
    // Each event with a reason shows a "ver" button; clicking it opens ReasonViewModal.
    mockUseHistory.mockReturnValue({ data: [entryWithReason], isLoading: false } as any);
    render(<ServiceHistoryModal open onClose={vi.fn()} contractId="c1" />);

    // Both events have reasons → two "ver" buttons
    const verButtons = screen.getAllByRole('button', { name: /ver motivo/i });
    expect(verButtons.length).toBe(2);

    // Reason text is NOT visible inline
    expect(screen.queryByText('Alta nueva')).not.toBeInTheDocument();
    expect(screen.queryByText('Equipo retirado por mora')).not.toBeInTheDocument();

    // Click first "ver" → ReasonViewModal shows "Alta nueva"
    fireEvent.click(verButtons[0]);
    expect(screen.getByText('Alta nueva')).toBeInTheDocument();
  });

  it('renders "—" for events with reason=null (legacy events)', () => {
    mockUseHistory.mockReturnValue({ data: [entryWithNullReason], isLoading: false } as any);
    render(<ServiceHistoryModal open onClose={vi.fn()} contractId="c1" />);
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  // FIX 2 — nested Escape: ReasonViewModal captures Escape BEFORE the history
  // modal's bubble-phase listener, so only ReasonViewModal closes.
  it('Escape with ReasonViewModal open closes only ReasonViewModal, not ServiceHistoryModal', () => {
    const onClose = vi.fn();
    mockUseHistory.mockReturnValue({ data: [entryWithReason], isLoading: false } as any);
    render(<ServiceHistoryModal open onClose={onClose} contractId="c1" />);

    // Open ReasonViewModal by clicking "ver"
    const verButtons = screen.getAllByRole('button', { name: /ver motivo/i });
    fireEvent.click(verButtons[0]);

    // ReasonViewModal is now open — dialog title is visible
    expect(screen.getByText('Motivo de la baja')).toBeInTheDocument();

    // Press Escape — should close only ReasonViewModal
    fireEvent.keyDown(document, { key: 'Escape' });

    // ReasonViewModal is gone
    expect(screen.queryByText('Motivo de la baja')).not.toBeInTheDocument();

    // ServiceHistoryModal onClose was NOT called
    expect(onClose).not.toHaveBeenCalled();

    // ServiceHistoryModal is still present
    expect(screen.getByText('Historial de servicios')).toBeInTheDocument();
  });
});
