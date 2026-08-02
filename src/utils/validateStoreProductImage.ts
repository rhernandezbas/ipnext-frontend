import { formatFileSize } from './formatFileSize';

/** 8 MiB por archivo (contrato del BE, `POST /store/products/:id/image`). */
export const STORE_PRODUCT_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

/** `accept` del file picker — solo imágenes. */
export const STORE_PRODUCT_IMAGE_ACCEPT = 'image/*';

export interface StoreProductImageValidationError {
  code: 'UNSUPPORTED_TYPE' | 'TOO_LARGE';
  message: string;
}

/**
 * store-admin — valida la imagen ANTES de llamar al API (regla dura del
 * proposal: "archivo no-imagen o >8MB → error local SIN llamar al API").
 * El BE re-valida siempre — si esto diverge, gana el BE.
 */
export function validateStoreProductImage(file: File): StoreProductImageValidationError | null {
  if (!file.type.startsWith('image/')) {
    return {
      code: 'UNSUPPORTED_TYPE',
      message: `"${file.name}" no es una imagen. Elegí un archivo jpg, png, webp o gif.`,
    };
  }
  if (file.size > STORE_PRODUCT_IMAGE_MAX_BYTES) {
    return {
      code: 'TOO_LARGE',
      message: `"${file.name}" supera el límite de ${formatFileSize(STORE_PRODUCT_IMAGE_MAX_BYTES)}.`,
    };
  }
  return null;
}
