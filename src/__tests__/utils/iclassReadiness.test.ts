/**
 * iclassReadiness — pure helper
 *
 * SCEN-ICR-01: both address and city empty → missing both
 * SCEN-ICR-02: address filled, city empty → missing Ciudad
 * SCEN-ICR-03: address empty, city filled → missing Dirección
 * SCEN-ICR-04: both filled (even whitespace-only treated as empty) → ready
 */
import { describe, it, expect } from 'vitest';
import { iclassReadiness } from '@/utils/iclassReadiness';

describe('iclassReadiness', () => {
  it('SCEN-ICR-01: both address and city empty → not ready, both missing', () => {
    const result = iclassReadiness({ address: '', city: '' });
    expect(result.ready).toBe(false);
    expect(result.missing).toEqual(['Dirección', 'Ciudad']);
  });

  it('SCEN-ICR-02: address filled, city empty → missing Ciudad only', () => {
    const result = iclassReadiness({ address: 'Av. Corrientes 1234', city: '' });
    expect(result.ready).toBe(false);
    expect(result.missing).toEqual(['Ciudad']);
  });

  it('SCEN-ICR-03: address empty, city filled → missing Dirección only', () => {
    const result = iclassReadiness({ address: '', city: 'Buenos Aires' });
    expect(result.ready).toBe(false);
    expect(result.missing).toEqual(['Dirección']);
  });

  it('SCEN-ICR-04: whitespace-only address treated as empty, valid city → missing Dirección', () => {
    const result = iclassReadiness({ address: '   ', city: 'Córdoba' });
    expect(result.ready).toBe(false);
    expect(result.missing).toEqual(['Dirección']);
  });

  it('SCEN-ICR-05: both filled → ready, no missing', () => {
    const result = iclassReadiness({ address: 'Ruta 5 Km 93', city: 'Altamira' });
    expect(result.ready).toBe(true);
    expect(result.missing).toEqual([]);
  });
});
