import axiosClient from './axios-client';
import type {
  InventoryOverviewDTO,
  InventoryMovementListDTO,
  LowStockAlertDTO,
  MovementFilters,
} from '../types/inventoryDashboard';

// --- World B Dashboard API (Wave 7) ---

export const getOverview = () =>
  axiosClient.get<InventoryOverviewDTO>('/inventory/overview/locations').then(r => r.data);

export const getMovements = (params: MovementFilters & { page?: number; limit?: number }) =>
  axiosClient
    .get<InventoryMovementListDTO>('/inventory/movements', { params })
    .then(r => r.data);

export const getAlerts = () =>
  axiosClient.get<LowStockAlertDTO[]>('/inventory/alerts').then(r => r.data);
