import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CommentsTab } from '@/pages/customers/tabs/CommentsTab';
import * as useClientsModule from '@/hooks/useCustomers';
import { mockMutation, mockQuery } from '@/__tests__/_utils/reactQueryMocks';

vi.mock('@/hooks/useCustomers');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderTab(clientId = '42') {
  return render(
    <QueryClientProvider client={makeQC()}>
      <CommentsTab clientId={clientId} />
    </QueryClientProvider>
  );
}

describe('CommentsTab', () => {
  const mockMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useClientsModule.useClientComments).mockReturnValue(mockQuery({
      data: [],
      isLoading: false,
    }));
    vi.mocked(useClientsModule.useCreateComment).mockReturnValue(mockMutation({
      mutate: mockMutate,
      isPending: false,
    }));
  });

  it('shows textarea and Agregar comentario button', () => {
    renderTab();
    expect(screen.getByPlaceholderText('Escribí un comentario...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar comentario' })).toBeInTheDocument();
  });

  it('submitting calls the mutate function', async () => {
    const user = userEvent.setup();
    renderTab();

    const textarea = screen.getByPlaceholderText('Escribí un comentario...');
    await user.type(textarea, 'Nuevo comentario de prueba');
    await user.click(screen.getByRole('button', { name: 'Agregar comentario' }));

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Nuevo comentario de prueba', authorName: 'Admin' })
    );
  });
});
