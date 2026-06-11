import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ServiceCatalogEntry } from '@/types/customer';

vi.mock('@/hooks/useServiceCatalog', () => ({
  useServiceCatalog: vi.fn(),
  useCreateServiceCatalog: vi.fn(),
  useUpdateServiceCatalog: vi.fn(),
  useDeleteServiceCatalog: vi.fn(),
}));

import {
  useServiceCatalog,
  useCreateServiceCatalog,
  useUpdateServiceCatalog,
  useDeleteServiceCatalog,
} from '@/hooks/useServiceCatalog';
import { useConfirm } from '@/context/ConfirmContext';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { ServiceCatalogBody } from '@/pages/customers/settings/ServiceCatalogBody';

const entry = (over: Partial<ServiceCatalogEntry> = {}): ServiceCatalogEntry => ({
  id: 'sc-1',
  name: 'INTERNET',
  label: 'Internet',
  active: true,
  sortOrder: 1,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
  ...over,
});

const noop = vi.fn().mockResolvedValue(undefined);

function mockHooks({
  data = [entry()],
  isLoading = false,
  createMutate = noop,
  updateMutate = noop,
  deleteMutate = noop,
}: {
  data?: ServiceCatalogEntry[];
  isLoading?: boolean;
  createMutate?: ReturnType<typeof vi.fn>;
  updateMutate?: ReturnType<typeof vi.fn>;
  deleteMutate?: ReturnType<typeof vi.fn>;
} = {}) {
  vi.mocked(useServiceCatalog).mockReturnValue({ data, isLoading } as ReturnType<typeof useServiceCatalog>);
  vi.mocked(useCreateServiceCatalog).mockReturnValue({ mutateAsync: createMutate, isPending: false } as unknown as ReturnType<typeof useCreateServiceCatalog>);
  vi.mocked(useUpdateServiceCatalog).mockReturnValue({ mutateAsync: updateMutate, isPending: false } as unknown as ReturnType<typeof useUpdateServiceCatalog>);
  vi.mocked(useDeleteServiceCatalog).mockReturnValue({ mutateAsync: deleteMutate, isPending: false } as unknown as ReturnType<typeof useDeleteServiceCatalog>);
}

describe('ServiceCatalogBody (#42 / #43)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useConfirm).mockReturnValue(vi.fn().mockResolvedValue(true));
  });

  it('lists catalog entries', () => {
    mockHooks({ data: [entry({ name: 'INTERNET' }), entry({ id: 'sc-2', name: 'TV', label: 'Televisión' })] });
    render(<ServiceCatalogBody />);
    expect(screen.getByText('INTERNET')).toBeInTheDocument();
    expect(screen.getByText('TV')).toBeInTheDocument();
    expect(screen.getByText('Televisión')).toBeInTheDocument();
  });

  it('shows the empty state when there are no entries', () => {
    mockHooks({ data: [] });
    render(<ServiceCatalogBody />);
    expect(screen.getByText(/no hay servicios/i)).toBeInTheDocument();
  });

  it('creates an entry via mutateAsync', async () => {
    const createMutate = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    mockHooks({ data: [], createMutate });
    render(<ServiceCatalogBody />);
    await user.click(screen.getByText(/Nuevo servicio/i));
    const nameInput = screen.getByLabelText(/Nombre/i);
    await user.type(nameInput, 'TV');
    await user.click(screen.getByText('Guardar'));
    await waitFor(() => expect(createMutate).toHaveBeenCalledOnce());
  });

  it('keeps the modal open and shows a message on 409 name conflict', async () => {
    const createMutate = vi.fn().mockRejectedValue({
      response: { status: 409, data: { code: 'SERVICE_CATALOG_NAME_CONFLICT' } },
    });
    const user = userEvent.setup();
    mockHooks({ data: [], createMutate });
    render(<ServiceCatalogBody />);
    await user.click(screen.getByText(/Nuevo servicio/i));
    await user.type(screen.getByLabelText(/Nombre/i), 'INTERNET');
    await user.click(screen.getByText('Guardar'));
    await waitFor(() => expect(screen.getByText(/Ya existe un servicio con ese nombre/i)).toBeInTheDocument());
    // Modal stays open: the name input is still present
    expect(screen.getByLabelText(/Nombre/i)).toBeInTheDocument();
  });

  it('shows a toast when deleting a service that is in use (422 SERVICE_IN_USE)', async () => {
    const deleteMutate = vi.fn().mockRejectedValue({
      response: { status: 422, data: { code: 'SERVICE_IN_USE' } },
    });
    vi.mocked(useConfirm).mockReturnValue(vi.fn().mockResolvedValue(true));
    const user = userEvent.setup();
    mockHooks({ data: [entry()], deleteMutate });
    render(<ServiceCatalogBody />);
    await user.click(screen.getByText('Eliminar'));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/contratos que usan este servicio/i),
    );
  });

  it('shows a toast when deleting OTROS (422 SERVICE_CATALOG_NON_DELETABLE)', async () => {
    const deleteMutate = vi.fn().mockRejectedValue({
      response: { status: 422, data: { code: 'SERVICE_CATALOG_NON_DELETABLE' } },
    });
    vi.mocked(useConfirm).mockReturnValue(vi.fn().mockResolvedValue(true));
    const user = userEvent.setup();
    mockHooks({ data: [entry({ name: 'OTROS' })], deleteMutate });
    render(<ServiceCatalogBody />);
    await user.click(screen.getByText('Eliminar'));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/OTROS no se puede eliminar/i),
    );
  });

  // --- Fix #3: 422 SERVICE_CATALOG_NON_RENAMEABLE on edit/save ---
  it('shows a specific message when trying to rename OTROS (422 SERVICE_CATALOG_NON_RENAMEABLE)', async () => {
    const updateMutate = vi.fn().mockRejectedValue({
      response: { status: 422, data: { code: 'SERVICE_CATALOG_NON_RENAMEABLE' } },
    });
    const user = userEvent.setup();
    mockHooks({ data: [entry({ name: 'OTROS' })], updateMutate });
    render(<ServiceCatalogBody />);
    await user.click(screen.getByText('Editar'));
    const nameInput = screen.getByLabelText(/Nombre/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'NUEVO');
    await user.click(screen.getByText('Guardar'));
    await waitFor(() =>
      expect(screen.getByText(/OTROS no se puede renombrar/i)).toBeInTheDocument(),
    );
    // Modal stays open so the operator can revert the name.
    expect(screen.getByLabelText(/Nombre/i)).toBeInTheDocument();
  });

  // --- Fix #2: component-level gating (negative) ---
  it('does not render create/edit/delete controls without clients.manage', () => {
    vi.mocked(useMyPermissions).mockReturnValue({
      permissions: ['clients.read'],
      roles: [],
      user: null,
      isLoading: false,
      isError: false,
      can: (p: string | string[]) => {
        const perms = Array.isArray(p) ? p : [p];
        return perms.some(x => x === 'clients.read');
      },
    });
    mockHooks({ data: [entry()] });
    render(<ServiceCatalogBody />);
    expect(screen.queryByText(/Nuevo servicio/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Editar')).not.toBeInTheDocument();
    expect(screen.queryByText('Eliminar')).not.toBeInTheDocument();
    // The entry itself is still listed (read access).
    expect(screen.getByText('INTERNET')).toBeInTheDocument();
  });
});
