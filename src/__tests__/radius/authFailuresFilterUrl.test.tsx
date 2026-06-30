/**
 * useAuthFailuresFilterUrl — filtros URL del 3er tab "Errores de auth"
 * (/admin/networking/audit).
 *
 * Las claves se namespacean con el prefijo `auth_` (auth_username, auth_reply,
 * auth_from, auth_to, auth_page). Comparte el query string con los otros dos tabs
 * (logs_* y ne_*); estos tests prueban (1) el round-trip de filtros y (2) el
 * aislamiento total entre los TRES namespaces — ningún tab pisa al otro.
 */
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { useAuthFailuresFilterUrl } from '@/pages/radius/hooks/useAuthFailuresFilterUrl';
import { useRadiusLogsFilterUrl } from '@/pages/radius/hooks/useRadiusLogsFilterUrl';
import { useNe8000AuditFilterUrl } from '@/pages/radius/hooks/useNe8000AuditFilterUrl';

function wrapper({ initialUrl = '/' }: { initialUrl?: string }) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MemoryRouter initialEntries={[initialUrl]}>
        <Routes>
          <Route path="*" element={<>{children}</>} />
        </Routes>
      </MemoryRouter>
    );
  };
}

/** Render the three filter hooks under one router so they share a query string. */
function useAllHooks() {
  return {
    auth: useAuthFailuresFilterUrl(),
    logs: useRadiusLogsFilterUrl(),
    ne: useNe8000AuditFilterUrl(),
  };
}

describe('useAuthFailuresFilterUrl', () => {
  it('hace round-trip de sus filtros (username, reply, from, to, page)', () => {
    const { result } = renderHook(() => useAuthFailuresFilterUrl(), { wrapper: wrapper({}) });
    act(() => {
      result.current.setFilter({
        username: 'ana',
        reply: 'Access-Accept',
        from: '2026-06-01',
        to: '2026-06-30',
        page: 3,
      });
    });
    expect(result.current.filter.username).toBe('ana');
    expect(result.current.filter.reply).toBe('Access-Accept');
    expect(result.current.filter.from).toBe('2026-06-01');
    expect(result.current.filter.to).toBe('2026-06-30');
    expect(result.current.filter.page).toBe(3);
  });

  it('clearFilter borra solo SUS claves', () => {
    const { result } = renderHook(() => useAuthFailuresFilterUrl(), { wrapper: wrapper({}) });
    act(() => {
      result.current.setFilter({ username: 'ana', reply: 'Access-Reject' });
    });
    act(() => {
      result.current.clearFilter();
    });
    expect(result.current.filter.username).toBeUndefined();
    // reply queda en '' (no seteado en la URL)
    expect(result.current.filter.reply).toBe('');
  });

  it('lee claves auth_* desde la URL inicial (round-trip de bookmark)', () => {
    const { result } = renderHook(() => useAuthFailuresFilterUrl(), {
      wrapper: wrapper({ initialUrl: '/?auth_username=pedro&auth_reply=Access-Reject&auth_page=2' }),
    });
    expect(result.current.filter.username).toBe('pedro');
    expect(result.current.filter.reply).toBe('Access-Reject');
    expect(result.current.filter.page).toBe(2);
  });
});

// ── Ola 2: reason filter round-trip ──────────────────────────────────────────

describe('useAuthFailuresFilterUrl — reason (Ola 2)', () => {
  it('hace round-trip de reason: setFilter → URL → read', () => {
    const { result } = renderHook(() => useAuthFailuresFilterUrl(), { wrapper: wrapper({}) });
    act(() => {
      result.current.setFilter({ reason: 'session_stuck' });
    });
    expect(result.current.filter.reason).toBe('session_stuck');
  });

  it('setFilter({ reason: undefined }) limpia el reason', () => {
    const { result } = renderHook(() => useAuthFailuresFilterUrl(), { wrapper: wrapper({}) });
    act(() => {
      result.current.setFilter({ reason: 'user_not_found' });
    });
    act(() => {
      result.current.setFilter({ reason: undefined });
    });
    expect(result.current.filter.reason).toBeUndefined();
  });

  it('clearFilter también limpia reason', () => {
    const { result } = renderHook(() => useAuthFailuresFilterUrl(), { wrapper: wrapper({}) });
    act(() => {
      result.current.setFilter({ reason: 'other' });
    });
    act(() => {
      result.current.clearFilter();
    });
    expect(result.current.filter.reason).toBeUndefined();
  });

  it('lee auth_reason desde la URL inicial (round-trip de bookmark)', () => {
    const { result } = renderHook(() => useAuthFailuresFilterUrl(), {
      wrapper: wrapper({ initialUrl: '/?auth_reason=other' }),
    });
    expect(result.current.filter.reason).toBe('other');
  });

  it('los 3 valores válidos de reason hacen round-trip', () => {
    const reasons = ['session_stuck', 'user_not_found', 'other'] as const;
    for (const reason of reasons) {
      const { result } = renderHook(() => useAuthFailuresFilterUrl(), { wrapper: wrapper({}) });
      act(() => {
        result.current.setFilter({ reason });
      });
      expect(result.current.filter.reason).toBe(reason);
    }
  });
});

