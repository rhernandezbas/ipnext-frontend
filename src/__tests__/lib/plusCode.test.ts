import { describe, it, expect } from 'vitest';
import { encodePlusCode } from '@/lib/plusCode';

describe('encodePlusCode', () => {
  it('returns a string in Plus Code format (XXXXXXXX+XX)', () => {
    const code = encodePlusCode(-34.6, -58.38);
    // Must match the OLC pattern: 8 chars + '+' + 2 chars
    expect(code).toMatch(/^[23456789CFGHJMPQRVWX]{8}\+[23456789CFGHJMPQRVWX]{2}$/);
  });

  it('encodes Buenos Aires center to the expected OLC prefix', () => {
    // -34.6, -58.38 → OLC prefix 48Q3
    // Google Maps shows "48Q3+RC" for approx this location
    const code = encodePlusCode(-34.6, -58.38);
    expect(code.startsWith('48Q3')).toBe(true);
  });

  it('encodes Google HQ (Mountain View) with correct prefix', () => {
    // 37.422, -122.084 — well-known test point
    const code = encodePlusCode(37.422, -122.084);
    // OLC for Google HQ starts with "849V"
    expect(code.startsWith('849V')).toBe(true);
  });

  it('encodes origin (0, 0) without error', () => {
    const code = encodePlusCode(0, 0);
    expect(code).toMatch(/^[23456789CFGHJMPQRVWX]{8}\+[23456789CFGHJMPQRVWX]{2}$/);
  });

  it('encodes extreme lat/lng (-90, -180) without error', () => {
    const code = encodePlusCode(-90, -180);
  expect(code).toMatch(/^[23456789CFGHJMPQRVWX]{8}\+[23456789CFGHJMPQRVWX]{2}$/);
  });

  it('encodes extreme lat/lng (90, 180) without error', () => {
    const code = encodePlusCode(90, 180);
    expect(code).toMatch(/^[23456789CFGHJMPQRVWX]{8}\+[23456789CFGHJMPQRVWX]{2}$/);
  });

  it('is deterministic — same input gives same output', () => {
    const a = encodePlusCode(-34.6032, -58.3816);
    const b = encodePlusCode(-34.6032, -58.3816);
    expect(a).toBe(b);
  });

  it('produces different codes for clearly different points', () => {
    const a = encodePlusCode(-34.6, -58.38);
    const b = encodePlusCode(40.7128, -74.006); // NYC
    expect(a).not.toBe(b);
  });
});
