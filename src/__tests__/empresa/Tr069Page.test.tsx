import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { default as Tr069Page } from '@/pages/empresa/Tr069Page';
import * as useTr069Module from '@/hooks/useTr069';
import type { Tr069Profile, Tr069Device } from '@/types/tr069';

vi.mock('@/hooks/useTr069');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const mockProfiles: Tr069Profile[] = [
  {
    id: '1',
    name: 'MikroTik Hogar',
    manufacturer: 'MikroTik',
    model: 'hAP ac2',
    firmwareVersion: '7.11',
    acsUrl: 'http://acs.example.com:7547/mikrotik',
    connectionRequestUrl: null,
    periodicInformInterval: 300,
    deviceCount: 4,
    parameters: [],
    status: 'active',
  },
  {
    id: '2',
    name: 'Huawei ONU GPON',
    manufacturer: 'Huawei',
    model: 'HG8310M',
    firmwareVersion: 'V3R017',
    acsUrl: 'http://acs.example.com:7547/huawei',
    connectionRequestUrl: null,
    periodicInformInterval: 600,
    deviceCount: 3,
    parameters: [],
    status: 'active',
  },
];

const mockDevices: Tr069Device[] = [
  {
    id: '1',
    serialNumber: 'MTK-001-2025',
    profileId: '1',
    profileName: 'MikroTik Hogar',
    clientId: 'c-01',
    clientName: 'Juan Pérez',
    lastContact: '2026-04-28T09:00:00Z',
    status: 'active',
    firmwareVersion: '7.11',
    parameters: [],
  },
];

function renderPage() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <Tr069Page />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Tr069Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useTr069Module.useTr069Profiles).mockReturnValue({
      data: mockProfiles,
      isLoading: false,
    } as ReturnType<typeof useTr069Module.useTr069Profiles>);

    vi.mocked(useTr069Module.useCreateTr069Profile).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useTr069Module.useCreateTr069Profile>);

    vi.mocked(useTr069Module.useTr069Devices).mockReturnValue({
      data: mockDevices,
      isLoading: false,
    } as ReturnType<typeof useTr069Module.useTr069Devices>);

    vi.mocked(useTr069Module.useProvisionDevice).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useTr069Module.useProvisionDevice>);

    vi.mocked(useTr069Module.useUpdateTr069Profile).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useTr069Module.useUpdateTr069Profile>);

    vi.mocked(useTr069Module.useDeleteTr069Profile).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useTr069Module.useDeleteTr069Profile>);

    vi.mocked(useTr069Module.useDeleteTr069Device).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useTr069Module.useDeleteTr069Device>);
  });

  it('renders "TR-069" heading', () => {
    renderPage();
    expect(screen.getByText('TR-069')).toBeInTheDocument();
  });

  it('"Perfiles" tab exists', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /perfiles/i })).toBeInTheDocument();
  });

  it('"Dispositivos" tab exists', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /dispositivos/i })).toBeInTheDocument();
  });

  it('profiles table shows names from mock', () => {
    renderPage();
    expect(screen.getByText('MikroTik Hogar')).toBeInTheDocument();
    expect(screen.getByText('Huawei ONU GPON')).toBeInTheDocument();
  });

  it('"Nuevo perfil" button exists', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /nuevo perfil/i })).toBeInTheDocument();
  });

  it('switching to "Dispositivos" tab shows devices table', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /dispositivos/i }));

    expect(screen.getByText('MTK-001-2025')).toBeInTheDocument();
  });
});
