import { describe, it, expect } from 'vitest';
import {
  ESTADOS_CATALOG,
  estadosEqual,
  INTERVAL_PRESETS_MIN,
  minutesToMs,
  resolveIntervalPreset,
} from '@/types/gestionRealSync';
import {
  INTERVAL_PRESETS_MIN as INGEST_PRESETS,
  minutesToMs as ingestMinutesToMs,
  resolveIntervalPreset as ingestResolve,
} from '@/types/gestionRealIngest';

describe('ESTADOS_CATALOG', () => {
  it('values match the backend whitelist in order', () => {
    expect(ESTADOS_CATALOG.map(e => e.value)).toEqual(['1', '2', '3', '4', '6']);
  });

  it('labels are Activo/Deudor/Inactivo/Incobrable/Baja', () => {
    expect(ESTADOS_CATALOG.map(e => e.label)).toEqual([
      'Activo',
      'Deudor',
      'Inactivo',
      'Incobrable',
      'Baja',
    ]);
  });
});

describe('interval helpers are reused from gestionRealIngest (no local copy)', () => {
  it('re-exports the exact same references', () => {
    expect(INTERVAL_PRESETS_MIN).toBe(INGEST_PRESETS);
    expect(minutesToMs).toBe(ingestMinutesToMs);
    expect(resolveIntervalPreset).toBe(ingestResolve);
  });
});

describe('estadosEqual (set equality)', () => {
  it('true for same set regardless of order', () => {
    expect(estadosEqual(['1', '3'], ['3', '1'])).toBe(true);
  });

  it('false for different length', () => {
    expect(estadosEqual(['1'], ['1', '2'])).toBe(false);
  });

  it('false for same length, different members', () => {
    expect(estadosEqual(['1', '2'], ['1', '3'])).toBe(false);
  });

  it('true for two empty sets', () => {
    expect(estadosEqual([], [])).toBe(true);
  });
});
