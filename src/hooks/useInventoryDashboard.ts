import { useQuery } from '@tanstack/react-query';
import * as inventoryApi from '@/api/inventory.api';
import type { MovementFilters } from '@/types/inventoryDashboard';

/** Fetches location overview grouped by type (DEPOSITO/CLIENTE/TECNICO/CAMIONETA). */
export function useInventoryOverview() {
  return useQuery({
    queryKey: ['inventory-overview'],
    queryFn: inventoryApi.getOverview,
    staleTime: 60_000,
  });
}

/** Fetches paginated inventory movements with optional filters. */
export function useInventoryMovements(filters: MovementFilters = {}, page = 1, limit = 25) {
  return useQuery({
    queryKey: ['inventory-movements', filters, page, limit],
    queryFn: () => inventoryApi.getMovements({ ...filters, page, limit }),
    staleTime: 30_000,
  });
}

/** Fetches low-stock alerts (only materials with minStock > 0 AND totalQty < minStock). */
export function useInventoryAlerts() {
  return useQuery({
    queryKey: ['inventory-alerts'],
    queryFn: inventoryApi.getAlerts,
    staleTime: 60_000,
  });
}
