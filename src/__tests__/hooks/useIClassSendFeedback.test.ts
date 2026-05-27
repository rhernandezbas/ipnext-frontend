import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useIClassSendFeedback, parseIClassError } from '@/hooks/useIClassSendFeedback';

describe('parseIClassError', () => {
  it('extracts an IClass error from an axios-shaped error', () => {
    const err = { response: { data: { code: 'MISSING_REQUIRED_FIELDS', missingFields: ['phone'] } } };
    expect(parseIClassError(err)).toEqual({ code: 'MISSING_REQUIRED_FIELDS', missingFields: ['phone'] });
  });

  it('extracts ICLASS_NODE_NOT_FOUND', () => {
    const err = { response: { data: { code: 'ICLASS_NODE_NOT_FOUND' } } };
    expect(parseIClassError(err)).toEqual({ code: 'ICLASS_NODE_NOT_FOUND', missingFields: undefined, message: undefined });
  });

  it('extracts ICLASS_REJECTED including the reason', () => {
    const err = { response: { data: { code: 'ICLASS_REJECTED', reason: 'ICLERR_0045: codigoCliente ultrapassou o limite' } } };
    expect(parseIClassError(err)).toEqual({
      code: 'ICLASS_REJECTED',
      missingFields: undefined,
      message: undefined,
      reason: 'ICLERR_0045: codigoCliente ultrapassou o limite',
    });
  });

  it('returns null for a non-IClass error code', () => {
    const err = { response: { data: { code: 'VALIDATION_ERROR' } } };
    expect(parseIClassError(err)).toBeNull();
  });

  it('returns null when there is no response data', () => {
    expect(parseIClassError(new Error('boom'))).toBeNull();
    expect(parseIClassError(null)).toBeNull();
  });
});

describe('useIClassSendFeedback', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('opens the modal for an IClass error and reports it was handled', () => {
    const { result } = renderHook(() => useIClassSendFeedback());
    let handled = false;
    act(() => {
      handled = result.current.handleError({ response: { data: { code: 'ICLASS_UNAVAILABLE' } } });
    });
    expect(handled).toBe(true);
    expect(result.current.error).toEqual({ code: 'ICLASS_UNAVAILABLE', missingFields: undefined, message: undefined });
  });

  it('does NOT open the modal for a non-IClass error', () => {
    const { result } = renderHook(() => useIClassSendFeedback());
    let handled = true;
    act(() => {
      handled = result.current.handleError({ response: { data: { code: 'OTHER' } } });
    });
    expect(handled).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('closeModal clears the error', () => {
    const { result } = renderHook(() => useIClassSendFeedback());
    act(() => { result.current.handleError({ response: { data: { code: 'ICLASS_UNAVAILABLE' } } }); });
    act(() => { result.current.closeModal(); });
    expect(result.current.error).toBeNull();
  });

  it('handleSuccess sets a toast with the iclassOrderCode', () => {
    const { result } = renderHook(() => useIClassSendFeedback());
    act(() => { result.current.handleSuccess('OS-12345'); });
    expect(result.current.toast).toContain('OS-12345');
  });

  it('handleSuccess with null code does not set a toast', () => {
    const { result } = renderHook(() => useIClassSendFeedback());
    act(() => { result.current.handleSuccess(null); });
    expect(result.current.toast).toBeNull();
  });

  it('toast auto-dismisses after 4s', () => {
    const { result } = renderHook(() => useIClassSendFeedback());
    act(() => { result.current.handleSuccess('OS-1'); });
    expect(result.current.toast).not.toBeNull();
    act(() => { vi.advanceTimersByTime(4000); });
    expect(result.current.toast).toBeNull();
  });
});
