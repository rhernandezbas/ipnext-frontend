import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import GponPage from '@/pages/gpon/GponPage';
import * as useGponModule from '@/hooks/useGpon';
import type { OltDevice, OnuDevice } from '@/types/gpon';

vi.mock('@/hooks/useGpon');

const mockMutate = vi.fn();

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const mockOlts: OltDevice[] = [
  {
    id: 'olt-1',
    name: 'OLT Central',
    ipAddress: '10.0.0.1',
    model: 'MA5800-X7',
    manufacturer: 'Huawei',
    uplink: '10 Gbps',
    ponPorts: 16,
    totalOnus: 10,
    onlineOnus: 8,
    status: 'online',
    lastSeen: '2026-04-28T07:00:00Z',
  },
  {
    id: 'olt-2',
    name: 'OLT Zona Norte',
    ipAddress: '10.0.1.1',
    model: 'OLT-G16',
    manufacturer: 'ZTE',
    uplink: '10 Gbps',
    ponPorts: 8,
    totalOnus: 10,
    onlineOnus: 7,
    status: 'online',
    lastSeen: '2026-04-28T07:00:00Z',
  },
];

const mockOnus: OnuDevice[] = [
  {
    id: 'onu-1',
    serialNumber: 'HWTC00000001',
    model: 'HG8010H',
    oltId: 'olt-1',
    oltName: 'OLT Central',
    ponPort: 1,
    onuId: 1,
    clientId: 'client-1',
    clientName: 'Cliente 1',
    status: 'online',
    rxPower: -18.5,
    txPower: 2.5,
    distance: 700,
    firmwareVersion: 'V300R016C10',
    lastSeen: '2026-04-28T07:00:00Z',
  },
];

function renderPage() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <GponPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('GponPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useGponModule.useOlts).mockReturnValue({
      data: mockOlts,
      isLoading: false,
    } as ReturnType<typeof useGponModule.useOlts>);

    vi.mocked(useGponModule.useOnus).mockReturnValue({
      data: mockOnus,
      isLoading: false,
    } as ReturnType<typeof useGponModule.useOnus>);

    vi.mocked(useGponModule.useCreateOlt).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useGponModule.useCreateOlt>);

    vi.mocked(useGponModule.useCreateOnu).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useGponModule.useCreateOnu>);

    vi.mocked(useGponModule.useUpdateOnuStatus).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useGponModule.useUpdateOnuStatus>);
  });

  it('renders "GPON" heading', () => {
    renderPage();
    expect(screen.getByText('GPON')).toBeInTheDocument();
  });

  it('"OLTs" tab exists', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'OLTs' })).toBeInTheDocument();
  });

  it('"ONUs" tab exists', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'ONUs' })).toBeInTheDocument();
  });

  it('OLTs table shows device names', () => {
    renderPage();
    expect(screen.getByText('OLT Central')).toBeInTheDocument();
    expect(screen.getByText('OLT Zona Norte')).toBeInTheDocument();
  });

  it('Summary cards render', () => {
    renderPage();
    expect(screen.getAllByText('Total OLTs').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ONUs Online').length).toBeGreaterThan(0);
  });

  it('switching to ONUs tab shows serial number column', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'ONUs' }));

    expect(screen.getByText('Nro. Serie')).toBeInTheDocument();
    expect(screen.getByText('HWTC00000001')).toBeInTheDocument();
  });

  it('"Nueva OLT" button is present on OLTs tab', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /nueva olt/i })).toBeInTheDocument();
  });

  it('clicking "Nueva OLT" shows modal', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /nueva olt/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('"Nueva ONU" button is present on ONUs tab', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'ONUs' }));

    expect(screen.getByRole('button', { name: /nueva onu/i })).toBeInTheDocument();
  });
});
