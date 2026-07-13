/**
 * validateAttachment — espejo FE de `MAX_BYTES_BY_FILE_TYPE`/`deriveFileType`
 * del BE (messaging-inbox-v2-media F1.5 fase A, Tanda 2, spec-send.md §6.2).
 * Funciones PURAS: sin mocks, sin red. El BE es la autoridad (415/413) — el
 * FE valida por feedback inmediato.
 */
import { describe, it, expect } from 'vitest';
import { deriveFileType, validateFile, MAX_BYTES_BY_FILE_TYPE, MAX_FILES } from '@/utils/validateAttachment';

function makeFile(name: string, type: string, sizeBytes: number): File {
  const file = new File([''], name, { type });
  Object.defineProperty(file, 'size', { value: sizeBytes });
  return file;
}

describe('MAX_FILES / MAX_BYTES_BY_FILE_TYPE (contrato, espejo BE)', () => {
  it('MAX_FILES es 10', () => {
    expect(MAX_FILES).toBe(10);
  });

  it('límites por tipo: image 5MB, video/audio 16MB, file 100MB', () => {
    expect(MAX_BYTES_BY_FILE_TYPE.image).toBe(5 * 1024 * 1024);
    expect(MAX_BYTES_BY_FILE_TYPE.video).toBe(16 * 1024 * 1024);
    expect(MAX_BYTES_BY_FILE_TYPE.audio).toBe(16 * 1024 * 1024);
    expect(MAX_BYTES_BY_FILE_TYPE.file).toBe(100 * 1024 * 1024);
  });
});

describe('deriveFileType', () => {
  it('image/* → "image"', () => {
    expect(deriveFileType('image/jpeg')).toBe('image');
    expect(deriveFileType('image/png')).toBe('image');
  });

  it('video/* → "video"', () => {
    expect(deriveFileType('video/mp4')).toBe('video');
  });

  it('audio/* → "audio"', () => {
    expect(deriveFileType('audio/mpeg')).toBe('audio');
  });

  it('resto (pdf, doc, zip, etc.) → "file"', () => {
    expect(deriveFileType('application/pdf')).toBe('file');
    expect(deriveFileType('application/zip')).toBe('file');
  });
});

describe('validateFile', () => {
  it('imagen dentro del límite (4MB) → válida (null)', () => {
    const file = makeFile('foto.jpg', 'image/jpeg', 4 * 1024 * 1024);
    expect(validateFile(file)).toBeNull();
  });

  it('imagen exactamente en el borde (5MB) → válida (no excede)', () => {
    const file = makeFile('foto.jpg', 'image/jpeg', 5 * 1024 * 1024);
    expect(validateFile(file)).toBeNull();
  });

  it('imagen que excede su límite (6MB > 5MB) → error TOO_LARGE', () => {
    const file = makeFile('foto.jpg', 'image/jpeg', 6 * 1024 * 1024);
    const result = validateFile(file);
    expect(result).not.toBeNull();
    expect(result?.code).toBe('TOO_LARGE');
    expect(result?.message).toMatch(/5(\.0)? MB/i);
  });

  it('video que excede su límite (17MB > 16MB) → error TOO_LARGE', () => {
    const file = makeFile('clip.mp4', 'video/mp4', 17 * 1024 * 1024);
    const result = validateFile(file);
    expect(result?.code).toBe('TOO_LARGE');
  });

  it('un documento (file) de 50MB → válido (dentro del techo de 100MB)', () => {
    const file = makeFile('doc.pdf', 'application/pdf', 50 * 1024 * 1024);
    expect(validateFile(file)).toBeNull();
  });

  it('un documento de 101MB → error TOO_LARGE (excede el techo de "file")', () => {
    const file = makeFile('doc.pdf', 'application/pdf', 101 * 1024 * 1024);
    const result = validateFile(file);
    expect(result?.code).toBe('TOO_LARGE');
  });
});

describe('validateFile — bug MEDIO #8 (allowlist de tipo, ANTES del check de tamaño)', () => {
  it('un tipo no soportado (.exe) → error UNSUPPORTED_TYPE aunque el tamaño sea chico', () => {
    const file = makeFile('virus.exe', 'application/x-msdownload', 10);
    const result = validateFile(file);
    expect(result?.code).toBe('UNSUPPORTED_TYPE');
  });

  it('image/heic (no soportado por WhatsApp aunque matchee "image/*") → UNSUPPORTED_TYPE', () => {
    const file = makeFile('foto.heic', 'image/heic', 10);
    expect(validateFile(file)?.code).toBe('UNSUPPORTED_TYPE');
  });

  it('un tipo soportado dentro del límite sigue siendo válido (sin regresión)', () => {
    const file = makeFile('foto.jpg', 'image/jpeg', 1024);
    expect(validateFile(file)).toBeNull();
  });

  it('UNSUPPORTED_TYPE gana aunque el archivo ADEMÁS exceda el tamaño (el tipo se chequea primero)', () => {
    const file = makeFile('grande.exe', 'application/x-msdownload', 200 * 1024 * 1024);
    expect(validateFile(file)?.code).toBe('UNSUPPORTED_TYPE');
  });
});
