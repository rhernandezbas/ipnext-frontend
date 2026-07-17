import axiosClient from './axios-client';
import type {
  UnconfiguredOnu,
  ProvisionOnuPayload,
  ProvisionOnuResult,
} from '@/types/fiber';

/**
 * smartolt-provision-fe (K2-FE) — API del aprovisionamiento de ONUs fibra.
 * GOTCHA envelope (lección e2e-envelope-mock-mismatch): AMBOS endpoints
 * envuelven la respuesta en `{ data: ... }` → desenvolver `r.data.data`.
 */

/** H2b — el dry-run no tiene side-effects: timeout corto. */
const DRY_RUN_TIMEOUT_MS = 30_000;
/** H2b — la ejecución real encadena 7 calls SERIALES a SmartOLT: timeout
 *  dedicado generoso en ESTE call (no global del axiosClient). */
const EXECUTE_TIMEOUT_MS = 120_000;

export const fiberApi = {
  async listUnconfiguredOnus(): Promise<UnconfiguredOnu[]> {
    const r = await axiosClient.get<{ data: UnconfiguredOnu[] }>('/fiber/unconfigured-onus');
    return r.data.data;
  },

  async provision(payload: ProvisionOnuPayload): Promise<ProvisionOnuResult> {
    const timeout = payload.dryRun ? DRY_RUN_TIMEOUT_MS : EXECUTE_TIMEOUT_MS;
    const r = await axiosClient.post<{ data: ProvisionOnuResult }>('/fiber/provision', payload, {
      timeout,
    });
    return r.data.data;
  },
};
