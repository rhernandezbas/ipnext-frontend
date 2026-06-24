/**
 * Aislamiento de filtros URL entre los 2 tabs de NetworkAuditPage (/admin/networking/audit).
 *
 * Los hooks useRadiusLogsFilterUrl y useNe8000AuditFilterUrl operan sobre el MISMO
 * query string. Antes del fix compartían las claves planas `username`/`online`/`page`,
 * lo que producía: (1) leak entre tabs, (2) destrucción de los filtros del otro tab
 * al hacer setFilter (cada hook reconstruía el URLSearchParams solo con SUS claves).
 *
 * El fix namespacea las claves por tab: `logs_*` para Logs RADIUS y `ne_*` para NE8000.
 * Estos tests demuestran el aislamiento: cada namespace es independiente y un tab nunca
 * pisa al otro.
 */
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
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

/** Render both hooks under the same router so they share one query string. */
function useBothHooks() {
  return {
    logs: useRadiusLogsFilterUrl(),
    ne: useNe8000AuditFilterUrl(),
  };
}

describe('NetworkAudit — aislamiento de filtros URL entre tabs', () => {
  it('useRadiusLogsFilterUrl namespacea sus claves bajo logs_*', () => {
    const { result } = renderHook(() => useRadiusLogsFilterUrl(), { wrapper: wrapper({}) });
    act(() => {
      result.current.setFilter({ username: 'juan', eventType: 'start', page: 3 });
    });
    expect(result.current.filter.username).toBe('juan');
    expect(result.current.filter.eventType).toBe('start');
    expect(result.current.filter.page).toBe(3);
  });

  it('useNe8000AuditFilterUrl namespacea sus claves bajo ne_*', () => {
    const { result } = renderHook(() => useNe8000AuditFilterUrl(), { wrapper: wrapper({}) });
    act(() => {
      result.current.setFilter({ username: 'maria', status: 'enabled', page: 2 });
    });
    expect(result.current.filter.username).toBe('maria');
    expect(result.current.filter.status).toBe('enabled');
    expect(result.current.filter.page).toBe(2);
  });

  it('un username seteado en Logs NO aparece pre-poblado en NE8000 (sin leak)', () => {
    const { result } = renderHook(useBothHooks, { wrapper: wrapper({}) });
    act(() => {
      result.current.logs.setFilter({ username: 'logs-only' });
    });
    expect(result.current.logs.filter.username).toBe('logs-only');
    // El hook NE8000 NO debe ver el username del tab Logs.
    expect(result.current.ne.filter.username).toBeUndefined();
  });

  it('un username seteado en NE8000 NO aparece pre-poblado en Logs (sin leak)', () => {
    const { result } = renderHook(useBothHooks, { wrapper: wrapper({}) });
    act(() => {
      result.current.ne.setFilter({ username: 'ne-only' });
    });
    expect(result.current.ne.filter.username).toBe('ne-only');
    expect(result.current.logs.filter.username).toBeUndefined();
  });

  it('setFilter en NE8000 NO destruye los filtros del tab Logs (preservación cruzada)', () => {
    const { result } = renderHook(useBothHooks, { wrapper: wrapper({}) });
    // 1) El usuario filtra en el tab Logs.
    act(() => {
      result.current.logs.setFilter({ username: 'juan', eventType: 'start', from: '2026-06-01' });
    });
    // 2) Cambia al tab NE8000 y filtra ahí.
    act(() => {
      result.current.ne.setFilter({ status: 'disabled', enforcedState: 'blocked' });
    });
    // 3) Los filtros del tab Logs SIGUEN intactos.
    expect(result.current.logs.filter.username).toBe('juan');
    expect(result.current.logs.filter.eventType).toBe('start');
    expect(result.current.logs.filter.from).toBe('2026-06-01');
    // Y los del NE8000 también.
    expect(result.current.ne.filter.status).toBe('disabled');
    expect(result.current.ne.filter.enforcedState).toBe('blocked');
  });

  it('online y page de cada tab son independientes (las 3 claves antes colisionaban)', () => {
    const { result } = renderHook(useBothHooks, { wrapper: wrapper({}) });
    act(() => {
      result.current.logs.setFilter({ online: 'true', page: 4 });
    });
    act(() => {
      result.current.ne.setFilter({ online: 'false', page: 2 });
    });
    expect(result.current.logs.filter.online).toBe('true');
    expect(result.current.logs.filter.page).toBe(4);
    expect(result.current.ne.filter.online).toBe('false');
    expect(result.current.ne.filter.page).toBe(2);
  });

  it('lee claves namespaceadas desde la URL inicial (round-trip de bookmarks nuevos)', () => {
    const { result } = renderHook(useBothHooks, {
      wrapper: wrapper({ initialUrl: '/?logs_username=ana&logs_eventType=stop&ne_username=pedro&ne_status=enabled' }),
    });
    expect(result.current.logs.filter.username).toBe('ana');
    expect(result.current.logs.filter.eventType).toBe('stop');
    expect(result.current.ne.filter.username).toBe('pedro');
    expect(result.current.ne.filter.status).toBe('enabled');
  });
});
