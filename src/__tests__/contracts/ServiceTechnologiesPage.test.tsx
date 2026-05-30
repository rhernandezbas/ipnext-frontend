/**
 * ServiceTechnologiesPage — Strict TDD tests
 * CP-7.1: render rows
 * CP-7.2: create + table update (invalidateQueries)
 * CP-7.3: duplicate-name 409 inline error
 * CP-7.4: edit in-place (modal)
 * CP-7.5: delete unused
 * CP-7.6: delete in-use 409 error
 */
import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import ServiceTechnologiesPage from '@/pages/contracts/ServiceTechnologiesPage';
import * as useTechModule from '@/hooks/useServiceTechnologies';

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock('@/hooks/useServiceTechnologies');
vi.mock('@/context/ConfirmContext', () => ({
  useConfirm: () => vi.fn(async () => true),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────
import type { ServiceTechnology } from '@/types/serviceTechnology';

const mockTechs: ServiceTechnology[] = [
  { id: 't1', name: 'Fibra', description: 'Fibra óptica' },
  { id: 't2', name: 'Wireless', description: null },
];

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

function renderPage() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <ServiceTechnologiesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function setupMocks(overrides?: Partial<{
  createError: unknown;
  updateError: unknown;
  deleteError: unknown;
}>) {
  const createMutateAsync = overrides?.createError
    ? vi.fn().mockRejectedValue(overrides.createError)
    : vi.fn().mockResolvedValue({ id: 't3', name: 'Nueva', description: null });

  const updateMutateAsync = overrides?.updateError
    ? vi.fn().mockRejectedValue(overrides.updateError)
    : vi.fn().mockResolvedValue({ id: 't1', name: 'Fibra Editada', description: null });

  const deleteMutateAsync = overrides?.deleteError
    ? vi.fn().mockRejectedValue(overrides.deleteError)
    : vi.fn().mockResolvedValue(undefined);

  vi.mocked(useTechModule.useServiceTechnologies).mockReturnValue({
    data: mockTechs,
    isLoading: false,
    isError: false,
  } as ReturnType<typeof useTechModule.useServiceTechnologies>);

  vi.mocked(useTechModule.useCreateServiceTechnology).mockReturnValue({
    mutateAsync: createMutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof useTechModule.useCreateServiceTechnology>);

  vi.mocked(useTechModule.useUpdateServiceTechnology).mockReturnValue({
    mutateAsync: updateMutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof useTechModule.useUpdateServiceTechnology>);

  vi.mocked(useTechModule.useDeleteServiceTechnology).mockReturnValue({
    mutateAsync: deleteMutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof useTechModule.useDeleteServiceTechnology>);

  return { createMutateAsync, updateMutateAsync, deleteMutateAsync };
}

beforeEach(() => {
  vi.clearAllMocks();
  setupMocks();
});

// ── CP-7.1: Render rows ───────────────────────────────────────────────────────
describe('CP-7.1: render rows', () => {
  it('renders page heading', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /tecnolog/i })).toBeInTheDocument();
  });

  it('renders technology rows', () => {
    renderPage();
    expect(screen.getByText('Fibra')).toBeInTheDocument();
    expect(screen.getByText('Wireless')).toBeInTheDocument();
  });

  it('renders "—" for null description', () => {
    renderPage();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
  });

  it('shows empty message when no technologies', () => {
    vi.mocked(useTechModule.useServiceTechnologies).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useTechModule.useServiceTechnologies>);
    renderPage();
    expect(screen.getByText(/no hay tecnolog/i)).toBeInTheDocument();
  });

  it('shows loading message while loading', () => {
    vi.mocked(useTechModule.useServiceTechnologies).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as ReturnType<typeof useTechModule.useServiceTechnologies>);
    renderPage();
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });
});

// ── CP-7.2: Create ────────────────────────────────────────────────────────────
describe('CP-7.2: create technology', () => {
  it('opens create modal on "+ Nueva tecnología" click', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /nueva tecnolog/i }));
    expect(screen.getByRole('heading', { name: /nueva tecnolog/i })).toBeInTheDocument();
  });

  it('calls createMutateAsync with name and description', async () => {
    const { createMutateAsync } = setupMocks();
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /nueva tecnolog/i }));

    const modal = screen.getByRole('heading', { name: /nueva tecnolog/i }).closest('div')!;
    await user.type(within(modal).getByPlaceholderText(/ej:/i), 'Nueva Tech');

    const saveBtn = within(modal).getByRole('button', { name: /guardar/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(createMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Nueva Tech' }),
      );
    });
  });

  it('closes modal after successful create', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /nueva tecnolog/i }));
    const modal = screen.getByRole('heading', { name: /nueva tecnolog/i }).closest('div')!;
    await user.type(within(modal).getByPlaceholderText(/ej:/i), 'X');
    await user.click(within(modal).getByRole('button', { name: /guardar/i }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /nueva tecnolog/i })).not.toBeInTheDocument();
    });
  });
});

