/**
 * WifiCard — self-service WiFi de la ONU asociada al contrato (wifi-staff-panel).
 *
 * Cubre:
 *  1. Renderiza bandas + estado TR-069 con la respuesta real de prod (fixture)
 *  2. found:false → mensaje explícito del serial inexistente (no error genérico)
 *  3. Sin wifi.manage → "Cambiar WiFi"/"Habilitar TR-069" NO se renderizan (gated
 *     de verdad, no disabled) — con revert-probe documentado en el reporte
 *  4. ChangeWifiBandModal valida 1..32/8..63 localmente y no llama al API con
 *     input inválido
 *  5. El PUT manda {port, ssid, password} tal cual band.port (string SmartOLT)
 *  6. enable-tr069 sin vlan → no deja confirmar; con vlan → POST {vlan, tr069Profile}
 *  7. 503 SMARTOLT_NOT_CONFIGURED → estado "SmartOLT no configurado" claro
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { mockQuery, mockMutation } from '@/__tests__/_utils/reactQueryMocks';
import type { ServiceInstalledItem } from '@/types/serviceInventory';
import type { OnuWifiStatus } from '@/types/wifi';

vi.mock('@/hooks/useServiceInventory', () => ({
  useServiceInstalledItems: vi.fn(),
  useAddInstalledItem: vi.fn(),
}));

vi.mock('@/hooks/useWifi', () => ({
  useOnuWifiStatus: vi.fn(),
  useSetWifiBand: vi.fn(),
  useEnableTr069: vi.fn(),
  useVerifyOnuWifi: vi.fn(),
}));

vi.mock('@/hooks/useMyPermissions');

import { useServiceInstalledItems, useAddInstalledItem } from '@/hooks/useServiceInventory';
import { useOnuWifiStatus, useSetWifiBand, useEnableTr069, useVerifyOnuWifi } from '@/hooks/useWifi';
import * as useMyPermissionsModule from '@/hooks/useMyPermissions';
import { WifiCard } from '@/pages/customers/tabs/contracts/WifiCard';

function apiError(status: number, code: string) {
  return { response: { status, data: { code, error: code } } };
}

const onuItem = (over: Partial<ServiceInstalledItem> = {}): ServiceInstalledItem => ({
  id: 'item-onu-1',
  serviceId: 'svc-1',
  type: 'ONU',
  serialNumber: '48575443A1B2C3D4',
  mac: null,
  model: 'HG8145V5',
  source: 'MANUAL',
  sourceTaskId: null,
  addedByUserId: null,
  addedByUserName: null,
  confirmedAt: null,
  status: 'active',
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

/** Fixture — respuesta real de prod (proposal wifi-self-service, verificado con curl). */
const prodWifiStatus: OnuWifiStatus = {
  sn: '48575443A1B2C3D4',
  found: true,
  onuType: 'HG8145V5',
  online: true,
  tr069Enabled: true,
  bands: [
    { band: '2.4', port: 'wifi_0/1', ssid: 'IPNEXT-PRUEBA-API', enabled: true },
    { band: '5', port: 'wifi_0/5', ssid: 'IPNEXT-PRUEBA-API-5G', enabled: true },
  ],
  hosts: [
    { name: 'A15-de-Carloz', ip: '192.168.1.23', mac: 'AA:BB:CC:DD:EE:01', interface: 'wifi', active: true, vendor: 'TP-Link' },
  ],
};

function setupMocks({
  items = [onuItem()],
  wifiStatus = mockQuery<OnuWifiStatus>({ data: prodWifiStatus }),
  setBandMutateAsync = vi.fn().mockResolvedValue(undefined),
  enableTr069MutateAsync = vi.fn().mockResolvedValue(undefined),
}: {
  items?: ServiceInstalledItem[];
  wifiStatus?: ReturnType<typeof mockQuery<OnuWifiStatus>>;
  setBandMutateAsync?: (...args: unknown[]) => Promise<unknown>;
  enableTr069MutateAsync?: (...args: unknown[]) => Promise<unknown>;
} = {}) {
  vi.mocked(useServiceInstalledItems).mockReturnValue(mockQuery({ data: items }) as ReturnType<typeof useServiceInstalledItems>);
  vi.mocked(useAddInstalledItem).mockReturnValue(mockMutation() as unknown as ReturnType<typeof useAddInstalledItem>);
  vi.mocked(useOnuWifiStatus).mockReturnValue(wifiStatus as ReturnType<typeof useOnuWifiStatus>);
  vi.mocked(useSetWifiBand).mockReturnValue(
    mockMutation({ mutateAsync: setBandMutateAsync }) as unknown as ReturnType<typeof useSetWifiBand>,
  );
  vi.mocked(useEnableTr069).mockReturnValue(
    mockMutation({ mutateAsync: enableTr069MutateAsync }) as unknown as ReturnType<typeof useEnableTr069>,
  );
  vi.mocked(useVerifyOnuWifi).mockReturnValue({ verify: vi.fn(), isPending: false });
}

/** Grants every permission (mirrors src/test/setup.ts default). */
function grantAllPermissions() {
  vi.mocked(useMyPermissionsModule.useMyPermissions).mockReturnValue({
    permissions: ['*'],
    roles: [],
    user: null,
    isLoading: false,
    isError: false,
    can: () => true,
  });
}

