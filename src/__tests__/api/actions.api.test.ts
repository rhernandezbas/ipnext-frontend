/**
 * actions.api — wire contract del router /api/actions (actions-worklist F2).
 *
 *  AAPI-1 listOwnershipCases: GET /actions/ownership-cases con params limpios
 *  AAPI-2 listOwnershipCases: sin filtros no manda params vacíos
 *  AAPI-3 updateOwnershipCase: PATCH /actions/ownership-cases/:id con el body EXACTO
 *  AAPI-4 listRecentBajas: GET /actions/recent-bajas con paginación
 *  AAPI-5 updateOwnershipCase devuelve la ENTIDAD de dominio cruda del BE
 *         (OwnershipCaseMutationResult) — NO el DTO de lectura enriquecido
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { OwnershipCaseMutationResult } from '@/types/actions';

vi.mock('@/api/axios-client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import axiosClient from '@/api/axios-client';
import { listOwnershipCases, updateOwnershipCase, listRecentBajas } from '@/api/actions.api';

const emptyPage = { items: [], total: 0, page: 1, pageSize: 25 };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AAPI-1/2: listOwnershipCases', () => {
  it('GETs /actions/ownership-cases con status/page/pageSize', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: emptyPage });

    const result = await listOwnershipCases({ status: 'pending', page: 2, pageSize: 10 });

    expect(axiosClient.get).toHaveBeenCalledWith('/actions/ownership-cases', {
      params: { status: 'pending', page: 2, pageSize: 10 },
    });
    expect(result).toEqual(emptyPage);
  });

  it('sin filtros manda params vacíos (no basura al BE)', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: emptyPage });

    await listOwnershipCases();

    expect(axiosClient.get).toHaveBeenCalledWith('/actions/ownership-cases', { params: {} });
  });
});

describe('AAPI-3: updateOwnershipCase', () => {
  it('PATCHea el body de UN solo discriminador tal cual', async () => {
    const updated = { id: 'case-1', status: 'pending' };
    vi.mocked(axiosClient.patch).mockResolvedValue({ data: updated });

    const result = await updateOwnershipCase('case-1', { equipmentReviewed: true });

    expect(axiosClient.patch).toHaveBeenCalledWith('/actions/ownership-cases/case-1', {
      equipmentReviewed: true,
    });
    expect(result).toEqual(updated);
  });

  it('soporta el descarte con motivo', async () => {
    vi.mocked(axiosClient.patch).mockResolvedValue({ data: { id: 'case-1' } });

    await updateOwnershipCase('case-1', { status: 'dismissed', reason: 'duplicado' });

    expect(axiosClient.patch).toHaveBeenCalledWith('/actions/ownership-cases/case-1', {
      status: 'dismissed',
      reason: 'duplicado',
    });
  });
});

describe('AAPI-5: el PATCH devuelve la entidad de dominio cruda', () => {
  it('shape REAL del BE: sin checks/names, candidates {contractId, clientId}, campos reviewed planos', async () => {
    // Espejo del makeCase() de actions.routes.test.ts del BE (OwnershipTransferCase).
    const entity: OwnershipCaseMutationResult = {
      id: 'case-1',
      status: 'pending',
      sourceContractId: 'ct-src',
      sourceClientId: 'cli-src',
      motivoBaja: 'CAMBIO DE TITULARIDAD',
      bajaDate: null,
      targetContractId: 'ct-b',
      targetClientId: 'cli-b',
      candidates: [
        { contractId: 'ct-a', clientId: 'cli-a' },
        { contractId: 'ct-b', clientId: 'cli-b' },
      ],
      dismissReason: null,
      equipmentReviewed: false,
      equipmentReviewedById: null,
      equipmentReviewedAt: null,
      detectedAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-09T00:00:00.000Z',
    };
    vi.mocked(axiosClient.patch).mockResolvedValue({ data: entity });

    const result = await updateOwnershipCase('case-1', { targetContractId: 'ct-b' });

    expect(result).toEqual(entity);
    // Honestidad del tipo: la mutación NO trae los campos del DTO de lectura.
    expect('checks' in result).toBe(false);
    expect('sourceClientName' in result).toBe(false);
    expect('targetClientName' in result).toBe(false);
  });
});

describe('AAPI-4: listRecentBajas', () => {
  it('GETs /actions/recent-bajas con paginación', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: emptyPage });

    const result = await listRecentBajas({ page: 3, pageSize: 25 });

    expect(axiosClient.get).toHaveBeenCalledWith('/actions/recent-bajas', {
      params: { page: 3, pageSize: 25 },
    });
    expect(result).toEqual(emptyPage);
  });
});
