import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { InventoryItem, InventoryProduct, InventoryUnit, SupplyOrder } from '@/types/inventory';
import * as api from '@/api/inventory.api';

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
