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
