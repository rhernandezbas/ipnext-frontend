import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ActividadTab } from '@/pages/clientes/tabs/ActividadTab';
import * as useClientsModule from '@/hooks/useClients';

vi.mock('@/hooks/useClients');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderTab(clientId = '42') {
  return render(
    <QueryClientProvider client={makeQC()}>
      <ActividadTab clientId={clientId} />
    </QueryClientProvider>
  );
}

describe('ActividadTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows empty message when hook returns empty array', () => {
    vi.mocked(useClientsModule.useClientComments).mockReturnValue({
      data: [],
      isLoading: false,
    } as ReturnType<typeof useClientsModule.useClientComments>);

    renderTab();
    expect(screen.getByText('Sin actividad registrada.')).toBeInTheDocument();
  });

  it('shows comment author and content when hook returns comments', () => {
    vi.mocked(useClientsModule.useClientComments).mockReturnValue({
      data: [
        { id: 1, authorName: 'Admin', content: 'Cliente contactado', createdAt: '2026-04-01T10:00:00Z' },
      ],
      isLoading: false,
    } as ReturnType<typeof useClientsModule.useClientComments>);

    renderTab();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Cliente contactado')).toBeInTheDocument();
  });
});
