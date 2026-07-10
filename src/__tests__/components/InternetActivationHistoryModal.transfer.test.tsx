/**
 * InternetActivationHistoryModal — labels de transferencia (service-transfer W4)
 *
 * Cubre:
 *  IHT-1  changeKind:'transfer-out' → "⇄ Transferido a {newValue}"
 *  IHT-2  changeKind:'transfer-in'  → "⇄ Recibido por transferencia de {oldValue}"
 *  IHT-3  notes con "pendiente de regularizar" → badge ámbar (defensivo: el DTO global
 *         hoy no manda notes; si el BE lo agrega, el badge prende solo)
 *  IHT-4  'modified' de plan sigue mostrando "viejo → nuevo" (sin regresión)
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { InternetServiceEvent } from '@/types/internetService';
import { mockQuery } from '@/__tests__/_utils/reactQueryMocks';

vi.mock('@/hooks/useInternetServices', () => ({
  useInternetActivationHistory: vi.fn(),
  usePppoeActivationOperators: vi.fn(),
}));

import {
  useInternetActivationHistory,
  usePppoeActivationOperators,
} from '@/hooks/useInternetServices';
import { InternetActivationHistoryModal } from '@/components/molecules/InternetActivationHistoryModal/InternetActivationHistoryModal';

function makeEvent(overrides: Partial<InternetServiceEvent>): InternetServiceEvent {
  return {
    id: 'ev-1',
    clientId: 'client-1',
    customerName: 'MARTINO AGUSTINA',
    contractId: 'ct-1',
    eventType: 'modified',
    actorName: 'Operador A',
    reason: null,
    createdAt: '2026-07-10T10:00:00Z',
    direction: null,
    oldPlan: null,
    newPlan: null,
    changeKind: null,
    oldValue: null,
    newValue: null,
    ...overrides,
  };
}

function renderModal(events: InternetServiceEvent[]) {
  vi.mocked(useInternetActivationHistory).mockReturnValue(mockQuery({ data: events }) as never);
  vi.mocked(usePppoeActivationOperators).mockReturnValue(mockQuery({ data: [] }) as never);
  render(
    <MemoryRouter>
      <InternetActivationHistoryModal open onClose={vi.fn()} clientId="client-1" customerName="MARTINO AGUSTINA" />
    </MemoryRouter>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('IHT-1: transfer-out', () => {
  it('muestra "⇄ Transferido a {newValue}"', () => {
    renderModal([
      makeEvent({ changeKind: 'transfer-out', oldValue: 'MARTINO AGUSTINA', newValue: 'MARTINO MARCELO JULIAN' }),
    ]);
    expect(screen.getByText(/⇄ Transferido a MARTINO MARCELO JULIAN/)).toBeInTheDocument();
  });
});

describe('IHT-2: transfer-in', () => {
  it('muestra "⇄ Recibido por transferencia de {oldValue}"', () => {
    renderModal([
      makeEvent({ changeKind: 'transfer-in', oldValue: 'MARTINO AGUSTINA', newValue: 'MARTINO MARCELO JULIAN' }),
    ]);
    expect(screen.getByText(/⇄ Recibido por transferencia de MARTINO AGUSTINA/)).toBeInTheDocument();
  });
});

describe('IHT-3: badge ámbar as-is (defensivo via notes)', () => {
  it('con notes marcando "pendiente de regularizar" muestra el badge', () => {
    renderModal([
      makeEvent({
        changeKind: 'transfer-out',
        oldValue: 'A',
        newValue: 'B',
        notes: 'PPPoE juan.old — tal cual (sin recrear) — pendiente de regularizar',
      }),
    ]);
    expect(screen.getByText(/tal cual — pendiente de regularizar/i)).toBeInTheDocument();
  });
});

describe('IHT-4: modified de plan sin regresión', () => {
  it('sigue mostrando "viejo → nuevo" para un cambio de plan', () => {
    renderModal([
      makeEvent({ changeKind: null, oldPlan: 'IP-Air-40-40', newPlan: 'IP-Air-30-10', direction: 'downgrade' }),
    ]);
    expect(screen.getByText(/IP-Air-40-40 → IP-Air-30-10/)).toBeInTheDocument();
  });
});
