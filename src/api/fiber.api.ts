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
export const fiberApi = {
  async listUnconfiguredOnus(): Promise<UnconfiguredOnu[]> {
    const r = await axiosClient.get<{ data: UnconfiguredOnu[] }>('/fiber/unconfigured-onus');
    return r.data.data;
  },

  async provision(payload: ProvisionOnuPayload): Promise<ProvisionOnuResult> {
    const r = await axiosClient.post<{ data: ProvisionOnuResult }>('/fiber/provision', payload);
    return r.data.data;
  },
};
