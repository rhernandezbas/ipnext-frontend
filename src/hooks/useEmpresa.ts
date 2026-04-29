import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ServicePlan, NetworkDevice, InventoryItem, InventoryProduct, InventoryUnit, SupplyOrder } from '@/types/empresa';
import * as api from '@/api/empresa.api';

// Service Plans
export function useServicePlans() {
  return useQuery({ queryKey: ['service-plans'], queryFn: api.getServicePlans });
}

export function useCreateServicePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createServicePlan,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['service-plans'] }),
  });
}

export function useUpdateServicePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ServicePlan> }) =>
      api.updateServicePlan(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['service-plans'] }),
  });
}

export function useDeleteServicePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteServicePlan,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['service-plans'] }),
  });
}

// Network Devices
export function useNetworkDevices() {
  return useQuery({ queryKey: ['network-devices'], queryFn: api.getNetworkDevices });
}

export function useCreateNetworkDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createNetworkDevice,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['network-devices'] }),
  });
}

export function useUpdateNetworkDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<NetworkDevice> }) =>
      api.updateNetworkDevice(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['network-devices'] }),
  });
}

// Inventory Items
export function useInventoryItems() {
  return useQuery({ queryKey: ['inventory-items'], queryFn: api.getInventoryItems });
}

export function useCreateInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createInventoryItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory-items'] }),
  });
}

export function useUpdateInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InventoryItem> }) =>
      api.updateInventoryItem(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory-items'] }),
  });
}

// Inventory Products (catalog)
export function useInventoryProducts() {
  return useQuery({ queryKey: ['inventory-products'], queryFn: api.getInventoryProducts });
}

// Inventory Units (physical units)
export function useInventoryUnits(productId?: string) {
  return useQuery({
    queryKey: ['inventory-units', productId],
    queryFn: () => api.getInventoryUnits(productId),
  });
}

export function useCreateInventoryUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createInventoryUnit,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory-units'] }),
  });
}

export function useUpdateInventoryUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InventoryUnit> }) =>
      api.updateInventoryUnit(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory-units'] }),
  });
}

export function useUpdateInventoryProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InventoryProduct> }) =>
      api.updateInventoryProduct(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory-products'] }),
  });
}

export function useDeleteInventoryProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteInventoryProduct,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory-products'] }),
  });
}

export function useDeleteInventoryUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteInventoryUnit,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory-units'] }),
  });
}

// Supply Orders
export function useSupplyOrders() {
  return useQuery<SupplyOrder[]>({ queryKey: ['supply-orders'], queryFn: api.getSupplyOrders });
}
