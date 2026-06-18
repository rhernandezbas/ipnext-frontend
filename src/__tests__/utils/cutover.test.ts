import { describe, it, expect } from 'vitest';
import { cutoverStats, nextCutoverType, isRadius } from '@/utils/cutover';
import type { NasServer, NasType } from '@/types/nas';

const mk = (id: string, type: NasType): NasServer => ({
  id,
  name: `nas-${id}`,
  type,
  ipAddress: '1.1.1.1',
  radiusSecret: '',
  nasIpAddress: '1.1.1.1',
  apiPort: null,
  apiLogin: null,
  apiPassword: null,
  status: 'active',
  lastSeen: null,
  clientCount: 0,
  description: '',
});

describe('cutoverStats', () => {
  it('cuenta radius vs legacy + pct', () => {
    const s = cutoverStats([
      mk('1', 'mikrotik_radius'),
      mk('2', 'mikrotik_api'),
      mk('3', 'ubiquiti'),
      mk('4', 'mikrotik_radius'),
    ]);
    expect(s.total).toBe(4);
    expect(s.radius).toBe(2);
    expect(s.legacy).toBe(2); // mikrotik_api + ubiquiti son "no-radius"
    expect(s.pct).toBe(50);
  });

  it('lista vacia → todo 0, sin dividir por cero', () => {
    expect(cutoverStats([])).toEqual({ total: 0, radius: 0, legacy: 0, pct: 0 });
  });

  it('redondea el pct', () => {
    const s = cutoverStats([mk('1', 'mikrotik_radius'), mk('2', 'mikrotik_api'), mk('3', 'mikrotik_api')]);
    expect(s.pct).toBe(33);
  });
});

describe('nextCutoverType (toggle del flip)', () => {
  it('legacy (mikrotik_api) → mikrotik_radius', () => {
    expect(nextCutoverType('mikrotik_api')).toBe('mikrotik_radius');
  });
  it('mikrotik_radius → mikrotik_api (volver a legacy)', () => {
    expect(nextCutoverType('mikrotik_radius')).toBe('mikrotik_api');
  });
  it('otro type (ubiquiti) → mikrotik_radius', () => {
    expect(nextCutoverType('ubiquiti')).toBe('mikrotik_radius');
  });
});

describe('isRadius', () => {
  it('true solo para mikrotik_radius', () => {
    expect(isRadius('mikrotik_radius')).toBe(true);
    expect(isRadius('mikrotik_api')).toBe(false);
    expect(isRadius('ubiquiti')).toBe(false);
  });
});
