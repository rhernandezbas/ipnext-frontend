import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { storeApi } from '@/api/store.api';
import type { CreateStoreProductInput, UpdateStoreProductInput } from '@/api/store.api';

export const storeProductsKey = ['store', 'products'] as const;
export const storeOrdersKey = ['store', 'orders'] as const;

/** Mensaje claro por status — mismo criterio que `toServerError` de `usePromos.ts`. */
function toServerError(error: unknown): string | null {
  if (!error) return null;
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const body = error.response?.data as { error?: string } | undefined;
    if (status === 400) return body?.error ?? 'Datos inválidos: revisá los campos obligatorios.';
    if (status === 404) return body?.error ?? 'El producto ya no existe (quizás se archivó desde otra sesión).';
    if (status === 413) return body?.error ?? 'La imagen supera el límite permitido (8MB).';
    if (status === 415) return body?.error ?? 'El archivo no es una imagen soportada.';
  }
  return 'No se pudo guardar. Reintentá en unos segundos.';
}

export function useStoreProducts() {
  return useQuery({ queryKey: storeProductsKey, queryFn: storeApi.listProducts, staleTime: 30_000 });
}

export function useCreateStoreProduct() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (data: CreateStoreProductInput) => storeApi.createProduct(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: storeProductsKey }),
  });
  return {
    create: mutation.mutate,
    createAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
    serverError: toServerError(mutation.error),
  };
}

export function useUpdateStoreProduct() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateStoreProductInput }) => storeApi.updateProduct(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: storeProductsKey }),
  });
  return {
    update: mutation.mutate,
    updateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
    serverError: toServerError(mutation.error),
  };
}

export function useUploadStoreProductImage() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => storeApi.uploadProductImage(id, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: storeProductsKey }),
  });
  return {
    uploadAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    serverError: toServerError(mutation.error),
  };
}

export function useDeleteStoreProductImage() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (id: string) => storeApi.deleteProductImage(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: storeProductsKey }),
  });
  return {
    removeAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    serverError: toServerError(mutation.error),
  };
}

export function useStoreOrders() {
  return useQuery({ queryKey: storeOrdersKey, queryFn: storeApi.listOrders, staleTime: 30_000 });
}
