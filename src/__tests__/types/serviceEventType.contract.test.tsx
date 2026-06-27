/**
 * CONTRACT TEST: ServiceEventType enum BE↔FE
 *
 * Fuente canónica BE: contract-services.dto.ts:88 en ipnext-backend.
 * Unión canónica FE: ServiceEventType en @/types/serviceEvents.
 *
 * Qué verifica:
 *  1. SERVICE_EVENT_TYPES tiene exactamente los 7 valores del BE.
 *  2. ServiceHistoryModal.EVENT_LABELS cubre los 7 tipos sin undefined.
 *  3. ServiceHistoryModal.EVENT_REASON_TITLES cubre los 7 tipos sin undefined.
 *  4. InternetActivationHistoryModal.EVENT_TYPE_LABELS cubre los 7 tipos
 *     Y no cae al fallback de string crudo capitalizado.
 *
 * Si el BE agrega un valor a ServiceEventType, este test fallará en ROJO
 * hasta que se agregue la entrada en cada mapa y en SERVICE_EVENT_TYPES.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ← RED: falla hasta que exista src/types/serviceEvents.ts
import { SERVICE_EVENT_TYPES } from '@/types/serviceEvents';
import type { ServiceEventType } from '@/types/serviceEvents';

import { ServiceHistoryModal } from '@/components/molecules/ServiceHistoryModal/ServiceHistoryModal';
import { InternetActivationHistoryModal } from '@/components/molecules/InternetActivationHistoryModal/InternetActivationHistoryModal';
import type { ServiceEvent, ServiceHistoryEntry } from '@/types/customer';
import type { InternetServiceEvent } from '@/types/internetService';

// ── Mocks de hooks ────────────────────────────────────────────────────────────

vi.mock('@/hooks/useContractServiceHistory');
import { useContractServiceHistory } from '@/hooks/useContractServiceHistory';
const mockUseHistory = vi.mocked(useContractServiceHistory);

vi.mock('@/hooks/useInternetServices', () => ({
  useInternetActivationHistory: vi.fn(),
}));
import { useInternetActivationHistory } from '@/hooks/useInternetServices';
const mockUseInternet = vi.mocked(useInternetActivationHistory);

beforeEach(() => vi.clearAllMocks());

// ── Labels esperados (deben coincidir con los mapas de cada componente) ────────
//
// Tipados como Record<ServiceEventType, string> → si falta un valor en la
// unión, TypeScript lo reportará aquí también (doble protección).

const SHM_LABELS: Record<ServiceEventType, string> = {
  activated: 'Alta',
  deactivated: 'Baja',
  reactivated: 'Reactivación',
  reduced: 'Reducción',
  blocked: 'Corte',
  restored: 'Restauración',
  modified: 'Cambio de plan',
};

const IAHM_LABELS: Record<ServiceEventType, string> = {
  activated: 'Alta',
  deactivated: 'Baja',
  reactivated: 'Reactivación',
  reduced: 'Reducido',
  blocked: 'Bloqueado',
  restored: 'Restaurado',
  modified: 'Modificado',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeServiceHistoryEntry(eventType: ServiceEventType): ServiceHistoryEntry {
  const ev: ServiceEvent = {
    id: `ev-${eventType}`,
    eventType,
    occurredAt: '2026-06-01T10:00:00Z',
    actorName: 'Operador Test',
    cic: null,
  };
  return {
    id: 'entry-1',
    contractId: 'c1',
    serviceCatalogId: 's1',
    name: 'INTERNET',
    label: 'Internet Test',
    status: 'active',
    notes: null,
    tvLogin: null,
    createdAt: '2024-01-01T00:00:00Z',
    deactivatedAt: null,
    events: [ev],
  };
}

function makeInternetEvent(eventType: ServiceEventType): InternetServiceEvent {
  return {
    id: `ev-${eventType}`,
    clientId: 'client-1',
    customerName: 'Test Cliente',
    contractId: 'c1',
    eventType,
    actorName: 'Operador Test',
    reason: null,
    createdAt: '2026-06-01T10:00:00Z',
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CONTRACT: ServiceEventType enum BE↔FE (mirrors contract-services.dto.ts:88)', () => {
  // ── 1. El array canónico tiene exactamente los 7 valores del BE ──────────
  describe('SERVICE_EVENT_TYPES — array canónico', () => {
    it('tiene exactamente 7 valores', () => {
      expect(SERVICE_EVENT_TYPES).toHaveLength(7);
    });

    it('contiene todos los valores canónicos del BE', () => {
      const canonical = [
        'activated',
        'deactivated',
        'reactivated',
        'reduced',
        'blocked',
        'restored',
        'modified',
      ] as const;
      expect(SERVICE_EVENT_TYPES).toEqual(expect.arrayContaining([...canonical]));
    });
  });

  // ── 2. ServiceHistoryModal.EVENT_LABELS cubre los 7 tipos ───────────────
  describe('ServiceHistoryModal: EVENT_LABELS cubre los 7 tipos sin undefined', () => {
    SERVICE_EVENT_TYPES.forEach((eventType) => {
      it(`eventType "${eventType}" → badge muestra "${SHM_LABELS[eventType]}"`, () => {
        mockUseHistory.mockReturnValue({
          data: [makeServiceHistoryEntry(eventType)],
          isLoading: false,
        } as ReturnType<typeof useContractServiceHistory>);
        render(<ServiceHistoryModal open onClose={vi.fn()} contractId="c1" />);
        expect(screen.getByText(SHM_LABELS[eventType])).toBeInTheDocument();
      });
    });
  });

  // ── 3. ServiceHistoryModal.EVENT_REASON_TITLES cubre los 7 tipos ────────
  describe('ServiceHistoryModal: EVENT_REASON_TITLES cubre los 7 tipos (título en ReasonViewModal)', () => {
    // Solo verificamos que el título del modal sea NON-undefined para cada tipo.
    // Los títulos están en EVENT_REASON_TITLES (Record completo → nunca undefined).
    // Este test actúa como guardia: si alguien cambia EVENT_REASON_TITLES a Partial
    // y le falta un valor, el componente renderizaría "undefined" en el botón.
    SERVICE_EVENT_TYPES.forEach((eventType) => {
      it(`eventType "${eventType}" con reason → botón "ver" visible (título EVENT_REASON_TITLES no es undefined)`, () => {
        const ev: ServiceEvent = {
          id: `ev-${eventType}-r`,
          eventType,
          occurredAt: '2026-06-01T10:00:00Z',
          actorName: 'Operador Test',
          cic: null,
          reason: 'Motivo test',
        };
        const entry: ServiceHistoryEntry = {
          ...makeServiceHistoryEntry(eventType),
          events: [ev],
        };
        mockUseHistory.mockReturnValue({
          data: [entry],
          isLoading: false,
        } as ReturnType<typeof useContractServiceHistory>);
        render(<ServiceHistoryModal open onClose={vi.fn()} contractId="c1" />);
        expect(screen.getByRole('button', { name: /ver motivo/i })).toBeInTheDocument();
      });
    });
  });

  // ── 4. InternetActivationHistoryModal.EVENT_TYPE_LABELS cubre los 7 tipos
  describe('InternetActivationHistoryModal: EVENT_TYPE_LABELS cubre los 7 tipos (no cae al fallback)', () => {
    SERVICE_EVENT_TYPES.forEach((eventType) => {
      it(`eventType "${eventType}" → label mapeado "${IAHM_LABELS[eventType]}", NO el crudo capitalizado`, () => {
        mockUseInternet.mockReturnValue({
          data: [makeInternetEvent(eventType)],
          isLoading: false,
          isError: false,
        } as ReturnType<typeof useInternetActivationHistory>);
        render(
          <MemoryRouter>
            <InternetActivationHistoryModal open clientId="client-1" onClose={vi.fn()} />
          </MemoryRouter>,
        );
        // Label mapeado debe estar presente
        expect(screen.getByText(IAHM_LABELS[eventType])).toBeInTheDocument();
        // Verificar que NO cayó al fallback de string crudo capitalizado,
        // a menos que el label mapeado coincida con el capitalizado (no pasa en nuestro caso)
        const rawCapitalized = eventType.charAt(0).toUpperCase() + eventType.slice(1);
        if (rawCapitalized !== IAHM_LABELS[eventType]) {
          expect(screen.queryByText(rawCapitalized)).not.toBeInTheDocument();
        }
      });
    });
  });
});
