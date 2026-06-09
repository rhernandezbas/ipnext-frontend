import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { vehiclesApi } from '@/api/vehicles.api';
import { DEPOT_STOCK_QUERY_KEY } from '@/hooks/useDepotStock';
import type { CreateVehiclePayload, UpdateVehiclePayload, IssueStockToVehiclePayload } from '@/types/vehicle';

/** Stable query key for the vehicle list. */
export const VEHICLES_QUERY_KEY = ['inventory', 'vehicles'] as const;

/** Per-vehicle stock query key. Scoped by id so caches don't collide. */
export const VEHICLE_STOCK_QUERY_KEY = (vehicleId: string) =>
  ['inventory', 'vehicles', vehicleId, 'stock'] as const;

// ─── Vehicle CRUD ────────────────────────────────────────────────────────────

/** List all vehicles (requires `inventory.read`). */
export function useVehicles() {
  return useQuery({
    queryKey: VEHICLES_QUERY_KEY,
    queryFn: vehiclesApi.list,
    staleTime: 30_000,
  });
}

/** Create a new vehicle (requires `inventory.manage`). */
export function useCreateVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateVehiclePayload) => vehiclesApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: VEHICLES_QUERY_KEY }),
  });
}

/** Patch a vehicle (status, name, assignedTechnicianId) — requires `inventory.manage`. */
export function useUpdateVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateVehiclePayload }) =>
      vehiclesApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: VEHICLES_QUERY_KEY }),
  });
}

/** Delete a vehicle (guarded — 409 VEHICLE_IN_USE if stock exists). */
export function useDeleteVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => vehiclesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: VEHICLES_QUERY_KEY }),
  });
}

// ─── Vehicle Stock ────────────────────────────────────────────────────────────

/**
 * Read-only vehicle stock (EPIC #38, Wave 5b). Mirrors `useTechnicianStock`.
 *
 * The backend returns the empty shape (`{ vehicleId, assets: [], materials: [] }`)
 * when no CAMIONETA row exists, so callers never special-case a 404.
 */
export function useVehicleStock(vehicleId: string) {
  return useQuery({
    queryKey: VEHICLE_STOCK_QUERY_KEY(vehicleId),
    queryFn: () => vehiclesApi.getStock(vehicleId),
    staleTime: 30_000,
  });
}

/**
 * Issue (assign) stock from the depot to a vehicle.
 *
 * On success invalidates BOTH the vehicle's stock and the depot stock.
 */
export function useIssueStockToVehicle(vehicleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: IssueStockToVehiclePayload) =>
      vehiclesApi.issueStock(vehicleId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: VEHICLE_STOCK_QUERY_KEY(vehicleId) });
      qc.invalidateQueries({ queryKey: DEPOT_STOCK_QUERY_KEY });
    },
  });
}