describe('WifiCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    grantAllPermissions();
    setupMocks();
  });

  it('renders bands + online/TR-069 status from the prod fixture', () => {
    render(<WifiCard contractId="svc-1" />);
    expect(screen.getByText('En línea')).toBeInTheDocument();
    expect(screen.getByText(/TR-069: Habilitado/)).toBeInTheDocument();
    expect(screen.getByText('IPNEXT-PRUEBA-API')).toBeInTheDocument();
    expect(screen.getByText('IPNEXT-PRUEBA-API-5G')).toBeInTheDocument();
  });

  it('found:false shows the explicit "serial does not exist" message, not a generic error', () => {
    setupMocks({
      wifiStatus: mockQuery<OnuWifiStatus>({
        data: { sn: '48575443A1B2C3D4', found: false, onuType: null, online: false, tr069Enabled: false, bands: [], hosts: [] },
      }),
    });
    render(<WifiCard contractId="svc-1" />);
    expect(screen.getByText(/no existe en SmartOLT/i)).toBeInTheDocument();
  });

  it('503 SMARTOLT_NOT_CONFIGURED renders a clear "SmartOLT not configured" state', () => {
    setupMocks({
      wifiStatus: mockQuery<OnuWifiStatus>({
        data: undefined,
        isError: true,
        isSuccess: false,
        error: apiError(503, 'SMARTOLT_NOT_CONFIGURED') as unknown as Error,
      }),
    });
    render(<WifiCard contractId="svc-1" />);
    expect(screen.getByText(/SmartOLT no configurado/i)).toBeInTheDocument();
  });

  it('without wifi.manage, "Cambiar WiFi" and "Habilitar TR-069" do NOT render (gated, not disabled)', () => {
    vi.mocked(useMyPermissionsModule.useMyPermissions).mockReturnValue({
      permissions: ['wifi.read'],
      roles: [],
      user: null,
      isLoading: false,
      isError: false,
      can: (perm) => {
        const perms = Array.isArray(perm) ? perm : [perm];
        return perms.every((p) => p === 'wifi.read');
      },
    });
    render(<WifiCard contractId="svc-1" />);
    expect(screen.queryByRole('button', { name: /Cambiar WiFi/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Habilitar TR-069/i })).not.toBeInTheDocument();
  });

  it('shows TR-069 disabled state without band change buttons, only "Habilitar TR-069"', () => {
    setupMocks({
      wifiStatus: mockQuery<OnuWifiStatus>({
        data: { ...prodWifiStatus, tr069Enabled: false },
      }),
    });
    render(<WifiCard contractId="svc-1" />);
    expect(screen.getByRole('button', { name: /Habilitar TR-069/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cambiar WiFi/i })).not.toBeInTheDocument();
  });

  describe('Change WiFi band modal', () => {
    async function openBandModal(user: ReturnType<typeof userEvent.setup>) {
      render(<WifiCard contractId="svc-1" />);
      const buttons = screen.getAllByRole('button', { name: /Cambiar WiFi/i });
      await user.click(buttons[0]!);
      return screen.getByRole('dialog');
    }

    it('does not call the API with an invalid ssid/password (local validation)', async () => {
      const user = userEvent.setup();
      const setBandMutateAsync = vi.fn().mockResolvedValue(undefined);
      setupMocks({ setBandMutateAsync });
      const dialog = await openBandModal(user);

      const password = within(dialog).getByLabelText(/Clave/i);
      await user.clear(password);
      await user.type(password, 'short'); // < 8 chars

      const submit = within(dialog).getByRole('button', { name: /Aplicar cambio/i });
      expect(submit).toBeDisabled();
      await user.click(submit);
      expect(setBandMutateAsync).not.toHaveBeenCalled();
    });

    it('PUT sends {port, ssid, password} exactly as band.port (SmartOLT string id)', async () => {
      const user = userEvent.setup();
      const setBandMutateAsync = vi.fn().mockResolvedValue(undefined);
      setupMocks({ setBandMutateAsync });
      const dialog = await openBandModal(user);

      const ssid = within(dialog).getByLabelText(/SSID/i);
      const password = within(dialog).getByLabelText(/Clave/i);
      await user.clear(ssid);
      await user.type(ssid, 'MI-RED-WIFI');
      await user.type(password, 'clavefuerte123');

      await user.click(within(dialog).getByRole('button', { name: /Aplicar cambio/i }));

      await waitFor(() => {
        expect(setBandMutateAsync).toHaveBeenCalledWith({
          port: 'wifi_0/1',
          ssid: 'MI-RED-WIFI',
          password: 'clavefuerte123',
        });
      });
    });
  });

  describe('Enable TR-069 modal', () => {
    it('does not let confirm without a vlan; with a vlan it POSTs {vlan, tr069Profile}', async () => {
      const user = userEvent.setup();
      const enableTr069MutateAsync = vi.fn().mockResolvedValue(undefined);
      setupMocks({
        wifiStatus: mockQuery<OnuWifiStatus>({ data: { ...prodWifiStatus, tr069Enabled: false } }),
        enableTr069MutateAsync,
      });
      render(<WifiCard contractId="svc-1" />);
      await user.click(screen.getByRole('button', { name: /Habilitar TR-069/i }));
      const dialog = screen.getByRole('dialog');

      const submit = within(dialog).getByRole('button', { name: /Habilitar TR-069/i });
      expect(submit).toBeDisabled();

      const vlanInput = within(dialog).getByLabelText(/VLAN de management/i);
      await user.type(vlanInput, '11');
      expect(submit).not.toBeDisabled();

      await user.click(submit);
      await waitFor(() => {
        expect(enableTr069MutateAsync).toHaveBeenCalledWith({ vlan: 11, tr069Profile: 'SmartOLT' });
      });
    });
  });
});
