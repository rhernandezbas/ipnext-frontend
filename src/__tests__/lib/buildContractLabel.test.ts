import { describe, it, expect } from 'vitest';
import { buildContractLabel } from '@/lib/buildContractLabel';

describe('buildContractLabel', () => {
  // Case 1: all fields present
  it('returns "plan - address - technology" when all fields are present', () => {
    expect(buildContractLabel({ id: 1, plan: 'Plan 100Mbps', address: 'Av. Test 123', technology: 'FTTH' }))
      .toBe('Plan 100Mbps - Av. Test 123 - FTTH');
  });

  // Case 2: plan + address, no technology
  it('returns "plan - address" when technology is absent', () => {
    expect(buildContractLabel({ id: 2, plan: 'Plan 50Mbps', address: 'Calle 1', technology: null }))
      .toBe('Plan 50Mbps - Calle 1');
  });

  // Case 3: plan + technology, no address
  it('returns "plan - technology" when address is absent', () => {
    expect(buildContractLabel({ id: 3, plan: 'Plan 200Mbps', address: null, technology: 'HFC' }))
      .toBe('Plan 200Mbps - HFC');
  });

  // Case 4: plan only
  it('returns just the plan when address and technology are absent', () => {
    expect(buildContractLabel({ id: 4, plan: 'Plan Básico', address: undefined, technology: undefined }))
      .toBe('Plan Básico');
  });

  // Case 5: no plan → fallback to "Contrato #id"
  it('returns "Contrato #id" when plan is absent', () => {
    expect(buildContractLabel({ id: 7, plan: '', address: 'Av. Test', technology: 'FTTH' }))
      .toBe('Contrato #7');
  });

  // Case 6: plan is null → fallback to "Contrato #id"
  it('returns "Contrato #id" when plan is null', () => {
    expect(buildContractLabel({ id: 8, plan: null, address: 'Av. Test', technology: 'FTTH' }))
      .toBe('Contrato #8');
  });

  // Case 7: empty string segments treated as absent
  it('treats empty-string address and technology as absent', () => {
    expect(buildContractLabel({ id: 9, plan: 'Plan X', address: '', technology: '' }))
      .toBe('Plan X');
  });

  // Case 8: UUID string id (CTU-1.2) — id widened to string | number
  it('accepts a UUID string id and renders it in the fallback', () => {
    expect(buildContractLabel({ id: 'c1', plan: null, address: 'Av. Test', technology: 'FTTH' }))
      .toBe('Contrato #c1');
  });
});
