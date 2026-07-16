import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { NewsCategory } from '@/types/news';

vi.mock('@/hooks/useNews', () => ({
  useNewsCategories: vi.fn(),
  useCreateNewsCategory: vi.fn(),
  useUpdateNewsCategory: vi.fn(),
  useDeleteNewsCategory: vi.fn(),
}));

import {
  useNewsCategories,
  useCreateNewsCategory,
  useUpdateNewsCategory,
  useDeleteNewsCategory,
} from '@/hooks/useNews';
import { NewsCategoriesBody } from '@/pages/news/components/NewsCategoriesBody';

const mockCategories = useNewsCategories as unknown as ReturnType<typeof vi.fn>;
const mockCreate = useCreateNewsCategory as unknown as ReturnType<typeof vi.fn>;
const mockUpdate = useUpdateNewsCategory as unknown as ReturnType<typeof vi.fn>;
const mockDelete = useDeleteNewsCategory as unknown as ReturnType<typeof vi.fn>;

const CATEGORIES: NewsCategory[] = [
  { id: 'cat-1', name: 'General', color: '#64748b' },
  { id: 'cat-2', name: 'Comercial', color: '#10b981' },
];

function setupMutations() {
  const create = { mutateAsync: vi.fn().mockResolvedValue(CATEGORIES[0]), isPending: false };
  const update = { mutateAsync: vi.fn().mockResolvedValue(CATEGORIES[0]), isPending: false };
  const del = { mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false };
  mockCreate.mockReturnValue(create);
  mockUpdate.mockReturnValue(update);
  mockDelete.mockReturnValue(del);
  return { create, update, del };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCategories.mockReturnValue({ data: CATEGORIES, isLoading: false });
  setupMutations();
});

describe('NewsCategoriesBody — CRUD (NEWS-FE-CAT-1)', () => {
  it('lists categories with a color swatch and name', () => {
    render(<NewsCategoriesBody />);
    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('Comercial')).toBeInTheDocument();
    expect(screen.getByLabelText(/color de general/i)).toBeInTheDocument();
  });

  it('creates a category via the modal', async () => {
    const user = userEvent.setup();
    const { create } = setupMutations();
    render(<NewsCategoriesBody />);

    await user.click(screen.getByRole('button', { name: /nueva categoría/i }));
    await user.type(screen.getByLabelText(/nombre/i), 'Campañas');
    await user.click(screen.getByRole('button', { name: /^guardar$/i }));

    expect(create.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Campañas' }),
    );
  });

  it('maps a 409 NEWS_CATEGORY_NAME_CONFLICT to a clear message, modal stays open', async () => {
    const user = userEvent.setup();
    const { create } = setupMutations();
    create.mutateAsync.mockRejectedValue({
      response: { status: 409, data: { code: 'NEWS_CATEGORY_NAME_CONFLICT' } },
    });
    render(<NewsCategoriesBody />);

    await user.click(screen.getByRole('button', { name: /nueva categoría/i }));
    await user.type(screen.getByLabelText(/nombre/i), 'Comercial');
    await user.click(screen.getByRole('button', { name: /^guardar$/i }));

    expect(await screen.findByText(/ya existe una categoría con ese nombre/i)).toBeInTheDocument();
    // Modal stayed open — the name field is still there with the typed value.
    expect(screen.getByLabelText(/nombre/i)).toHaveValue('Comercial');
  });

  it('deletes a category after confirmation', async () => {
    const user = userEvent.setup();
    const { del } = setupMutations();
    render(<NewsCategoriesBody />);

    const row = screen.getByText('Comercial').closest('tr')!;
    const deleteBtn = Array.from(row.querySelectorAll('button')).find((b) => /eliminar/i.test(b.textContent ?? '')) as HTMLElement;
    await user.click(deleteBtn);

    expect(del.mutateAsync).toHaveBeenCalledWith('cat-2');
  });

  it('shows an in-use message on 409 NEWS_CATEGORY_IN_USE and keeps the category listed', async () => {
    const user = userEvent.setup();
    const { del } = setupMutations();
    del.mutateAsync.mockRejectedValue({
      response: { status: 409, data: { code: 'NEWS_CATEGORY_IN_USE' } },
    });
    render(<NewsCategoriesBody />);

    const row = screen.getByText('Comercial').closest('tr')!;
    const deleteBtn = Array.from(row.querySelectorAll('button')).find((b) => /eliminar/i.test(b.textContent ?? '')) as HTMLElement;
    await user.click(deleteBtn);

    expect(await screen.findByText(/tiene noticias asociadas/i)).toBeInTheDocument();
    expect(screen.getByText('Comercial')).toBeInTheDocument();
  });

  it('maps a 404 NEWS_CATEGORY_NOT_FOUND on update to a specific message (L3), modal stays open', async () => {
    const user = userEvent.setup();
    const { update } = setupMutations();
    update.mutateAsync.mockRejectedValue({
      response: { status: 404, data: { code: 'NEWS_CATEGORY_NOT_FOUND' } },
    });
    render(<NewsCategoriesBody />);

    const row = screen.getByText('Comercial').closest('tr')!;
    const editBtn = Array.from(row.querySelectorAll('button')).find((b) => /editar/i.test(b.textContent ?? '')) as HTMLElement;
    await user.click(editBtn);
    await user.click(screen.getByRole('button', { name: /^guardar$/i }));

    expect(await screen.findByText(/ya no existe/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/nombre/i)).toBeInTheDocument();
  });
});

describe('NewsCategoryModal — accessible shell (L1)', () => {
  it('closes on Escape, same as NewsPostModal', async () => {
    const user = userEvent.setup();
    render(<NewsCategoriesBody />);

    await user.click(screen.getByRole('button', { name: /nueva categoría/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders via a portal (dialog is a direct child of document.body, not nested under the page markup)', async () => {
    const user = userEvent.setup();
    const { container } = render(<NewsCategoriesBody />);

    await user.click(screen.getByRole('button', { name: /nueva categoría/i }));
    const dialog = screen.getByRole('dialog');

    expect(container.contains(dialog)).toBe(false);
    expect(document.body.contains(dialog)).toBe(true);
  });
});
