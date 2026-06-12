/**
 * NetworkSitesPage — iclassNodeCode field tests (#29)
 * Tests that the create and edit site modals include iclassNodeCode input
 * and that the submit payload includes it.
 *
 * Strategy: test the modal sub-components directly, mirroring how the
 * existing tests (networking/NetworkSitesPage.test.tsx) work — the page
 * renders the modals conditionally; we test the components in isolation.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Extract the modal components via the page module
// We import the full page and re-export its internal modals through the page.
// Since the modals are not exported directly, we render the page and trigger
// modal open via the "Nuevo sitio" button (which is covered by the Can mock).

import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { default as NetworkSitesPage } from '@/pages/networking/NetworkSitesPage';
import * as useNetworkSitesModule from '@/hooks/useNetworkSites';
import type { NetworkSite } from '@/types/networkSite';

vi.mock('@/hooks/useNetworkSites');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const mockSite: NetworkSite = {
  id: '1',
  siteNumber: 1,
  fixedCode: 'NODO 1',
  name: 'Nodo Central',
  address: 'Av. Corrientes 1234',
  city: 'Buenos Aires',
  coordinates: null,
  type: 'nodo',
  status: 'active',
  deviceCount: 12,
  clientCount: 450,
  uplink: '10 Gbps fibra',
  parentSiteId: null,
  description: 'Nodo principal',
  iclassNodeCode: 'NC-01',
  uispSiteId: null,
  uisp: null,
};

describe('NetworkSitesPage — iclassNodeCode field (AddSiteModal)', () => {
  const createMutateMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useNetworkSitesModule.useNetworkSites).mockReturnValue({
      data: [mockSite],
      isLoading: false,
    } as ReturnType<typeof useNetworkSitesModule.useNetworkSites>);

    vi.mocked(useNetworkSitesModule.useCreateNetworkSite).mockReturnValue({
      mutate: createMutateMock,
      isPending: false,
    } as unknown as ReturnType<typeof useNetworkSitesModule.useCreateNetworkSite>);

    vi.mocked(useNetworkSitesModule.useUpdateNetworkSite).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useNetworkSitesModule.useUpdateNetworkSite>);

    vi.mocked(useNetworkSitesModule.useDeleteNetworkSite).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useNetworkSitesModule.useDeleteNetworkSite>);
  });

  function renderAndOpenAdd() {
    render(
      <QueryClientProvider client={makeQC()}>
        <MemoryRouter>
          <NetworkSitesPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /nuevo sitio/i }));
  }

  it('renders the iclassNodeCode input in the Add Site modal', () => {
    renderAndOpenAdd();
    // The field label matches /código iclass/i or similar
    expect(screen.getByLabelText(/código.*iclass|iclass.*código/i)).toBeInTheDocument();
  });

  it('iclassNodeCode input is optional — empty by default', () => {
    renderAndOpenAdd();
    const input = screen.getByLabelText(/código.*iclass|iclass.*código/i) as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('includes iclassNodeCode in the create payload when filled', () => {
    renderAndOpenAdd();
    // Fill required fields
    fireEvent.change(screen.getByLabelText(/^nombre$/i), { target: { value: 'Nodo Test' } });
    fireEvent.change(screen.getByLabelText(/dirección/i), { target: { value: 'Calle Test 123' } });
    fireEvent.change(screen.getByLabelText(/^ciudad$/i), { target: { value: 'Pilar' } });
    // Fill iclassNodeCode
    fireEvent.change(screen.getByLabelText(/código.*iclass|iclass.*código/i), { target: { value: 'TEST-01' } });
    // Submit
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    expect(createMutateMock).toHaveBeenCalledTimes(1);
    const payload = createMutateMock.mock.calls[0][0];
    expect(payload.iclassNodeCode).toBe('TEST-01');
  });

  it('iclassNodeCode defaults to null in the create payload when left empty', () => {
    renderAndOpenAdd();
    fireEvent.change(screen.getByLabelText(/^nombre$/i), { target: { value: 'Nodo Empty' } });
    fireEvent.change(screen.getByLabelText(/dirección/i), { target: { value: 'Calle 456' } });
    fireEvent.change(screen.getByLabelText(/^ciudad$/i), { target: { value: 'BA' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    expect(createMutateMock).toHaveBeenCalledTimes(1);
    const payload = createMutateMock.mock.calls[0][0];
    expect(payload.iclassNodeCode).toBeNull();
  });
});
