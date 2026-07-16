/**
 * ContractNetworkAssignmentPicker — contract-node-ap-auto-assign (Fase B FE, picker manual).
 *
 * Presentational component (molde `GeoLocationEditor`): recibe la asignación actual como props
 * y persiste via `onSave` (el CALLER es dueño de la mutación PATCH /contracts/:id/network-assignment,
 * igual que `useUpdateContractLocation` para el geo editor).
 *
 * DEUDA documentada (ver design.md — no hay GET para leer la asignación actual de un contrato,
 * ni `ListContracts` ni ningún otro endpoint la expone): `currentNetworkSiteId`/`currentAccessPointId`
 * son `string | null | undefined` — `undefined` = desconocido (BE gap), `null` = confirmado sin
 * asignar. El componente declara el estado desconocido en vez de mentir un "Sin asignar" con
 * confianza (mismo criterio que PppoeAutoMoveCard con el flag-fetch error).
 *
 * Covers:
 *  1. Estado desconocido (BE gap) vs confirmado
 *  2. Opciones del Select "Nodo" desde useNetworkSites
 *  3. Opciones del Select "Access Point" filtradas por el nodo elegido (useAssignableAccessPoints)
 *  4. Elegir nodo limpia el AP elegido antes
 *  5. Elegir AP autocompleta el nodo (coherencia con el par persistido del BE)
 *  6. Gate contracts.assign
 *  7. 4 ramas de estado: idle/editable, saving, success, error (incl. mapeo de 422 tipados)
 *  8. Limpiar → onSave({ networkSiteId: null, accessPointId: null })
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { NetworkSite } from '@/types/networkSite';
import type { AccessPointOption } from '@/types/accessPoint';

vi.mock('@/hooks/useNetworkSites', () => ({
  useNetworkSites: vi.fn(),
}));
vi.mock('@/hooks/useAccessPoints', () => ({
  useAssignableAccessPoints: vi.fn(),
}));
vi.mock('@/hooks/useMyPermissions', () => ({
  useMyPermissions: vi.fn(),
  useCan: vi.fn(),
}));

import { useNetworkSites } from '@/hooks/useNetworkSites';
import { useAssignableAccessPoints } from '@/hooks/useAccessPoints';
import { useMyPermissions, useCan } from '@/hooks/useMyPermissions';
import { ContractNetworkAssignmentPicker } from '@/components/molecules/ContractNetworkAssignmentPicker/ContractNetworkAssignmentPicker';
import { mockQuery } from '@/__tests__/_utils/reactQueryMocks';

function site(overrides: Partial<NetworkSite> = {}): NetworkSite {
  return {
    id: 'site-1',
    siteNumber: 1,
    fixedCode: 'NODO 1',
    name: 'Nodo Centro',
    address: 'Av. Siempreviva 742',
    city: 'CABA',
    coordinates: null,
    type: 'nodo',
    status: 'active',
    deviceCount: 10,
    clientCount: 100,
    uplink: '1 Gbps',
    parentSiteId: null,
    description: '',
    iclassNodeCode: null,
    uispSiteId: null,
    ...overrides,
  };
}

const SITES: NetworkSite[] = [
  site({ id: 'site-1', name: 'Nodo Centro' }),
  site({ id: 'site-2', siteNumber: 2, fixedCode: 'NODO 2', name: 'Nodo Norte' }),
];

const APS_SITE_1: AccessPointOption[] = [
  { id: 'ap-1', name: 'AP Centro Torre', mac: 'AA:BB:CC:DD:EE:01', networkSiteId: 'site-1' },
  { id: 'ap-2', name: 'AP Centro Techo', mac: 'AA:BB:CC:DD:EE:02', networkSiteId: 'site-1' },
];

const APS_SITE_2: AccessPointOption[] = [
  { id: 'ap-3', name: 'AP Norte Torre', mac: 'AA:BB:CC:DD:EE:03', networkSiteId: 'site-2' },
];

function setupHooks({
  permissions = ['contracts.assign'],
  aps = APS_SITE_1,
}: { permissions?: string[]; aps?: AccessPointOption[] } = {}) {
  vi.mocked(useMyPermissions).mockReturnValue({
    user: null,
    roles: [],
    permissions,
    isLoading: false,
    isError: false,
    can: (p: string | string[], _mode?: string) => {
      const perms = Array.isArray(p) ? p : [p];
      return perms.some((perm) => permissions.includes(perm));
    },
  } as never);
  vi.mocked(useCan).mockImplementation((perm: string) => permissions.includes(perm));

  vi.mocked(useNetworkSites).mockReturnValue(mockQuery({ data: SITES, isLoading: false }));
  vi.mocked(useAssignableAccessPoints).mockReturnValue(mockQuery({ data: aps, isLoading: false }));
}

describe('ContractNetworkAssignmentPicker', () => {
  const onSave = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    onSave.mockResolvedValue(undefined);
  });

  // ── Estado actual: desconocido vs confirmado (deuda BE) ──────────────────

  it('shows an "estado no disponible" notice when current values are not provided', () => {
    setupHooks();
    render(<ContractNetworkAssignmentPicker onSave={onSave} />);
    expect(screen.getByText(/estado actual no disponible/i)).toBeInTheDocument();
  });

  it('does NOT show the notice when current values are explicitly confirmed (null)', () => {
    setupHooks();
    render(
      <ContractNetworkAssignmentPicker
        currentNetworkSiteId={null}
        currentAccessPointId={null}
        onSave={onSave}
      />,
    );
    expect(screen.queryByText(/estado actual no disponible/i)).not.toBeInTheDocument();
  });

  it('does NOT show the notice when current values carry a real id', () => {
    setupHooks();
    render(
      <ContractNetworkAssignmentPicker
        currentNetworkSiteId="site-1"
        currentAccessPointId="ap-1"
        onSave={onSave}
      />,
    );
    expect(screen.queryByText(/estado actual no disponible/i)).not.toBeInTheDocument();
  });

  // ── Node select options ────────────────────────────────────────────────

  it('renders node options from useNetworkSites', () => {
    setupHooks();
    render(<ContractNetworkAssignmentPicker onSave={onSave} />);
    fireEvent.click(screen.getByRole('combobox', { name: /^nodo$/i }));
    expect(screen.getByRole('option', { name: 'Nodo Centro' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Nodo Norte' })).toBeInTheDocument();
  });

  // ── AP select scoped to the chosen node ───────────────────────────────

  it('requests APs scoped to the currently selected node', () => {
    setupHooks();
    render(
      <ContractNetworkAssignmentPicker
        currentNetworkSiteId="site-1"
        currentAccessPointId={null}
        onSave={onSave}
      />,
    );
    expect(useAssignableAccessPoints).toHaveBeenCalledWith('site-1');
  });

  it('renders AP options for the currently selected node', () => {
    setupHooks();
    render(
      <ContractNetworkAssignmentPicker
        currentNetworkSiteId="site-1"
        currentAccessPointId={null}
        onSave={onSave}
      />,
    );
    fireEvent.click(screen.getByRole('combobox', { name: /access point/i }));
    expect(screen.getByRole('option', { name: /AP Centro Torre/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /AP Centro Techo/i })).toBeInTheDocument();
  });

  // ── Node/AP interplay ──────────────────────────────────────────────────

  it('selecting a node clears the previously selected AP', () => {
    setupHooks();
    render(
      <ContractNetworkAssignmentPicker
        currentNetworkSiteId="site-1"
        currentAccessPointId="ap-1"
        onSave={onSave}
      />,
    );
    fireEvent.click(screen.getByRole('combobox', { name: /^nodo$/i }));
    fireEvent.click(screen.getByRole('option', { name: 'Nodo Norte' }));

    const apTrigger = screen.getByRole('combobox', { name: /access point/i });
    expect(apTrigger).toHaveTextContent(/sin ap|elegí/i);
  });

  it('selecting an AP autofills the node select to the AP\'s networkSiteId', () => {
    setupHooks({ aps: APS_SITE_2 });
    render(
      <ContractNetworkAssignmentPicker
        currentNetworkSiteId="site-2"
        currentAccessPointId={null}
        onSave={onSave}
      />,
    );
    fireEvent.click(screen.getByRole('combobox', { name: /access point/i }));
    fireEvent.click(screen.getByRole('option', { name: /AP Norte Torre/i }));

    const nodeTrigger = screen.getByRole('combobox', { name: /^nodo$/i });
    expect(nodeTrigger).toHaveTextContent('Nodo Norte');
  });

  // ── Gate contracts.assign ─────────────────────────────────────────────

  it('does NOT render editable controls without contracts.assign', () => {
    setupHooks({ permissions: [] });
    render(<ContractNetworkAssignmentPicker onSave={onSave} />);
    expect(screen.queryByRole('combobox', { name: /^nodo$/i })).not.toBeInTheDocument();
  });

  it('renders editable controls with contracts.assign', () => {
    setupHooks();
    render(<ContractNetworkAssignmentPicker onSave={onSave} />);
    expect(screen.getByRole('combobox', { name: /^nodo$/i })).toBeInTheDocument();
  });

  // ── Guardar: idle → saving → success ──────────────────────────────────

  it('clicking Guardar calls onSave with the current node/AP selection', async () => {
    setupHooks();
    render(
      <ContractNetworkAssignmentPicker
        currentNetworkSiteId="site-1"
        currentAccessPointId="ap-1"
        onSave={onSave}
      />,
    );
    fireEvent.click(screen.getByTestId('network-assignment-save-button'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({ networkSiteId: 'site-1', accessPointId: 'ap-1' });
    });
  });

  it('disables the buttons and marks aria-busy while saving', async () => {
    setupHooks();
    let resolveSave: () => void = () => {};
    onSave.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );
    render(<ContractNetworkAssignmentPicker onSave={onSave} />);

    fireEvent.click(screen.getByTestId('network-assignment-save-button'));

    await waitFor(() => {
      expect(screen.getByTestId('network-assignment-save-button')).toBeDisabled();
    });
    expect(screen.getByTestId('network-assignment-save-button')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId('network-assignment-clear-button')).toBeDisabled();

    resolveSave();
  });

  it('shows a success banner after onSave resolves', async () => {
    setupHooks();
    render(<ContractNetworkAssignmentPicker onSave={onSave} />);
    fireEvent.click(screen.getByTestId('network-assignment-save-button'));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/guardad/i);
    });
  });

  // ── Errores mapeados (422 tipados) ─────────────────────────────────────

  it('maps ACCESS_POINT_NOT_IN_SITE to a specific message', async () => {
    setupHooks();
    onSave.mockRejectedValue({ response: { status: 422, data: { code: 'ACCESS_POINT_NOT_IN_SITE' } } });
    render(<ContractNetworkAssignmentPicker onSave={onSave} />);
    fireEvent.click(screen.getByTestId('network-assignment-save-button'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/no pertenece al nodo/i);
    });
  });

  it('maps ACCESS_POINT_RETIRED to a specific message', async () => {
    setupHooks();
    onSave.mockRejectedValue({ response: { status: 422, data: { code: 'ACCESS_POINT_RETIRED' } } });
    render(<ContractNetworkAssignmentPicker onSave={onSave} />);
    fireEvent.click(screen.getByTestId('network-assignment-save-button'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/retirado/i);
    });
  });

  it('shows a generic message for unmapped errors', async () => {
    setupHooks();
    onSave.mockRejectedValue({ response: { status: 500, data: {} } });
    render(<ContractNetworkAssignmentPicker onSave={onSave} />);
    fireEvent.click(screen.getByTestId('network-assignment-save-button'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/no se pudo guardar/i);
    });
  });

  // ── Limpiar ─────────────────────────────────────────────────────────────

  it('clicking Limpiar calls onSave with both fields null and resets the selects', async () => {
    setupHooks();
    render(
      <ContractNetworkAssignmentPicker
        currentNetworkSiteId="site-1"
        currentAccessPointId="ap-1"
        onSave={onSave}
      />,
    );
    fireEvent.click(screen.getByTestId('network-assignment-clear-button'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({ networkSiteId: null, accessPointId: null });
    });
    expect(screen.getByRole('combobox', { name: /^nodo$/i })).toHaveTextContent(/sin nodo|elegí/i);
  });
});
