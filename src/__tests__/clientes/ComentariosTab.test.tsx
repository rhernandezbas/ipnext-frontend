import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ComentariosTab } from '@/pages/clientes/tabs/ComentariosTab';
import * as useClientsModule from '@/hooks/useClients';

vi.mock('@/hooks/useClients');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderTab(clientId = '42') {
  return render(
    <QueryClientProvider client={makeQC()}>
      <ComentariosTab clientId={clientId} />
    </QueryClientProvider>
  );
}

describe('ComentariosTab', () => {
  const mockMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useClientsModule.useClientComments).mockReturnValue({
      data: [],
      isLoading: false,
    } as ReturnType<typeof useClientsModule.useClientComments>);
    vi.mocked(useClientsModule.useCreateComment).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as ReturnType<typeof useClientsModule.useCreateComment>);
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
