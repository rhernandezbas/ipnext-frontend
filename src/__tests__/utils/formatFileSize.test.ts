import { describe, it, expect } from 'vitest';
import { formatFileSize } from '@/utils/formatFileSize';

/**
 * formatFileSize (messaging-inbox-v2-media F1.5 fase A, F2.1, design §10) —
 * bytes → humano ("820 B" | "12.3 KB" | "4.1 MB"). Base 1024, 1 decimal desde
 * KB. Bordes null/NaN/negativo → null (el consumidor omite el tamaño, nunca
 * muestra "null" — MediaFile/MediaAudio, design §3.3/§3.4).
 */
describe('formatFileSize', () => {
  it('null → null (Chatwoot no reportó tamaño)', () => {
    expect(formatFileSize(null)).toBeNull();
  });

  it('NaN → null', () => {
    expect(formatFileSize(NaN)).toBeNull();
  });

  it('negativo → null (dato corrupto, nunca se muestra)', () => {
    expect(formatFileSize(-5)).toBeNull();
  });

  it('0 bytes → "0 B"', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });

  it('< 1KB → bytes enteros con sufijo "B"', () => {
    expect(formatFileSize(820)).toBe('820 B');
  });

  it('exactamente 1024 bytes → "1.0 KB"', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');
  });

  it('rango KB → 1 decimal', () => {
    expect(formatFileSize(12595)).toBe('12.3 KB');
  });

  it('exactamente 1MB → "1.0 MB"', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
  });

  it('rango MB → 1 decimal', () => {
    expect(formatFileSize(4_300_000)).toBe('4.1 MB');
  });
});
