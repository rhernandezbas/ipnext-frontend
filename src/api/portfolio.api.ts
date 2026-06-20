import axiosClient from './axios-client';
import type { Portfolio, AllPortfolios } from '@/types/portfolio';

/**
 * GET /api/portfolio/mine — the logged-in agent's portfolio ("Mis clientes").
 *
 * The agent identity is resolved server-side from the auth cookie (no params).
 * Returns `{ items, summary, unmapped }`; `unmapped: true` means the agent has
 * no GR vendedor mapping, so `items` is empty by design.
 */
export async function getMyPortfolio(): Promise<Portfolio> {
  const response = await axiosClient.get<Portfolio>('/portfolio/mine');
  return response.data;
}

/**
 * GET /api/portfolio/by-vendedor?vendedor=<nombre> — one vendedor's portfolio
 * (super admin view). Gate: recapture.manage. Returns the same `Portfolio`
 * shape as /mine, but `unmapped` is always false (a concrete vendedor is given).
 */
export async function getPortfolioByVendedor(vendedor: string): Promise<Portfolio> {
  const response = await axiosClient.get<Portfolio>('/portfolio/by-vendedor', {
    params: { vendedor },
  });
  return response.data;
}

/**
 * GET /api/portfolio/all — every agent's clients (super admin view).
 * Gate: recapture.manage. Each item is tagged with its owning `vendedor`; the
 * summary is GLOBAL. No `unmapped` (the view spans all mapped vendedores).
 */
export async function getAllPortfolios(): Promise<AllPortfolios> {
  const response = await axiosClient.get<AllPortfolios>('/portfolio/all');
  return response.data;
}
