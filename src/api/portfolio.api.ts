import axiosClient from './axios-client';
import type { Portfolio } from '@/types/portfolio';

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