// ── Rango relativo (presets, ventana deslizante) + auto-refresh ───────────────

describe('useAuthFailuresFilterUrl — relativeRange (presets)', () => {
  it('hace round-trip de relativeRange: setFilter → URL → read', () => {
    const { result } = renderHook(() => useAuthFailuresFilterUrl(), { wrapper: wrapper({}) });
    act(() => {
      result.current.setFilter({ relativeRange: '5m' });
    });
    expect(result.current.filter.relativeRange).toBe('5m');
  });

  it('los 4 presets hacen round-trip', () => {
    const presets = ['5m', '1h', '24h', '7d'] as const;
    for (const preset of presets) {
      const { result } = renderHook(() => useAuthFailuresFilterUrl(), { wrapper: wrapper({}) });
      act(() => {
        result.current.setFilter({ relativeRange: preset });
      });
      expect(result.current.filter.relativeRange).toBe(preset);
    }
  });

  it('lee auth_range desde la URL inicial (bookmark)', () => {
    const { result } = renderHook(() => useAuthFailuresFilterUrl(), {
      wrapper: wrapper({ initialUrl: '/?auth_range=1h' }),
    });
    expect(result.current.filter.relativeRange).toBe('1h');
  });

  it('setFilter({ relativeRange: undefined }) limpia el preset', () => {
    const { result } = renderHook(() => useAuthFailuresFilterUrl(), { wrapper: wrapper({}) });
    act(() => {
      result.current.setFilter({ relativeRange: '24h' });
    });
    act(() => {
      result.current.setFilter({ relativeRange: undefined });
    });
    expect(result.current.filter.relativeRange).toBeUndefined();
  });

  it('clearFilter también limpia relativeRange y autoRefresh', () => {
    const { result } = renderHook(() => useAuthFailuresFilterUrl(), { wrapper: wrapper({}) });
    act(() => {
      result.current.setFilter({ relativeRange: '7d', autoRefresh: true });
    });
    act(() => {
      result.current.clearFilter();
    });
    expect(result.current.filter.relativeRange).toBeUndefined();
    expect(result.current.filter.autoRefresh).toBeUndefined();
  });
});

// ── MEDIO 1: validación de auth_range (basura en la URL no debe romper) ────────
// Un `?auth_range=5min` casteado sin validar → RELATIVE_RANGE_MS['5min'] undefined
// → new Date(NaN).toISOString() lanza RangeError + loop de error-polling. El
// filter-hook debe DESCARTAR cualquier valor fuera del set válido (5m|1h|24h|7d).
describe('useAuthFailuresFilterUrl — relativeRange validación (basura de la URL)', () => {
  it('ignora un auth_range basura (5min) → relativeRange undefined (no aplica modo relativo)', () => {
    const { result } = renderHook(() => useAuthFailuresFilterUrl(), {
      wrapper: wrapper({ initialUrl: '/?auth_range=5min' }),
    });
    expect(result.current.filter.relativeRange).toBeUndefined();
  });

  it('un auth_range válido (5m) SÍ se aplica', () => {
    const { result } = renderHook(() => useAuthFailuresFilterUrl(), {
      wrapper: wrapper({ initialUrl: '/?auth_range=5m' }),
    });
    expect(result.current.filter.relativeRange).toBe('5m');
  });

  it.each(['foo', '5', '60m', '1d', 'toString', '5 m'])(
    'descarta valores inválidos de auth_range (%s)',
    (bad) => {
      const { result } = renderHook(() => useAuthFailuresFilterUrl(), {
        wrapper: wrapper({ initialUrl: `/?auth_range=${encodeURIComponent(bad)}` }),
      });
      expect(result.current.filter.relativeRange).toBeUndefined();
    },
  );

  it('al re-escribir filtros, un auth_range basura preexistente NO sobrevive en la URL', () => {
    const { result } = renderHook(() => useAuthFailuresFilterUrl(), {
      wrapper: wrapper({ initialUrl: '/?auth_range=5min' }),
    });
    act(() => {
      result.current.setFilter({ username: 'ana' });
    });
    // El preset basura no debe re-emerger tras un setFilter de otro campo.
    expect(result.current.filter.relativeRange).toBeUndefined();
  });
});

