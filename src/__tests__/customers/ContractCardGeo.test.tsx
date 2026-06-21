import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ContractCard } from '@/pages/customers/tabs/contracts/ContractCard';
import * as useCustomersModule from '@/hooks/useCustomers';
import * as useGigaredModule from '@/hooks/useGigared';
import type { Contract } from '@/types/customer';

vi.mock('@/hooks/useCustomers');
vi.mock('@/hooks/useGigared', () => ({
  useGigaredConfig: vi.fn(() => ({ data: { configured: false, enabled: false } })),
  useGigaredCustomerAccount: vi.fn(() => ({ data: null })),
}));

vi.mock('@/pages/scheduling/SchedulingTaskDetailPage/lib/geocode', () => ({
  geocodeAddress: vi.fn(),
  reverseGeocode: vi.fn(),
}));

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const baseContract: Contract = {
  id: 'contract-uuid-1',
  code: 'CTR-001',
  name: null,
  type: 'internet',
  plan: 'Plan 100MB',
  status: 'active',
  price: 5000,
  startDate: '2024-01-01',
  endDate: null,
  ip: '192.168.1.1',
  description: '',
  address: 'Av. Corrientes 1234, CABA',
  lat: null,
  lng: null,
  services: [],
  gpsLat: null,
  gpsLng: null,
  gpsPlusCode: null,
};

function renderCard(contractOverrides: Partial<Contract> = {}) {
  const contract = { ...baseContract, ...contractOverrides };
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <ContractCard contract={contract} clientId="42" active={true} />
    </QueryClientProvider>,
  );
}

describe('ContractCard — GPS geolocation', () => {
  const mutateAsyncMock = vi.fn().mockResolvedValue({});
  const patchContractNameMock = vi.fn().mockResolvedValue({});

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCustomersModule.useUpdateContractLocation).mockReturnValue({
      mutateAsync: mutateAsyncMock,
      isPending: false,
    } as unknown as ReturnType<typeof useCustomersModule.useUpdateContractLocation>);

    // Stub other hooks used by ContractCard
    vi.mocked(useCustomersModule.useUpdateContractName).mockReturnValue({
      mutate: patchContractNameMock,
      isPending: false,
    } as unknown as ReturnType<typeof useCustomersModule.useUpdateContractName>);
  });

  it('renders GeoLocationEditor inside the contract card', () => {
    renderCard();
    // Section heading from the editor
    expect(screen.getByRole('heading', { name: /Ubicación GPS de la instalación/i })).toBeInTheDocument();
  });

  it('shows empty state when contract has no GPS data', () => {
    renderCard();
    expect(screen.getByText('Sin ubicación cargada')).toBeInTheDocument();
  });

  it('renders coordinates when contract has gpsLat/gpsLng', () => {
    renderCard({ gpsLat: -34.6, gpsLng: -58.38, gpsPlusCode: '48Q3CJ2C+22' });
    expect(screen.getByTestId('geo-coords')).toBeInTheDocument();
    const mapsLink = screen.getByTestId('geo-maps-link');
    expect(mapsLink).toHaveAttribute(
      'href',
      'https://www.google.com/maps?q=-34.6,-58.38',
    );
  });

  it('shows the reference address from contract.address as a hint in the geo editor', () => {
    renderCard({ gpsLat: -34.6, gpsLng: -58.38 });
    // The referenceAddress prop renders as a labelled hint inside the GeoLocationEditor
    expect(screen.getByLabelText('Dirección de referencia GR')).toBeInTheDocument();
    expect(screen.getByLabelText('Dirección de referencia GR').textContent).toContain('Av. Corrientes 1234');
  });

  it('calls useUpdateContractLocation.mutateAsync with correct payload on save', async () => {
    const user = userEvent.setup();
    renderCard({ gpsLat: -34.6, gpsLng: -58.38, gpsPlusCode: '48Q3CJ2C+22' });
    await user.click(screen.getByTestId('geo-save-button'));

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        contractId: 'contract-uuid-1',
        data: expect.objectContaining({
          gpsLat: -34.6,
          gpsLng: -58.38,
          gpsPlusCode: expect.any(String),
        }),
      });
    });
  });
});
