import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { FilesTab } from '@/pages/customers/tabs/FilesTab';
import * as useClientsModule from '@/hooks/useCustomers';
import { mockQuery } from '@/__tests__/_utils/reactQueryMocks';

vi.mock('@/hooks/useCustomers');

// jsdom doesn't implement URL.createObjectURL
URL.createObjectURL = vi.fn(() => 'blob:mock');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderTab(clientId = '1') {
  return render(
    <QueryClientProvider client={makeQC()}>
      <FilesTab clientId={clientId} active={true} />
    </QueryClientProvider>
  );
}

const mockFiles: useClientsModule.ClientFile[] = [
  { id: 1, name: 'foto_antena.jpg', size: 204800, uploadedAt: '2024-02-10T09:00:00.000Z' },
  { id: 2, name: 'mapa_ubicacion.png', size: 512000, uploadedAt: '2024-02-11T14:30:00.000Z' },
];

describe('FilesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useClientsModule.useUploadFile).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useClientsModule.useUploadFile>);
  });

  it('renders "Subir archivo" button', () => {
    vi.mocked(useClientsModule.useClientFiles).mockReturnValue(mockQuery({
      data: [],
      isLoading: false,
    }));

    renderTab();
    expect(screen.getByRole('button', { name: 'Subir archivo' })).toBeInTheDocument();
  });

  it('loading state shows loading text', () => {
    vi.mocked(useClientsModule.useClientFiles).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useClientsModule.useClientFiles>);

    renderTab();
    expect(screen.getByText(/cargando archivos/i)).toBeInTheDocument();
  });

  it('renders file list from mock data', () => {
    vi.mocked(useClientsModule.useClientFiles).mockReturnValue({
      data: mockFiles,
      isLoading: false,
    } as ReturnType<typeof useClientsModule.useClientFiles>);

    renderTab();
    expect(screen.getByText('foto_antena.jpg')).toBeInTheDocument();
    expect(screen.getByText('mapa_ubicacion.png')).toBeInTheDocument();
  });

  it('"Sin archivos" shown when data is empty', () => {
    vi.mocked(useClientsModule.useClientFiles).mockReturnValue(mockQuery({
      data: [],
      isLoading: false,
    }));

    renderTab();
    expect(screen.getByText('Sin archivos')).toBeInTheDocument();
  });
});
