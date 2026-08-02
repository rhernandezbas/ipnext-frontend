import { describe, it, expect } from 'vitest';
import { validateStoreProductImage, STORE_PRODUCT_IMAGE_MAX_BYTES } from '@/utils/validateStoreProductImage';

function makeFile(name: string, type: string, size: number): File {
  const file = new File([new Uint8Array(size)], name, { type });
  return file;
}

describe('validateStoreProductImage', () => {
  it('acepta una imagen válida chica', () => {
    const file = makeFile('foto.jpg', 'image/jpeg', 1024);
    expect(validateStoreProductImage(file)).toBeNull();
  });

  it('rechaza un archivo no-imagen', () => {
    const file = makeFile('doc.pdf', 'application/pdf', 1024);
    const err = validateStoreProductImage(file);
    expect(err?.code).toBe('UNSUPPORTED_TYPE');
  });

  it('rechaza una imagen que supera 8MB', () => {
    const file = makeFile('grande.jpg', 'image/jpeg', STORE_PRODUCT_IMAGE_MAX_BYTES + 1);
    const err = validateStoreProductImage(file);
    expect(err?.code).toBe('TOO_LARGE');
  });

  it('acepta exactamente el límite de 8MB', () => {
    const file = makeFile('limite.jpg', 'image/jpeg', STORE_PRODUCT_IMAGE_MAX_BYTES);
    expect(validateStoreProductImage(file)).toBeNull();
  });
});