// ── CP-7.3: Duplicate-name 409 ────────────────────────────────────────────────
describe('CP-7.3: duplicate name 409 inline error', () => {
  it('shows inline error for SERVICE_TECHNOLOGY_NAME_CONFLICT', async () => {
    const conflictError = {
      response: { status: 409, data: { code: 'SERVICE_TECHNOLOGY_NAME_CONFLICT' } },
    };
    setupMocks({ createError: conflictError });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /nueva tecnolog/i }));
    const modal = screen.getByRole('heading', { name: /nueva tecnolog/i }).closest('div')!;
    await user.type(within(modal).getByPlaceholderText(/ej:/i), 'Fibra');
    await user.click(within(modal).getByRole('button', { name: /guardar/i }));

    await waitFor(() => {
      expect(screen.getByText(/ya existe una tecnolog/i)).toBeInTheDocument();
    });
  });

  it('modal stays open on 409 error', async () => {
    const conflictError = {
      response: { status: 409, data: { code: 'SERVICE_TECHNOLOGY_NAME_CONFLICT' } },
    };
    setupMocks({ createError: conflictError });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /nueva tecnolog/i }));
    const modal = screen.getByRole('heading', { name: /nueva tecnolog/i }).closest('div')!;
    await user.type(within(modal).getByPlaceholderText(/ej:/i), 'Fibra');
    await user.click(within(modal).getByRole('button', { name: /guardar/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /nueva tecnolog/i })).toBeInTheDocument();
    });
  });
});

// ── CP-7.4: Edit ─────────────────────────────────────────────────────────────
describe('CP-7.4: edit technology', () => {
  it('opens edit modal with pre-filled name', async () => {
    const user = userEvent.setup();
    renderPage();

    const rows = screen.getAllByRole('row');
    // First data row is after header
    const fibraRow = rows.find((r) => r.textContent?.includes('Fibra'));
    expect(fibraRow).toBeDefined();
    await user.click(within(fibraRow!).getByRole('button', { name: /editar/i }));

    const modal = screen.getByRole('heading', { name: /editar tecnolog/i }).closest('div')!;
    const nameInput = within(modal).getByDisplayValue('Fibra');
    expect(nameInput).toBeInTheDocument();
  });

  it('calls updateMutateAsync with id and new name', async () => {
    const { updateMutateAsync } = setupMocks();
    const user = userEvent.setup();
    renderPage();

    const rows = screen.getAllByRole('row');
    const fibraRow = rows.find((r) => r.textContent?.includes('Fibra'));
    await user.click(within(fibraRow!).getByRole('button', { name: /editar/i }));

    const modal = screen.getByRole('heading', { name: /editar tecnolog/i }).closest('div')!;
    const nameInput = within(modal).getByDisplayValue('Fibra');
    await user.clear(nameInput);
    await user.type(nameInput, 'Fibra Óptica');

    await user.click(within(modal).getByRole('button', { name: /guardar/i }));

    await waitFor(() => {
      expect(updateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ id: 't1', data: expect.objectContaining({ name: 'Fibra Óptica' }) }),
      );
    });
  });
});

// ── CP-7.5: Delete unused ─────────────────────────────────────────────────────
describe('CP-7.5: delete unused technology', () => {
  it('calls deleteMutateAsync when confirmed', async () => {
    const { deleteMutateAsync } = setupMocks();
    const user = userEvent.setup();
    renderPage();

    const rows = screen.getAllByRole('row');
    const fibraRow = rows.find((r) => r.textContent?.includes('Fibra'));
    await user.click(within(fibraRow!).getByRole('button', { name: /eliminar/i }));

    await waitFor(() => {
      expect(deleteMutateAsync).toHaveBeenCalledWith('t1');
    });
  });
});

// ── CP-7.6: Delete in-use 409 ─────────────────────────────────────────────────
describe('CP-7.6: delete in-use 409 error', () => {
  it('shows alert for SERVICE_TECHNOLOGY_IN_USE', async () => {
    const inUseError = {
      response: { status: 409, data: { code: 'SERVICE_TECHNOLOGY_IN_USE' } },
    };
    setupMocks({ deleteError: inUseError });

    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();
    renderPage();

    const rows = screen.getAllByRole('row');
    const fibraRow = rows.find((r) => r.textContent?.includes('Fibra'));
    await user.click(within(fibraRow!).getByRole('button', { name: /eliminar/i }));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        expect.stringMatching(/no se puede eliminar/i),
      );
    });

    alertSpy.mockRestore();
  });
});
