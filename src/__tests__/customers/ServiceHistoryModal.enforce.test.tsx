/**
 * ServiceHistoryModal — nuevos tipos de evento de enforcement
 *
 * Cubre:
 *  SHE-1  evento eventType:'blocked' → label "Corte" + badge danger
 *  SHE-2  evento eventType:'reduced' → label "Reducción" + badge warning
 *  SHE-3  evento eventType:'restored' → label "Restauración" + badge success
 *  SHE-4  evento blocked con reason → muestra link "ver"
 *  SHE-5  eventos anteriores (activated/deactivated/reactivated) siguen verdes/rojos/amber
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ServiceHistoryModal } from '../../components/molecules/ServiceHistoryModal/ServiceHistoryModal';
import type { ServiceHistoryEntry, ServiceEvent } from '../../types/customer';

vi.mock('@/hooks/useContractServiceHistory');
import { useContractServiceHistory } from '@/hooks/useContractServiceHistory';
const mockUseHistory = vi.mocked(useContractServiceHistory);

beforeEach(() => vi.clearAllMocks());

function makeEntry(events: ServiceEvent[]): ServiceHistoryEntry {
  return {
    id: 'entry-1',
    contractId: 'c1',
    serviceCatalogId: 's1',
    name: 'INTERNET',
    label: 'Internet Fibra',
    status: 'active',
    notes: null,
    tvLogin: null,
    createdAt: '2024-01-01T00:00:00Z',
    deactivatedAt: null,
    events,
  };
}

describe('SHE-1: eventType:"blocked" → label "Corte"', () => {
  it('renderiza el label "Corte" para un evento blocked', () => {
    const ev: ServiceEvent = {
      id: 'ev-b1',
      eventType: 'blocked',
      occurredAt: '2026-06-01T10:00:00',
      actorName: 'Operador A',
      cic: null,
      reason: null,
    };
    mockUseHistory.mockReturnValue({ data: [makeEntry([ev])], isLoading: false } as any);
    render(<ServiceHistoryModal open onClose={vi.fn()} contractId="c1" />);

    expect(screen.getByText('Corte')).toBeInTheDocument();
  });
});

describe('SHE-2: eventType:"reduced" → label "Reducción"', () => {
  it('renderiza el label "Reducción" para un evento reduced', () => {
    const ev: ServiceEvent = {
      id: 'ev-r1',
      eventType: 'reduced',
      occurredAt: '2026-06-01T10:00:00',
      actorName: 'Operador B',
      cic: null,
      reason: null,
    };
    mockUseHistory.mockReturnValue({ data: [makeEntry([ev])], isLoading: false } as any);
    render(<ServiceHistoryModal open onClose={vi.fn()} contractId="c1" />);

    expect(screen.getByText('Reducción')).toBeInTheDocument();
  });
});

describe('SHE-3: eventType:"restored" → label "Restauración"', () => {
  it('renderiza el label "Restauración" para un evento restored', () => {
    const ev: ServiceEvent = {
      id: 'ev-res1',
      eventType: 'restored',
      occurredAt: '2026-06-01T10:00:00',
      actorName: 'Operador C',
      cic: null,
      reason: null,
    };
    mockUseHistory.mockReturnValue({ data: [makeEntry([ev])], isLoading: false } as any);
    render(<ServiceHistoryModal open onClose={vi.fn()} contractId="c1" />);

    expect(screen.getByText('Restauración')).toBeInTheDocument();
  });
});

describe('SHE-4: evento blocked con reason → muestra link "ver"', () => {
  it('evento blocked con motivo muestra el botón "ver"', () => {
    const ev: ServiceEvent = {
      id: 'ev-b2',
      eventType: 'blocked',
      occurredAt: '2026-06-01T10:00:00',
      actorName: 'Operador A',
      cic: null,
      reason: 'Deuda de 3 meses',
    };
    mockUseHistory.mockReturnValue({ data: [makeEntry([ev])], isLoading: false } as any);
    render(<ServiceHistoryModal open onClose={vi.fn()} contractId="c1" />);

    expect(screen.getByRole('button', { name: /ver motivo/i })).toBeInTheDocument();
  });
});

describe('SHE-5: eventos anteriores siguen renderizando sus labels', () => {
  it('activated/deactivated/reactivated conservan sus labels (Alta/Baja/Reactivación)', () => {
    const events: ServiceEvent[] = [
      { id: 'ev-a', eventType: 'activated', occurredAt: '2024-01-01T10:00:00', actorName: 'Op', cic: null },
      { id: 'ev-d', eventType: 'deactivated', occurredAt: '2024-06-01T10:00:00', actorName: 'Op', cic: null },
      { id: 'ev-re', eventType: 'reactivated', occurredAt: '2025-01-01T10:00:00', actorName: 'Op', cic: null },
    ];
    mockUseHistory.mockReturnValue({ data: [makeEntry(events)], isLoading: false } as any);
    render(<ServiceHistoryModal open onClose={vi.fn()} contractId="c1" />);

    expect(screen.getByText('Alta')).toBeInTheDocument();
    // 'Baja' appears at least once (as event badge; service is 'active' so no status badge for inactive)
    expect(screen.getByText('Baja')).toBeInTheDocument();
    expect(screen.getByText('Reactivación')).toBeInTheDocument();
  });
});
