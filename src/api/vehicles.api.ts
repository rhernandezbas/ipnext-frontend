/**
 * Vehicle catalog API (EPIC #38, Wave 5b).
 *
 * Two endpoint groups:
 * - `GET|POST /api/vehicles`         — vehicle ABM (CRUD)
 * - `PATCH|DELETE /api/vehicles/:id` — vehicle mutations
 * - `GET  /api/inventory/vehicles/:id/stock` — per-vehicle stock
 * - `POST /api/inventory/vehicles/:id/issue` — depot → vehicle transfer
 */

import axiosClient from './axios-client';
import type {
  Vehicle,
  VehicleStockDTO,
  CreateVehiclePayload,
  UpdateVehiclePayload,
  IssueStockToVehiclePayload,
} from '@/types/vehicle';

const VEHICLES_BASE = '/vehicles';
const INVENTORY_BASE = '/inventory/vehicles';

export const vehiclesApi = {
  list: (): Promise<Vehicle[]> =>
    axiosClient.get<Vehicle[]>(VEHICLES_BASE).then(r => r.data),

  create: (data: CreateVehiclePayload): Promise<Vehicle> =>
    axiosClient.post<Vehicle>(VEHICLES_BASE, data).then(r => r.data),

  update: (id: string, data: UpdateVehiclePayload): Promise<Vehicle> =>
    axiosClient.patch<Vehicle>(`${VEHICLES_BASE}/${id}`, data).then(r => r.data),

  delete: (id: string): Promise<void> =>
    axiosClient.delete(`${VEHICLES_BASE}/${id}`).then(() => undefined),

  getStock: (vehicleId: string): Promise<VehicleStockDTO> =>
    axiosClient
      .get<VehicleStockDTO>(`${INVENTORY_BASE}/${vehicleId}/stock`)
      .then(r => r.data),

  issueStock: (vehicleId: string, payload: IssueStockToVehiclePayload): Promise<void> =>
    axiosClient
      .post(`${INVENTORY_BASE}/${vehicleId}/issue`, payload)
      .then(() => undefined),
};
