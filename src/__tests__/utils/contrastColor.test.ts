import { describe, it, expect } from 'vitest';
import { readableTextColor } from '@/utils/contrastColor';

describe('readableTextColor', () => {
  it('returns white text on a dark background', () => {
    expect(readableTextColor('#111827')).toBe('#ffffff'); // near-black
    expect(readableTextColor('#6366f1')).toBe('#ffffff'); // índigo (seed Soporte)
    expect(readableTextColor('#10b981')).toBe('#ffffff'); // esmeralda (seed Facturación)
  });

  it('returns dark text on a light background', () => {
    expect(readableTextColor('#ffffff')).toBe('#111827'); // white
    expect(readableTextColor('#f59e0b')).toBe('#111827'); // ámbar (seed Administración) — light enough for dark text
    expect(readableTextColor('#fde68a')).toBe('#111827'); // pale amber
  });

  it('accepts 3-digit shorthand hex', () => {
    expect(readableTextColor('#fff')).toBe('#111827');
    expect(readableTextColor('#000')).toBe('#ffffff');
  });

  it('falls back to dark text for an invalid color', () => {
    expect(readableTextColor('not-a-color')).toBe('#111827');
    expect(readableTextColor('')).toBe('#111827');
  });
});
