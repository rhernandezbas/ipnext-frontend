/**
 * ServiceHistoryModal — eventos de transferencia (service-transfer W4)
 *
 * Cubre:
 *  SHT-1  changeKind:'transfer-out' → "⇄ Transferido a {newValue}" + badge "Transferencia"
 *  SHT-2  changeKind:'transfer-in'  → "⇄ Recibido por transferencia de {oldValue}"
 *  SHT-3  notes con "pendiente de regularizar" → badge ámbar "Tal cual — pendiente de regularizar"
 *  SHT-4  'modified' SIN changeKind de transfer → sigue mostrando "Cambio de plan" (sin regresión)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ServiceHistoryModal } from '@/components/molecules/ServiceHistoryModal/ServiceHistoryModal';
import type { ServiceHistoryEntry, ServiceEvent } from '@/types/customer';

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

function makeEvent(overrides: Partial<ServiceEvent>): ServiceEvent {
  return {
    id: 'ev-1',
    eventType: 'modified',
    occurredAt: '2026-07-10T10:00:00',
    actorName: 'Operador A',
    cic: null,
    reason: null,
    ...overrides,
  };
}

function renderWith(events: ServiceEvent[]) {
  mockUseHistory.mockReturnValue({ data: [makeEntry(events)], isLoading: false } as never);
  render(<ServiceHistoryModal open onClose={vi.fn()} contractId="c1" />);
}

describe('SHT-1: transfer-out', () => {
  it('muestra "⇄ Transferido a {newValue}" y el badge Transferencia', () => {
    renderWith([
      makeEvent({
        changeKind: 'transfer-out',
        oldValue: 'MARTINO AGUSTINA',
        newValue: 'MARTINO MARCELO JULIAN',
        notes: 'CIC 0000000009 — de MARTINO AGUSTINA a MARTINO MARCELO JULIAN',
      }),
    ]);
    expect(screen.getByText(/⇄ Transferido a MARTINO MARCELO JULIAN/)).toBeInTheDocument();
    expect(screen.getByText('Transferencia')).toBeInTheDocument();
  });
});

describe('SHT-2: transfer-in', () => {
  it('muestra "⇄ Recibido por transferencia de {oldValue}"', () => {
    renderWith([
      makeEvent({
        changeKind: 'transfer-in',
        oldValue: 'MARTINO AGUSTINA',
        newValue: 'MARTINO MARCELO JULIAN',
      }),
    ]);
    expect(screen.getByText(/⇄ Recibido por transferencia de MARTINO AGUSTINA/)).toBeInTheDocument();
  });
});

describe('SHT-3: badge ámbar "pendiente de regularizar" (as-is)', () => {
  it('con notes marcando "pendiente de regularizar" muestra el badge', () => {
    renderWith([
      makeEvent({
        changeKind: 'transfer-out',
        oldValue: 'MARTINO AGUSTINA',
        newValue: 'MARTINO MARCELO JULIAN',
        reason: 'Sin acceso a la antena',
        notes: 'PPPoE juan.old — tal cual (sin recrear) — pendiente de regularizar',
      }),
    ]);
    expect(screen.getByText(/tal cual — pendiente de regularizar/i)).toBeInTheDocument();
  });

  it('sin la marca en notes NO muestra el badge', () => {
    renderWith([
      makeEvent({
        changeKind: 'transfer-out',
        oldValue: 'A',
        newValue: 'B',
        notes: 'PPPoE recreado: juan.old → maria.nueva',
      }),
    ]);
    expect(screen.queryByText(/pendiente de regularizar/i)).not.toBeInTheDocument();
  });
});

describe('SHT-4: modified sin transfer sigue igual', () => {
  it('un modified de plan mantiene el label "Cambio de plan"', () => {
    renderWith([makeEvent({ changeKind: null, notes: 'IP-Air-40-40 → IP-Air-30-10' })]);
    expect(screen.getByText('Cambio de plan')).toBeInTheDocument();
    expect(screen.queryByText(/transferencia/i)).not.toBeInTheDocument();
  });
});
