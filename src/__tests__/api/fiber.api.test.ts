/**
 * smartolt-provision-fe (K2-FE fix wave, H2b) — capa API de fibra.
 *  - Unwrap del envelope {data} en ambos endpoints.
 *  - Timeouts por-call del POST /fiber/provision: la ejecución real encadena
 *    7 calls seriales a SmartOLT → 120s dedicados; el dry-run no tiene
 *    side-effects → 30s. NUNCA timeout global del axiosClient.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/api/axios-client', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

import axiosClient from '@/api/axios-client';
import { fiberApi } from '@/api/fiber.api';

const mockedGet = vi.mocked(axiosClient.get);
const mockedPost = vi.mocked(axiosClient.post);

describe('fiber.api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listUnconfiguredOnus desenvuelve el envelope {data}', async () => {
    const onus = [{ sn: 'HWTC1' }];
    mockedGet.mockResolvedValue({ data: { data: onus } });
    const result = await fiberApi.listUnconfiguredOnus();
    expect(mockedGet).toHaveBeenCalledWith('/fiber/unconfigured-onus');
    expect(result).toEqual(onus);
  });

  it('provision dry-run: timeout de 30s y unwrap del envelope', async () => {
    const plan = { dryRun: true };
    mockedPost.mockResolvedValue({ data: { data: plan } });
    const result = await fiberApi.provision({ contractId: 'c-1', onuSn: 'HWTC1', dryRun: true });
    expect(mockedPost).toHaveBeenCalledWith(
      '/fiber/provision',
      { contractId: 'c-1', onuSn: 'HWTC1', dryRun: true },
      { timeout: 30_000 },
    );
    expect(result).toEqual(plan);
  });

  it('provision real: timeout de 120s (7 calls seriales a SmartOLT)', async () => {
    mockedPost.mockResolvedValue({ data: { data: { dryRun: false } } });
    await fiberApi.provision({ contractId: 'c-1', onuSn: 'HWTC1', vlan: 100, dryRun: false });
    expect(mockedPost).toHaveBeenCalledWith(
      '/fiber/provision',
      { contractId: 'c-1', onuSn: 'HWTC1', vlan: 100, dryRun: false },
      { timeout: 120_000 },
    );
  });

  it('provision sin dryRun explícito cuenta como ejecución real (120s)', async () => {
    mockedPost.mockResolvedValue({ data: { data: { dryRun: false } } });
    await fiberApi.provision({ contractId: 'c-1', onuSn: 'HWTC1' });
    expect(mockedPost).toHaveBeenCalledWith(
      '/fiber/provision',
      { contractId: 'c-1', onuSn: 'HWTC1' },
      { timeout: 120_000 },
    );
  });
});
