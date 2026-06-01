import { renderHook, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { useTicketsFilterUrl } from '@/pages/tickets/TicketsListPage/hooks/useTicketsFilterUrl';

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

describe('useTicketsFilterUrl', () => {
  it('returns empty filter by default', () => {
    const { result } = renderHook(() => useTicketsFilterUrl(), {
      wrapper: wrapper({}),
    });
    const { filter } = result.current;
    expect(filter.status).toBeUndefined();
    expect(filter.priority).toBeUndefined();
    expect(filter.assignedTo).toBeUndefined();
    expect(filter.q).toBeUndefined();
    expect(filter.customerId).toBeUndefined();
    expect(filter.from).toBeUndefined();
    expect(filter.to).toBeUndefined();
  });

  it('reads initial URL params', () => {
    const { result } = renderHook(() => useTicketsFilterUrl(), {
      wrapper: wrapper({ initialUrl: '/?status=abierto&priority=high&q=fibra&customerId=7&from=2024-01-01&to=2024-12-31&assignedTo=42' }),
    });
    const { filter } = result.current;
    expect(filter.status).toBe('abierto');
    expect(filter.priority).toBe('high');
    expect(filter.q).toBe('fibra');
    expect(filter.customerId).toBe('7');
    expect(filter.from).toBe('2024-01-01');
    expect(filter.to).toBe('2024-12-31');
    expect(filter.assignedTo).toBe('42');
  });

  it('setFilter updates a single param (merge)', () => {
    const { result } = renderHook(() => useTicketsFilterUrl(), {
      wrapper: wrapper({ initialUrl: '/?status=abierto&priority=high' }),
    });
    act(() => {
      result.current.setFilter({ q: 'fibra' });
    });
    expect(result.current.filter.status).toBe('abierto');
    expect(result.current.filter.priority).toBe('high');
    expect(result.current.filter.q).toBe('fibra');
  });

  it('setFilter with undefined key clears that param', () => {
    const { result } = renderHook(() => useTicketsFilterUrl(), {
      wrapper: wrapper({ initialUrl: '/?status=abierto' }),
    });
    act(() => {
      result.current.setFilter({ status: undefined });
    });
    expect(result.current.filter.status).toBeUndefined();
  });

  it('clearFilter removes all params', () => {
    const { result } = renderHook(() => useTicketsFilterUrl(), {
      wrapper: wrapper({ initialUrl: '/?status=abierto&priority=high&q=fibra' }),
    });
    act(() => {
      result.current.clearFilter();
    });
    const { filter } = result.current;
    expect(filter.status).toBeUndefined();
    expect(filter.priority).toBeUndefined();
    expect(filter.q).toBeUndefined();
  });
});
