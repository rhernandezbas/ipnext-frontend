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
      mk('1', 'radius_orchestrator'),
      mk('2', 'mikrotik_api'),
      mk('3', 'ubiquiti'),
      mk('4', 'radius_orchestrator'),
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
    const s = cutoverStats([mk('1', 'radius_orchestrator'), mk('2', 'mikrotik_api'), mk('3', 'mikrotik_api')]);
    expect(s.pct).toBe(33);
  });
});

describe('nextCutoverType (toggle del flip)', () => {
  it('legacy (mikrotik_api) → radius_orchestrator', () => {
    expect(nextCutoverType('mikrotik_api')).toBe('radius_orchestrator');
  });
  it('radius_orchestrator → mikrotik_api (volver a legacy)', () => {
    expect(nextCutoverType('radius_orchestrator')).toBe('mikrotik_api');
  });
  it('otro type (ubiquiti) → radius_orchestrator', () => {
    expect(nextCutoverType('ubiquiti')).toBe('radius_orchestrator');
  });
});

describe('isRadius', () => {
  it('true solo para radius_orchestrator', () => {
    expect(isRadius('radius_orchestrator')).toBe(true);
    expect(isRadius('mikrotik_api')).toBe(false);
    expect(isRadius('ubiquiti')).toBe(false);
  });

  it('otros types siguen siendo false', () => {
    expect(isRadius('cisco')).toBe(false);
    expect(isRadius('cambium')).toBe(false);
    expect(isRadius('other')).toBe(false);
  });
});

describe('cutoverStats con radius_orchestrator', () => {
  it('cuenta radius_orchestrator como NAS RADIUS', () => {
    const s = cutoverStats([
      mk('1', 'radius_orchestrator'),
      mk('2', 'radius_orchestrator'),
      mk('3', 'mikrotik_api'),
    ]);
    expect(s.total).toBe(3);
    expect(s.radius).toBe(2);
    expect(s.legacy).toBe(1);
    expect(s.pct).toBe(67);
  });

  it('solo radius_orchestrator → 100%', () => {
    const s = cutoverStats([mk('1', 'radius_orchestrator')]);
    expect(s.radius).toBe(1);
    expect(s.pct).toBe(100);
  });
});
