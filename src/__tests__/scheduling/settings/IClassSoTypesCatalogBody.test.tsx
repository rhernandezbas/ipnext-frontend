import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/hooks/useIClassSoTypes', () => ({
  useIClassSoTypes: vi.fn(),
  useSyncIClassSoTypes: vi.fn(),
}));

import { useIClassSoTypes, useSyncIClassSoTypes } from '@/hooks/useIClassSoTypes';
import { IClassSoTypesCatalogBody } from '@/pages/scheduling/settings/IClassSoTypesCatalogBody';
import type { IClassSoType } from '@/types/iclassSoType';

const makeType = (overrides: Partial<IClassSoType> = {}): IClassSoType => ({
  id: 't1',
  code: 'INSTALACION FIBRA',
  description: 'PADRON',
  active: true,
  lastSyncedAt: '2026-05-28T12:00:00Z',
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-28T12:00:00Z',
  ...overrides,
});

const idleSync = {
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
  reset: vi.fn(),
};

function mockTypes(types: IClassSoType[] | null, loading = false) {
  vi.mocked(useIClassSoTypes).mockReturnValue({
    data: types ?? undefined,
    isLoading: loading,
    isError: false,
    isSuccess: !loading && types !== null,
  } as never);
}

describe('IClassSoTypesCatalogBody', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSyncIClassSoTypes).mockReturnValue(idleSync as never);
  });

  it('renders loading state', () => {
    mockTypes(null, true);
    render(<IClassSoTypesCatalogBody />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('renders empty state with sync CTA when there are no types', () => {
    mockTypes([]);
    render(<IClassSoTypesCatalogBody />);
    expect(screen.getByText(/catálogo vacío/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sincronizar ahora/i })).toBeInTheDocument();
  });

  it('renders the helper copy explaining the catalog is read-only', () => {
    mockTypes([makeType()]);
    render(<IClassSoTypesCatalogBody />);
    expect(screen.getByText(/sincronizado desde iclass/i)).toBeInTheDocument();
  });

  it('renders a table row per type with code, description and active badge', () => {
    mockTypes([
      makeType({ id: '1', code: 'INSTALACION FIBRA', active: true }),
      makeType({ id: '2', code: 'BAJA DE SERVICIO', active: false }),
    ]);
    render(<IClassSoTypesCatalogBody />);
    expect(screen.getByText('INSTALACION FIBRA')).toBeInTheDocument();
    expect(screen.getByText('BAJA DE SERVICIO')).toBeInTheDocument();
    expect(screen.getByText('Activo')).toBeInTheDocument();
    expect(screen.getByText('Inactivo')).toBeInTheDocument();
  });

  it('defaults to showing only active types (calls useIClassSoTypes(true))', () => {
    mockTypes([makeType()]);
    render(<IClassSoTypesCatalogBody />);
    expect(useIClassSoTypes).toHaveBeenCalledWith(true);
  });

  it('toggling "mostrar inactivos también" calls useIClassSoTypes(undefined)', () => {
    mockTypes([makeType()]);
    render(<IClassSoTypesCatalogBody />);
    fireEvent.click(screen.getByLabelText(/mostrar inactivos/i));
    expect(useIClassSoTypes).toHaveBeenLastCalledWith(undefined);
  });

  it('click on "Sincronizar ahora" calls sync.mutateAsync', async () => {
    mockTypes([makeType()]);
    const mutateAsync = vi.fn().mockResolvedValue({ synced: 26, created: 1, updated: 25, reactivated: 0, deactivated: 0 });
    vi.mocked(useSyncIClassSoTypes).mockReturnValue({ ...idleSync, mutateAsync } as never);

    render(<IClassSoTypesCatalogBody />);
    fireEvent.click(screen.getByRole('button', { name: /sincronizar ahora/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
  });

  it('shows a summary banner after a successful sync', async () => {
    mockTypes([makeType()]);
    const mutateAsync = vi.fn().mockResolvedValue({ synced: 27, created: 1, updated: 25, reactivated: 1, deactivated: 0 });
    vi.mocked(useSyncIClassSoTypes).mockReturnValue({ ...idleSync, mutateAsync } as never);

    render(<IClassSoTypesCatalogBody />);
    fireEvent.click(screen.getByRole('button', { name: /sincronizar ahora/i }));

    await waitFor(() => {
      expect(screen.getByText(/27/)).toBeInTheDocument();
      expect(screen.getByText(/1 nuevos/i)).toBeInTheDocument();
    });
  });

  it('disables the sync button while the mutation is pending', () => {
    mockTypes([makeType()]);
    vi.mocked(useSyncIClassSoTypes).mockReturnValue({ ...idleSync, isPending: true } as never);

    render(<IClassSoTypesCatalogBody />);
    expect(screen.getByRole('button', { name: /sincronizando/i })).toBeDisabled();
  });

  it('shows a sync error message when the mutation fails', () => {
    mockTypes([makeType()]);
    vi.mocked(useSyncIClassSoTypes).mockReturnValue({ ...idleSync, isError: true, error: new Error('boom') } as never);

    render(<IClassSoTypesCatalogBody />);
    expect(screen.getByText(/no se pudo sincronizar/i)).toBeInTheDocument();
  });
});
