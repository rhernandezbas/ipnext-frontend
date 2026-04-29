import axiosClient from './axios-client';
import type { ServicePlan, NetworkDevice, InventoryItem, InventoryProduct, InventoryUnit, SupplyOrder } from '../types/empresa';

// Service Plans
export const getServicePlans = () =>
  axiosClient.get<ServicePlan[]>('/service-plans').then(r => r.data);

export const getServicePlan = (id: string) =>
  axiosClient.get<ServicePlan>(`/service-plans/${id}`).then(r => r.data);

export const createServicePlan = (data: Omit<ServicePlan, 'id'>) =>
  axiosClient.post<ServicePlan>('/service-plans', data).then(r => r.data);

export const updateServicePlan = (id: string, data: Partial<ServicePlan>) =>
  axiosClient.put<ServicePlan>(`/service-plans/${id}`, data).then(r => r.data);

export const deleteServicePlan = (id: string) =>
  axiosClient.delete(`/service-plans/${id}`);

// Network Devices
export const getNetworkDevices = () =>
  axiosClient.get<NetworkDevice[]>('/network-devices').then(r => r.data);

export const getNetworkDevice = (id: string) =>
  axiosClient.get<NetworkDevice>(`/network-devices/${id}`).then(r => r.data);

export const createNetworkDevice = (data: Omit<NetworkDevice, 'id'>) =>
  axiosClient.post<NetworkDevice>('/network-devices', data).then(r => r.data);

export const updateNetworkDevice = (id: string, data: Partial<NetworkDevice>) =>
  axiosClient.put<NetworkDevice>(`/network-devices/${id}`, data).then(r => r.data);

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

// Inventory Units (physical units)
export const getInventoryUnits = (productId?: string) =>
  axiosClient.get<InventoryUnit[]>('/inventory/items', { params: productId ? { productId } : undefined }).then(r => r.data);

export const createInventoryUnit = (data: Omit<InventoryUnit, 'id'>) =>
  axiosClient.post<InventoryUnit>('/inventory/items', data).then(r => r.data);

export const updateInventoryUnit = (id: string, data: Partial<InventoryUnit>) =>
  axiosClient.put<InventoryUnit>(`/inventory/items/${id}`, data).then(r => r.data);

export const updateInventoryProduct = (id: string, data: Partial<InventoryProduct>) =>
  axiosClient.put<InventoryProduct>(`/inventory/products/${id}`, data).then(r => r.data);

export const deleteInventoryProduct = (id: string) =>
  axiosClient.delete(`/inventory/products/${id}`);

export const deleteInventoryUnit = (id: string) =>
  axiosClient.delete(`/inventory/items/${id}`);

// Supply Orders
export const getSupplyOrders = () =>
  axiosClient.get<SupplyOrder[]>('/inventory/supply-orders').then(r => r.data);
