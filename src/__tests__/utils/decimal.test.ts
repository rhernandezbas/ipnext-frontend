import { describe, it, expect } from 'vitest';
import { parseArDecimal, toDecimalNumber } from '@/utils/decimal';

describe('parseArDecimal', () => {
  it('parsea "45.000,50" (miles + decimal es-AR) a 45000.5', () => {
    expect(parseArDecimal('45.000,50')).toBe(45000.5);
  });

  it('parsea un entero sin separadores', () => {
    expect(parseArDecimal('45000')).toBe(45000);
  });

  it('parsea un decimal con punto cuando NO hay coma (defensivo)', () => {
    expect(parseArDecimal('45000.5')).toBe(45000.5);
  });

  it('devuelve null para vacío', () => {
    expect(parseArDecimal('')).toBeNull();
    expect(parseArDecimal('   ')).toBeNull();
  });

  it('devuelve null para texto no numérico', () => {
    expect(parseArDecimal('abc')).toBeNull();
    expect(parseArDecimal('45.000,50,00')).toBeNull();
  });

  it('devuelve null para negativos', () => {
    expect(parseArDecimal('-500')).toBeNull();
  });
});

describe('toDecimalNumber', () => {
  it('devuelve el mismo number si ya es number', () => {
    expect(toDecimalNumber(45000.5)).toBe(45000.5);
  });

  it('convierte un string decimal del BE a number', () => {
    expect(toDecimalNumber('45000.50')).toBe(45000.5);
  });

  it('cae a 0 si el string es inválido', () => {
    expect(toDecimalNumber('not-a-number')).toBe(0);
  });
});
