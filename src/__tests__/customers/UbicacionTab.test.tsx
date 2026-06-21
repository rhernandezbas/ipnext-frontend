import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UbicacionTab } from '@/pages/customers/tabs/UbicacionTab';
import * as useCustomersModule from '@/hooks/useCustomers';
import type { Customer } from '@/types/customer';

vi.mock('@/hooks/useCustomers');

// Geocode is never triggered in these unit tests
vi.mock('@/pages/scheduling/SchedulingTaskDetailPage/lib/geocode', () => ({
  geocodeAddress: vi.fn(),
  reverseGeocode: vi.fn(),
}));

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const baseCustomer: Customer = {
  id: 42,
  name: 'Test Customer',
  email: 'test@example.com',
  phone: '11-1111',
  address: 'Av. Corrientes 1234',
  status: 'active',
  category: 'residential',
  tariffPlan: null,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
  contracts: [],
  logs: [],
};

function renderTab(customerOverrides: Partial<Customer> = {}) {
  const customer = { ...baseCustomer, ...customerOverrides };
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <UbicacionTab customer={customer} />
    </QueryClientProvider>,
  );
}

describe('UbicacionTab', () => {
  const mutateMock = vi.fn().mockResolvedValue({});

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCustomersModule.useUpdateCustomer).mockReturnValue({
      mutateAsync: mutateMock,
      isPending: false,
    } as unknown as ReturnType<typeof useCustomersModule.useUpdateCustomer>);
  });

  it('renders GeoLocationEditor with null value when customer has no GPS fields', () => {
    renderTab();
    // empty state: the editor shows "Sin ubicación cargada"
    expect(screen.getByText('Sin ubicación cargada')).toBeInTheDocument();
  });

  it('renders the GPS editor with the correct coordinates from customer', () => {
    renderTab({ lat: -34.6, lng: -58.38, plusCode: '48Q3CJ2C+22' });
    expect(screen.getByTestId('geo-coords')).toBeInTheDocument();
    expect(screen.getByTestId('geo-maps-link')).toHaveAttribute(
      'href',
      'https://www.google.com/maps?q=-34.6,-58.38',
    );
  });

  it('calls useUpdateCustomer.mutateAsync with lat/lng/plusCode on save', async () => {
    const user = userEvent.setup();
    renderTab({ lat: -34.6, lng: -58.38, plusCode: '48Q3CJ2C+22' });
    await user.click(screen.getByTestId('geo-save-button'));

    await waitFor(() => {
      expect(mutateMock).toHaveBeenCalledWith({
        id: '42',
        data: expect.objectContaining({
          lat: -34.6,
          lng: -58.38,
          plusCode: expect.any(String),
        }),
      });
    });
  });

  it('shows the save button when canEdit=true (default: permissions grant clients.write)', () => {
    renderTab({ lat: -34.6, lng: -58.38 });
    expect(screen.getByTestId('geo-save-button')).toBeInTheDocument();
  });
});
