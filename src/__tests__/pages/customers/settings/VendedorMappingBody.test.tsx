import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/hooks/useGrVendedorMappings', () => ({
  useGrVendedorMappings: vi.fn(),
  useGrVendedores: vi.fn(),
  useSetGrVendedorMapping: vi.fn(),
}));
// Note: useMyPermissions is globally mocked in src/test/setup.ts (permissive by default).
// Tests that need the denied path override it explicitly.

import {
  useGrVendedorMappings,
  useGrVendedores,
  useSetGrVendedorMapping,
} from '@/hooks/useGrVendedorMappings';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { VendedorMappingBody } from '@/pages/customers/settings/VendedorMappingBody';
import type { VendedorMappingItem } from '@/types/grVendedorMapping';

const makeItem = (over: Partial<VendedorMappingItem> = {}): VendedorMappingItem => ({
  userId: 'u1',
  userName: 'Ana Pérez',
  userLogin: 'aperez',
  grVendedorName: null,
  ...over,
});

const idleMutation = {
  mutate: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue(undefined),
  isPending: false,
  isError: false,
  error: null,
  reset: vi.fn(),
};

function mockMappings(
  items: VendedorMappingItem[] | null,
  opts: { loading?: boolean; isError?: boolean } = {},
) {
  vi.mocked(useGrVendedorMappings).mockReturnValue({
    data: items ?? undefined,
    isLoading: opts.loading ?? false,
    isError: opts.isError ?? false,
  } as never);
}

function mockVendedores(vendedores: string[]) {
  vi.mocked(useGrVendedores).mockReturnValue({
    data: vendedores,
    isLoading: false,
    isError: false,
  } as never);
}

function mockSetMapping(over: Partial<typeof idleMutation> = {}) {
  const m = { ...idleMutation, ...over };
  vi.mocked(useSetGrVendedorMapping).mockReturnValue(m as never);
  return m;
}

describe('VendedorMappingBody', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMappings([makeItem()]);
    mockVendedores(['Vendedor Uno', 'Vendedor Dos', 'Vendedor Tres']);
    mockSetMapping();
  });

  it('renders a row per user with name and login', () => {
    mockMappings([
      makeItem({ userId: 'u1', userName: 'Ana Pérez', userLogin: 'aperez' }),
      makeItem({ userId: 'u2', userName: 'Beto López', userLogin: 'blopez' }),
    ]);
    render(<VendedorMappingBody />);

    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText('aperez')).toBeInTheDocument();
    expect(screen.getByText('Beto López')).toBeInTheDocument();
    expect(screen.getByText('blopez')).toBeInTheDocument();
  });

  it('the dropdown lists the distinct vendedores plus a "sin mapear" option', () => {
    mockMappings([makeItem({ userName: 'Ana Pérez' })]);
    mockVendedores(['Vendedor Uno', 'Vendedor Dos']);
    render(<VendedorMappingBody />);

    const select = screen.getByLabelText(/vendedor de ana pérez/i) as HTMLSelectElement;
    const labels = Array.from(select.options).map(o => o.textContent);
    expect(labels).toContain('Vendedor Uno');
    expect(labels).toContain('Vendedor Dos');
    // first option clears the mapping
    expect(labels[0]).toMatch(/sin mapear/i);
  });

  it('preselects the currently mapped vendedor', () => {
    mockMappings([makeItem({ userName: 'Ana Pérez', grVendedorName: 'Vendedor Dos' })]);
    mockVendedores(['Vendedor Uno', 'Vendedor Dos']);
    render(<VendedorMappingBody />);

    const select = screen.getByLabelText(/vendedor de ana pérez/i) as HTMLSelectElement;
    expect(select.value).toBe('Vendedor Dos');
  });

  it('keeps the mapped vendedor selectable even if absent from the distinct catalog', () => {
    mockMappings([makeItem({ userName: 'Ana Pérez', grVendedorName: 'Vendedor Viejo' })]);
    mockVendedores(['Vendedor Uno', 'Vendedor Dos']);
    render(<VendedorMappingBody />);

    const select = screen.getByLabelText(/vendedor de ana pérez/i) as HTMLSelectElement;
    expect(select.value).toBe('Vendedor Viejo');
    expect(Array.from(select.options).map(o => o.textContent)).toContain('Vendedor Viejo');
  });

  it('changing the dropdown fires the mutation with the chosen vendedor', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    mockSetMapping({ mutateAsync });
    mockMappings([makeItem({ userId: 'u1', userName: 'Ana Pérez' })]);
    mockVendedores(['Vendedor Uno', 'Vendedor Dos']);
    render(<VendedorMappingBody />);

    fireEvent.change(screen.getByLabelText(/vendedor de ana pérez/i), {
      target: { value: 'Vendedor Dos' },
    });

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ userId: 'u1', grVendedorName: 'Vendedor Dos' });
    });
  });

  it('selecting "sin mapear" fires the mutation with null to clear', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    mockSetMapping({ mutateAsync });
    mockMappings([makeItem({ userId: 'u1', userName: 'Ana Pérez', grVendedorName: 'Vendedor Uno' })]);
    render(<VendedorMappingBody />);

    fireEvent.change(screen.getByLabelText(/vendedor de ana pérez/i), {
      target: { value: '' },
    });

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ userId: 'u1', grVendedorName: null });
    });
  });

  it('shows a loading state', () => {
    mockMappings(null, { loading: true });
    render(<VendedorMappingBody />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('shows an empty state when there are no users', () => {
    mockMappings([]);
    render(<VendedorMappingBody />);
    expect(screen.getByText(/^sin usuarios$/i)).toBeInTheDocument();
  });

  it('shows an error state when the mappings query fails', () => {
    mockMappings(null, { isError: true });
    render(<VendedorMappingBody />);
    expect(screen.getByText(/no se pudo cargar/i)).toBeInTheDocument();
  });

  it('renders the table and enables the dropdown with recapture.assign', () => {
    vi.mocked(useMyPermissions).mockReturnValue({
      permissions: ['recapture.assign'],
      roles: [],
      user: null,
      isLoading: false,
      isError: false,
      can: (perm: string | string[]) => {
        const list = Array.isArray(perm) ? perm : [perm];
        return list.includes('recapture.assign');
      },
    } as never);
    mockMappings([makeItem({ userName: 'Ana Pérez' })]);
    render(<VendedorMappingBody />);

    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByLabelText(/vendedor de ana pérez/i)).not.toBeDisabled();
  });

  it('hides the whole table when the user lacks recapture.assign (read/manage are not enough)', () => {
    vi.mocked(useMyPermissions).mockReturnValue({
      permissions: ['recapture.read', 'recapture.manage'],
      roles: [],
      user: null,
      isLoading: false,
      isError: false,
      can: (perm: string | string[]) => {
        const list = Array.isArray(perm) ? perm : [perm];
        return list.some((p) => p === 'recapture.read' || p === 'recapture.manage');
      },
    } as never);
    mockMappings([makeItem({ userName: 'Ana Pérez' })]);
    render(<VendedorMappingBody />);

    expect(screen.queryByText('Ana Pérez')).not.toBeInTheDocument();
  });
});
