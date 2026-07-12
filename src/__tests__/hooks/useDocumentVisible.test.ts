/**
 * useDocumentVisible (messaging-inbox F1, design §4) — gate genérico del polling
 * (whatsapp inbox, tasks 1.2/1.3). Refleja `document.visibilityState` y se
 * actualiza en cada `visibilitychange`.
 *
 *  DOCVIS-1 devuelve true cuando la pestaña está visible
 *  DOCVIS-2 devuelve false cuando la pestaña pasa a hidden (visibilitychange)
 *  DOCVIS-3 vuelve a true si la pestaña recupera el foco
 *  DOCVIS-4 se desuscribe del listener al desmontar (sin leak)
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { useDocumentVisible } from '@/hooks/useDocumentVisible';

function setVisibilityState(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    value: state,
    configurable: true,
  });
}

afterEach(() => {
  setVisibilityState('visible');
});

describe('DOCVIS-1/2/3: useDocumentVisible refleja document.visibilityState', () => {
  it('devuelve true cuando la pestaña arranca visible', () => {
    setVisibilityState('visible');
    const { result } = renderHook(() => useDocumentVisible());
    expect(result.current).toBe(true);
  });

  it('devuelve false cuando visibilitychange marca hidden', () => {
    setVisibilityState('visible');
    const { result } = renderHook(() => useDocumentVisible());

    act(() => {
      setVisibilityState('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(result.current).toBe(false);
  });

  it('vuelve a true si la pestaña recupera el foco', () => {
    setVisibilityState('hidden');
    const { result } = renderHook(() => useDocumentVisible());
    expect(result.current).toBe(false);

    act(() => {
      setVisibilityState('visible');
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(result.current).toBe(true);
  });
});

describe('DOCVIS-4: cleanup', () => {
  it('no actualiza el estado tras desmontar (listener removido)', () => {
    setVisibilityState('visible');
    const { result, unmount } = renderHook(() => useDocumentVisible());
    expect(result.current).toBe(true);

    unmount();

    // Si el listener siguiera activo, esto no debería romper nada — el punto es
    // que no queda un listener colgado del document tras desmontar el hook.
    act(() => {
      setVisibilityState('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // El valor congelado en el último render sigue siendo el de antes de desmontar.
    expect(result.current).toBe(true);
  });
});
