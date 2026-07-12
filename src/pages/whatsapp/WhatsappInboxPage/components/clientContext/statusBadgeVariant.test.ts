import { describe, it, expect } from 'vitest';
import { toStatusBadgeVariant } from './statusBadgeVariant';

describe('toStatusBadgeVariant', () => {
  it('devuelve el mismo valor para los 5 status conocidos', () => {
    expect(toStatusBadgeVariant('active')).toBe('active');
    expect(toStatusBadgeVariant('late')).toBe('late');
    expect(toStatusBadgeVariant('blocked')).toBe('blocked');
    expect(toStatusBadgeVariant('inactive')).toBe('inactive');
    expect(toStatusBadgeVariant('baja')).toBe('baja');
  });

  it('un status desconocido (catálogo dinámico) cae a "inactive" en vez de romper', () => {
    expect(toStatusBadgeVariant('algo-nuevo-del-mirror')).toBe('inactive');
    expect(toStatusBadgeVariant('')).toBe('inactive');
  });
});
