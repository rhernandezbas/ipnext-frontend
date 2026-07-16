import { describe, it, expect } from 'vitest';
import {
  isCureSkippedAlive,
  isCureSkippedAmbiguous,
  isCureGateRejection,
  isOrchestratorUnreachable,
  cureErrorReason,
} from '@/utils/mapCureSessionError';

function axiosError(status: number, data: { code?: string; message?: string }) {
  return { response: { status, data } };
}

describe('mapCureSessionError', () => {
  it('isCureSkippedAlive — true on 409 CURE_SKIPPED_ALIVE', () => {
    expect(isCureSkippedAlive(axiosError(409, { code: 'CURE_SKIPPED_ALIVE' }))).toBe(true);
  });

  it('isCureSkippedAlive — false on 409 with a different code', () => {
    expect(isCureSkippedAlive(axiosError(409, { code: 'CURE_SKIPPED_AMBIGUOUS' }))).toBe(false);
  });

  it('isCureSkippedAmbiguous — true on 409 CURE_SKIPPED_AMBIGUOUS', () => {
    expect(isCureSkippedAmbiguous(axiosError(409, { code: 'CURE_SKIPPED_AMBIGUOUS' }))).toBe(true);
  });

  it('isCureGateRejection — true for either gate code', () => {
    expect(isCureGateRejection(axiosError(409, { code: 'CURE_SKIPPED_ALIVE' }))).toBe(true);
    expect(isCureGateRejection(axiosError(409, { code: 'CURE_SKIPPED_AMBIGUOUS' }))).toBe(true);
  });

  it('isCureGateRejection — false for a 502 (NOT a gate — no force offered)', () => {
    expect(isCureGateRejection(axiosError(502, { code: 'ORCHESTRATOR_UNREACHABLE' }))).toBe(false);
  });

  it('isOrchestratorUnreachable — true on 502 ORCHESTRATOR_UNREACHABLE', () => {
    expect(isOrchestratorUnreachable(axiosError(502, { code: 'ORCHESTRATOR_UNREACHABLE' }))).toBe(true);
  });

  it('isOrchestratorUnreachable — false on an unrelated 502', () => {
    expect(isOrchestratorUnreachable(axiosError(502, {}))).toBe(false);
  });

  it('cureErrorReason — reads the REAL motivo from response.data.message', () => {
    expect(cureErrorReason(axiosError(409, { message: 'sesión activa hace 2 min' }), 'fallback')).toBe(
      'sesión activa hace 2 min',
    );
  });

  it('cureErrorReason — falls back on a network error with no response', () => {
    expect(cureErrorReason(new Error('Network Error'), 'fallback')).toBe('fallback');
  });

  it('all predicates are false for a plain network error (no response)', () => {
    const err = new Error('Network Error');
    expect(isCureSkippedAlive(err)).toBe(false);
    expect(isCureSkippedAmbiguous(err)).toBe(false);
    expect(isOrchestratorUnreachable(err)).toBe(false);
  });
});
