import axiosClient from './axios-client';
import type { InventoryItem, InventoryProduct, InventoryUnit, SupplyOrder } from '../types/inventory';

// Inventory Items
export const getInventoryItems = () =>
  axiosClient.get<InventoryItem[]>('/inventory').then(r => r.data);

export const getInventoryItem = (id: string) =>
  axiosClient.get<InventoryItem>(`/inventory/${id}`).then(r => r.data);

export const createInventoryItem = (data: Omit<InventoryItem, 'id'>) =>
  axiosClient.post<InventoryItem>('/inventory', data).then(r => r.data);

export const updateInventoryItem = (id: string, data: Partial<InventoryItem>) =>
  axiosClient.put<InventoryItem>(`/inventory/${id}`, data).then(r => r.data);

// Inventory Products (catalog)
export const getInventoryProducts = () =>
  axiosClient.get<InventoryProduct[]>('/inventory/products').then(r => r.data);

export const updateInventoryProduct = (id: string, data: Partial<InventoryProduct>) =>
  axiosClient.put<InventoryProduct>(`/inventory/products/${id}`, data).then(r => r.data);

export const deleteInventoryProduct = (id: string) =>
  axiosClient.delete(`/inventory/products/${id}`);

// Inventory Units (physical units)
export const getInventoryUnits = (productId?: string) =>
  axiosClient.get<InventoryUnit[]>('/inventory/items', { params: productId ? { productId } : undefined }).then(r => r.data);

export const createInventoryUnit = (data: Omit<InventoryUnit, 'id'>) =>
  axiosClient.post<InventoryUnit>('/inventory/items', data).then(r => r.data);

export const updateInventoryUnit = (id: string, data: Partial<InventoryUnit>) =>
  axiosClient.put<InventoryUnit>(`/inventory/items/${id}`, data).then(r => r.data);

export const deleteInventoryUnit = (id: string) =>
  axiosClient.delete(`/inventory/items/${id}`);

// Supply Orders
export const getSupplyOrders = () =>
  axiosClient.get<SupplyOrder[]>('/inventory/supply-orders').then(r => r.data);
