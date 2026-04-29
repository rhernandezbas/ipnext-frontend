import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { DocumentosTab } from '@/pages/clientes/tabs/DocumentosTab';
import * as useClientsModule from '@/hooks/useClients';

vi.mock('@/hooks/useClients');

// jsdom doesn't implement URL.createObjectURL
URL.createObjectURL = vi.fn(() => 'blob:mock');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderTab(clientId = '42') {
  return render(
    <QueryClientProvider client={makeQC()}>
      <DocumentosTab clientId={clientId} active={true} />
    </QueryClientProvider>
  );
}

const mockDocs: useClientsModule.ClientDocument[] = [
  { id: 1, name: 'Contrato.pdf', size: 102400, uploadedAt: '2024-01-15T10:00:00.000Z', url: '/files/contrato.pdf' },
  { id: 2, name: 'DNI.jpg', size: 204800, uploadedAt: '2024-01-16T10:00:00.000Z', url: '/files/dni.jpg' },
];

describe('DocumentosTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useClientsModule.useUploadDocument).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useClientsModule.useUploadDocument>);
  });

  it('renders Subir documento button', () => {
    vi.mocked(useClientsModule.useClientDocuments).mockReturnValue({
      data: [],
      isLoading: false,
    } as ReturnType<typeof useClientsModule.useClientDocuments>);

    renderTab();
    expect(screen.getByRole('button', { name: 'Subir documento' })).toBeInTheDocument();
  });

  it('shows loading state', () => {
    vi.mocked(useClientsModule.useClientDocuments).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useClientsModule.useClientDocuments>);

    renderTab();
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('renders document list from mock data', () => {
    vi.mocked(useClientsModule.useClientDocuments).mockReturnValue({
      data: mockDocs,
      isLoading: false,
    } as ReturnType<typeof useClientsModule.useClientDocuments>);

    renderTab();
    expect(screen.getByText('Contrato.pdf')).toBeInTheDocument();
    expect(screen.getByText('DNI.jpg')).toBeInTheDocument();
  });

  it('shows Sin documentos when data is empty', () => {
    vi.mocked(useClientsModule.useClientDocuments).mockReturnValue({
      data: [],
      isLoading: false,
    } as ReturnType<typeof useClientsModule.useClientDocuments>);

    renderTab();
    expect(screen.getByText('Sin documentos')).toBeInTheDocument();
  });

  it('upload button is present and hidden file input exists', async () => {
    vi.mocked(useClientsModule.useClientDocuments).mockReturnValue({
      data: [],
      isLoading: false,
    } as ReturnType<typeof useClientsModule.useClientDocuments>);

    renderTab();

    const uploadBtn = screen.getByRole('button', { name: 'Subir documento' });
    expect(uploadBtn).toBeInTheDocument();

    // The hidden file input should exist in the DOM
    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();
  });

  it('clicking Subir documento triggers file input click', async () => {
    vi.mocked(useClientsModule.useClientDocuments).mockReturnValue({
      data: [],
      isLoading: false,
    } as ReturnType<typeof useClientsModule.useClientDocuments>);

    const user = userEvent.setup();
    renderTab();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, 'click');

    await user.click(screen.getByRole('button', { name: 'Subir documento' }));
    expect(clickSpy).toHaveBeenCalled();
  });
});
