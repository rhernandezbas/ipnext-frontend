/**
 * mediaIcons — pickFileIconKind (messaging-inbox-v2-media F1.5 fase A, F2.3,
 * design §3.4). Mapa chico y honesto de `contentType` → ícono de archivo
 * (nunca emoji). Se testea la función PURA de selección (sin mocks, sin
 * renderizar SVG) — el consumo visual lo cubre `MediaFile.test.tsx` (F3.5).
 */
import { describe, it, expect } from 'vitest';
import { pickFileIconKind } from './mediaIcons';

describe('pickFileIconKind', () => {
  it('application/pdf → "pdf"', () => {
    expect(pickFileIconKind('application/pdf')).toBe('pdf');
  });

  it('application/zip → "archive"', () => {
    expect(pickFileIconKind('application/zip')).toBe('archive');
  });

  it('application/x-rar-compressed → "archive"', () => {
    expect(pickFileIconKind('application/x-rar-compressed')).toBe('archive');
  });

  it('application/msword → "doc"', () => {
    expect(pickFileIconKind('application/msword')).toBe('doc');
  });

  it('officedocument.wordprocessingml → "doc"', () => {
    expect(pickFileIconKind('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('doc');
  });

  it('spreadsheet → "sheet"', () => {
    expect(pickFileIconKind('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe('sheet');
  });

  it('excel → "sheet"', () => {
    expect(pickFileIconKind('application/vnd.ms-excel')).toBe('sheet');
  });

  it('tipo desconocido → "generic" (mapa chico, no se inventan 20 tipos)', () => {
    expect(pickFileIconKind('application/octet-stream')).toBe('generic');
  });
});