describe('useAuthFailuresFilterUrl — autoRefresh (toggle, tri-state)', () => {
  it('autoRefresh arranca undefined (sin setear = default decide la page)', () => {
    const { result } = renderHook(() => useAuthFailuresFilterUrl(), { wrapper: wrapper({}) });
    expect(result.current.filter.autoRefresh).toBeUndefined();
  });

  it('hace round-trip de autoRefresh=true', () => {
    const { result } = renderHook(() => useAuthFailuresFilterUrl(), { wrapper: wrapper({}) });
    act(() => {
      result.current.setFilter({ autoRefresh: true });
    });
    expect(result.current.filter.autoRefresh).toBe(true);
  });

  it('hace round-trip de autoRefresh=false (apagado explícito)', () => {
    const { result } = renderHook(() => useAuthFailuresFilterUrl(), { wrapper: wrapper({}) });
    act(() => {
      result.current.setFilter({ autoRefresh: false });
    });
    expect(result.current.filter.autoRefresh).toBe(false);
  });

  it('lee auth_auto desde la URL inicial: 1→true, 0→false', () => {
    const on = renderHook(() => useAuthFailuresFilterUrl(), {
      wrapper: wrapper({ initialUrl: '/?auth_auto=1' }),
    });
    expect(on.result.current.filter.autoRefresh).toBe(true);

    const off = renderHook(() => useAuthFailuresFilterUrl(), {
      wrapper: wrapper({ initialUrl: '/?auth_auto=0' }),
    });
    expect(off.result.current.filter.autoRefresh).toBe(false);
  });
});

describe('NetworkAudit — aislamiento del tab "Errores de auth" frente a los otros 2', () => {
  it('un username en Errores de auth NO se filtra a Logs ni a NE8000 (sin leak)', () => {
    const { result } = renderHook(useAllHooks, { wrapper: wrapper({}) });
    act(() => {
      result.current.auth.setFilter({ username: 'auth-only' });
    });
    expect(result.current.auth.filter.username).toBe('auth-only');
    expect(result.current.logs.filter.username).toBeUndefined();
    expect(result.current.ne.filter.username).toBeUndefined();
  });

  it('setFilter en Errores de auth NO destruye los filtros de Logs ni NE8000', () => {
    const { result } = renderHook(useAllHooks, { wrapper: wrapper({}) });
    act(() => {
      result.current.logs.setFilter({ username: 'juan', eventType: 'start' });
    });
    act(() => {
      result.current.ne.setFilter({ status: 'disabled' });
    });
    act(() => {
      result.current.auth.setFilter({ username: 'ana', reply: 'Access-Reject', page: 5 });
    });
    // Los tres namespaces sobreviven independientes.
    expect(result.current.logs.filter.username).toBe('juan');
    expect(result.current.logs.filter.eventType).toBe('start');
    expect(result.current.ne.filter.status).toBe('disabled');
    expect(result.current.auth.filter.username).toBe('ana');
    expect(result.current.auth.filter.reply).toBe('Access-Reject');
    expect(result.current.auth.filter.page).toBe(5);
  });

  it('page y username de los 3 tabs son independientes (mismas claves base)', () => {
    const { result } = renderHook(useAllHooks, { wrapper: wrapper({}) });
    act(() => {
      result.current.logs.setFilter({ username: 'l', page: 4 });
    });
    act(() => {
      result.current.ne.setFilter({ username: 'n', page: 3 });
    });
    act(() => {
      result.current.auth.setFilter({ username: 'a', page: 2 });
    });
    expect(result.current.logs.filter.username).toBe('l');
    expect(result.current.logs.filter.page).toBe(4);
    expect(result.current.ne.filter.username).toBe('n');
    expect(result.current.ne.filter.page).toBe(3);
    expect(result.current.auth.filter.username).toBe('a');
    expect(result.current.auth.filter.page).toBe(2);
  });
});
