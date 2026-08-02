import { describe, it, expect } from 'vitest';
import { deriveProductStatus } from '@/utils/productStatus';

describe('deriveProductStatus', () => {
  it('draft: active=false, sin archivar', () => {
    expect(deriveProductStatus({ active: false, archivedAt: null })).toBe('draft');
  });

  it('active: active=true, sin archivar', () => {
    expect(deriveProductStatus({ active: true, archivedAt: null })).toBe('active');
  });

  it('archived: archivedAt seteado pisa a active=true', () => {
    expect(deriveProductStatus({ active: true, archivedAt: '2026-01-01T00:00:00.000Z' })).toBe('archived');
  });

  it('archived: archivedAt seteado pisa a active=false también', () => {
    expect(deriveProductStatus({ active: false, archivedAt: '2026-01-01T00:00:00.000Z' })).toBe('archived');
  });
});
