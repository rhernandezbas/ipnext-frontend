import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ServicePlan } from '@/types/service-plans';
import type { NetworkDevice } from '@/types/network-devices';
import type { InventoryItem, InventoryProduct, InventoryUnit, SupplyOrder } from '@/types/inventory';
import * as servicePlansApi from '@/api/service-plans.api';
import * as networkDevicesApi from '@/api/network-devices.api';
import * as inventoryApi from '@/api/inventory.api';

// Service Plans
export function useServicePlans() {
  return useQuery({ queryKey: ['service-plans'], queryFn: servicePlansApi.getServicePlans });
}

export function useCreateServicePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: servicePlansApi.createServicePlan,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['service-plans'] }),
  });
}

export function useUpdateServicePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ServicePlan> }) =>
      servicePlansApi.updateServicePlan(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['service-plans'] }),
  });
}

export function useDeleteServicePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: servicePlansApi.deleteServicePlan,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['service-plans'] }),
  });
}

// Network Devices
export function useNetworkDevices() {
  return useQuery({ queryKey: ['network-devices'], queryFn: networkDevicesApi.getNetworkDevices });
}

export function useCreateNetworkDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: networkDevicesApi.createNetworkDevice,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['network-devices'] }),
  });
}

export function useUpdateNetworkDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<NetworkDevice> }) =>
      networkDevicesApi.updateNetworkDevice(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['network-devices'] }),
  });
}

// Inventory Items
export function useInventoryItems() {
  return useQuery({ queryKey: ['inventory-items'], queryFn: inventoryApi.getInventoryItems });
}

export function useCreateInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: inventoryApi.createInventoryItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory-items'] }),
  });
}

export function useUpdateInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InventoryItem> }) =>
      inventoryApi.updateInventoryItem(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory-items'] }),
  });
}

// Inventory Products (catalog)
export function useInventoryProducts() {
  return useQuery({ queryKey: ['inventory-products'], queryFn: inventoryApi.getInventoryProducts });
}

// Inventory Units (physical units)
export function useInventoryUnits(productId?: string) {
  return useQuery({
    queryKey: ['inventory-units', productId],
    queryFn: () => inventoryApi.getInventoryUnits(productId),
  });
}

export function useCreateInventoryUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: inventoryApi.createInventoryUnit,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory-units'] }),
  });
}

export function useUpdateInventoryUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InventoryUnit> }) =>
      inventoryApi.updateInventoryUnit(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory-units'] }),
  });
}

export function useUpdateInventoryProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InventoryProduct> }) =>
      inventoryApi.updateInventoryProduct(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory-products'] }),
  });
}

export function useDeleteInventoryProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: inventoryApi.deleteInventoryProduct,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory-products'] }),
  });
}

export function useDeleteInventoryUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: inventoryApi.deleteInventoryUnit,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory-units'] }),
  });
}

// Supply Orders
export function useSupplyOrders() {
  return useQuery<SupplyOrder[]>({ queryKey: ['supply-orders'], queryFn: inventoryApi.getSupplyOrders });
}
