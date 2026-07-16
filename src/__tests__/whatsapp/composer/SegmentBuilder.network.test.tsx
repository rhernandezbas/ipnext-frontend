/**
 * SegmentBuilder — filtros de red Nodo/AP (change node-segment-fe).
 * Dos `Select` PROPIOS dentro de la card "Segmento de destinatarios", debajo
 * de deuda: "Nodo" y "Access Point" (el segundo acotado al nodo elegido,
 * mismo patrón que `ContractNetworkAssignmentPicker`). Opción "Todos" para
 * limpiar cada uno. Los ids viajan DENTRO del `CampaignSegment`
 * (`networkSiteId`/`accessPointId`) — `undefined` = sin filtro (se OMITE del
 * payload, mismo criterio que `balanceMin` vacío).
 *
 * Mock a nivel HOOK (`useNetworkSites`/`useAssignableAccessPoints`) — misma
 * convención que `ContractNetworkAssignmentPicker.test.tsx`.
 *
 *  NSB-1  renderiza los 2 combobox propios "Nodo" y "Access Point"
 *  NSB-2  el select de nodo lista "Todos los nodos" + el catálogo
 *  NSB-3  elegir un nodo llama onChange con networkSiteId (y AP limpiado)
 *  NSB-4  con un nodo en el value, los APs se piden ACOTADOS a ese nodo
 *  NSB-5  elegir un AP setea accessPointId y autocompleta el nodo del AP
 *  NSB-6  elegir un AP SIN nodo linkeado es válido (networkSiteId queda unset)
 *  NSB-7  "Todos los nodos" limpia networkSiteId Y accessPointId
 *  NSB-8  "Todos los APs" limpia SOLO accessPointId
 *  NSB-9  rama loading: selects deshabilitados con "Cargando…"
 *  NSB-10 rama error: mensaje accesible (role=alert) por catálogo caído
 *  NSB-11 rama empty: aviso "no hay nodos/APs disponibles"
 *  NSB-12 nodo o AP solos cuentan como criterio → sin nota; la nota vacía
 *         ahora menciona nodo/AP
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NetworkSite } from '@/types/networkSite';
import type { AccessPointOption } from '@/types/accessPoint';
import type { CampaignSegment } from '@/types/messagingBulk';

vi.mock('@/hooks/useNetworkSites', () => ({ useNetworkSites: vi.fn() }));
vi.mock('@/hooks/useAccessPoints', () => ({ useAssignableAccessPoints: vi.fn() }));

import { useNetworkSites } from '@/hooks/useNetworkSites';
import { useAssignableAccessPoints } from '@/hooks/useAccessPoints';
import { SegmentBuilder } from '@/pages/whatsapp/BulkMessagingPage/components/composer/SegmentBuilder';
import { mockQuery } from '@/__tests__/_utils/reactQueryMocks';

const EMPTY: CampaignSegment = { statuses: [] };

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

/** AP sin nodo linkeado (fibra / alta manual) — elegirlo SOLO es un segmento válido. */
const APS_NO_NODE: AccessPointOption[] = [
  { id: 'ap-9', name: 'AP Suelto', mac: null, networkSiteId: null },
];

function setupCatalogs({
  sites = SITES,
  aps = APS_SITE_1,
}: { sites?: NetworkSite[]; aps?: AccessPointOption[] } = {}) {
  vi.mocked(useNetworkSites).mockReturnValue(mockQuery({ data: sites, isLoading: false }));
  vi.mocked(useAssignableAccessPoints).mockReturnValue(mockQuery({ data: aps, isLoading: false }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('NSB-1: combobox propios de Nodo y Access Point', () => {
  it('renderiza ambos selects con nombre accesible', () => {
    setupCatalogs();
    render(<SegmentBuilder value={EMPTY} onChange={vi.fn()} />);
    expect(screen.getByRole('combobox', { name: /^nodo$/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /access point/i })).toBeInTheDocument();
  });

  it('NO usa <select> nativo (regla del repo: Select propio)', () => {
    setupCatalogs();
    const { container } = render(<SegmentBuilder value={EMPTY} onChange={vi.fn()} />);
    expect(container.querySelector('select')).toBeNull();
  });
});

describe('NSB-2: opciones del select de nodo', () => {
  it('lista "Todos los nodos" + el catálogo de useNetworkSites', () => {
    setupCatalogs();
    render(<SegmentBuilder value={EMPTY} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('combobox', { name: /^nodo$/i }));
    expect(screen.getByRole('option', { name: /todos los nodos/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Nodo Centro' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Nodo Norte' })).toBeInTheDocument();
  });
});

describe('NSB-3: elegir un nodo', () => {
  it('llama onChange con networkSiteId y limpia el accessPointId anterior', () => {
    setupCatalogs();
    const onChange = vi.fn();
    render(
      <SegmentBuilder
        value={{ statuses: [], networkSiteId: 'site-1', accessPointId: 'ap-1' }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('combobox', { name: /^nodo$/i }));
    fireEvent.click(screen.getByRole('option', { name: 'Nodo Norte' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as CampaignSegment;
    expect(next.networkSiteId).toBe('site-2');
    expect(next.accessPointId).toBeUndefined();
    expect(next.statuses).toEqual([]);
  });

  it('el trigger muestra el NOMBRE del nodo elegido', () => {
    setupCatalogs();
    render(<SegmentBuilder value={{ statuses: [], networkSiteId: 'site-1' }} onChange={vi.fn()} />);
    expect(screen.getByRole('combobox', { name: /^nodo$/i })).toHaveTextContent('Nodo Centro');
  });
});

describe('NSB-4: el nodo elegido acota los APs', () => {
  it('pide los APs scoped al networkSiteId del value', () => {
    setupCatalogs({ aps: APS_SITE_2 });
    render(<SegmentBuilder value={{ statuses: [], networkSiteId: 'site-2' }} onChange={vi.fn()} />);
    expect(useAssignableAccessPoints).toHaveBeenCalledWith('site-2');
  });

  it('sin nodo elegido pide el catálogo completo (null)', () => {
    setupCatalogs();
    render(<SegmentBuilder value={EMPTY} onChange={vi.fn()} />);
    expect(useAssignableAccessPoints).toHaveBeenCalledWith(null);
  });

  it('el select de AP lista las opciones del nodo', () => {
    setupCatalogs({ aps: APS_SITE_1 });
    render(<SegmentBuilder value={{ statuses: [], networkSiteId: 'site-1' }} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('combobox', { name: /access point/i }));
    expect(screen.getByRole('option', { name: /todos los aps/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'AP Centro Torre' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'AP Centro Techo' })).toBeInTheDocument();
  });
});

describe('NSB-5: elegir un AP', () => {
  it('setea accessPointId y autocompleta el nodo del AP (coherencia con el picker de contrato)', () => {
    setupCatalogs({ aps: APS_SITE_2 });
    const onChange = vi.fn();
    render(<SegmentBuilder value={EMPTY} onChange={onChange} />);

    fireEvent.click(screen.getByRole('combobox', { name: /access point/i }));
    fireEvent.click(screen.getByRole('option', { name: 'AP Norte Torre' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as CampaignSegment;
    expect(next.accessPointId).toBe('ap-3');
    expect(next.networkSiteId).toBe('site-2');
  });
});

describe('NSB-6: AP sin nodo linkeado', () => {
  it('elegirlo es válido: accessPointId seteado, networkSiteId queda sin setear', () => {
    setupCatalogs({ aps: APS_NO_NODE });
    const onChange = vi.fn();
    render(<SegmentBuilder value={EMPTY} onChange={onChange} />);

    fireEvent.click(screen.getByRole('combobox', { name: /access point/i }));
    fireEvent.click(screen.getByRole('option', { name: 'AP Suelto' }));

    const next = onChange.mock.calls[0][0] as CampaignSegment;
    expect(next.accessPointId).toBe('ap-9');
    expect(next.networkSiteId).toBeUndefined();
  });
});

describe('NSB-7: "Todos los nodos" limpia el filtro de nodo', () => {
  it('limpia networkSiteId Y accessPointId (el AP estaba scoped al nodo que se va)', () => {
    setupCatalogs({ aps: APS_SITE_1 });
    const onChange = vi.fn();
    render(
      <SegmentBuilder
        value={{ statuses: [], networkSiteId: 'site-1', accessPointId: 'ap-1' }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('combobox', { name: /^nodo$/i }));
    fireEvent.click(screen.getByRole('option', { name: /todos los nodos/i }));

    const next = onChange.mock.calls[0][0] as CampaignSegment;
    expect(next.networkSiteId).toBeUndefined();
    expect(next.accessPointId).toBeUndefined();
  });
});

describe('NSB-8: "Todos los APs" limpia solo el AP', () => {
  it('limpia accessPointId y PRESERVA networkSiteId', () => {
    setupCatalogs({ aps: APS_SITE_1 });
    const onChange = vi.fn();
    render(
      <SegmentBuilder
        value={{ statuses: [], networkSiteId: 'site-1', accessPointId: 'ap-1' }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('combobox', { name: /access point/i }));
    fireEvent.click(screen.getByRole('option', { name: /todos los aps/i }));

    const next = onChange.mock.calls[0][0] as CampaignSegment;
    expect(next.networkSiteId).toBe('site-1');
    expect(next.accessPointId).toBeUndefined();
  });
});

describe('NSB-9: rama loading', () => {
  it('ambos selects deshabilitados con "Cargando…"', () => {
    vi.mocked(useNetworkSites).mockReturnValue(
      mockQuery({ data: undefined, isLoading: true, isPending: true, isSuccess: false, status: 'pending' }),
    );
    vi.mocked(useAssignableAccessPoints).mockReturnValue(
      mockQuery({ data: undefined, isLoading: true, isPending: true, isSuccess: false, status: 'pending' }),
    );
    render(<SegmentBuilder value={EMPTY} onChange={vi.fn()} />);

    const nodeTrigger = screen.getByRole('combobox', { name: /^nodo$/i });
    const apTrigger = screen.getByRole('combobox', { name: /access point/i });
    expect(nodeTrigger).toBeDisabled();
    expect(nodeTrigger).toHaveTextContent(/cargando/i);
    expect(apTrigger).toBeDisabled();
    expect(apTrigger).toHaveTextContent(/cargando/i);
  });
});

describe('NSB-10: rama error accesible', () => {
  it('catálogo de nodos caído → role=alert con mensaje claro', () => {
    vi.mocked(useNetworkSites).mockReturnValue(
      mockQuery({ data: undefined, isError: true, error: new Error('boom'), isSuccess: false, status: 'error' }),
    );
    vi.mocked(useAssignableAccessPoints).mockReturnValue(mockQuery({ data: APS_SITE_1, isLoading: false }));
    render(<SegmentBuilder value={EMPTY} onChange={vi.fn()} />);

    const alerts = screen.getAllByRole('alert');
    expect(alerts.some((a) => /nodos/i.test(a.textContent ?? ''))).toBe(true);
    expect(screen.getByRole('combobox', { name: /^nodo$/i })).toBeDisabled();
  });

  it('catálogo de APs caído → role=alert propio, el select de nodo sigue usable', () => {
    vi.mocked(useNetworkSites).mockReturnValue(mockQuery({ data: SITES, isLoading: false }));
    vi.mocked(useAssignableAccessPoints).mockReturnValue(
      mockQuery({ data: undefined, isError: true, error: new Error('boom'), isSuccess: false, status: 'error' }),
    );
    render(<SegmentBuilder value={EMPTY} onChange={vi.fn()} />);

    const alerts = screen.getAllByRole('alert');
    expect(alerts.some((a) => /access point/i.test(a.textContent ?? ''))).toBe(true);
    expect(screen.getByRole('combobox', { name: /access point/i })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: /^nodo$/i })).toBeEnabled();
  });
});

describe('NSB-11: rama empty', () => {
  it('catálogo de nodos vacío → aviso y select deshabilitado', () => {
    setupCatalogs({ sites: [] });
    render(<SegmentBuilder value={EMPTY} onChange={vi.fn()} />);
    expect(screen.getByText(/no hay nodos disponibles/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /^nodo$/i })).toBeDisabled();
  });

  it('sin APs para el nodo elegido → aviso y select de AP deshabilitado', () => {
    setupCatalogs({ aps: [] });
    render(<SegmentBuilder value={{ statuses: [], networkSiteId: 'site-1' }} onChange={vi.fn()} />);
    expect(screen.getByText(/no hay access points disponibles/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /access point/i })).toBeDisabled();
  });
});

describe('NSB-12: nodo/AP como criterio del segmento', () => {
  it('con SOLO un nodo elegido NO muestra la nota de "sin criterio"', () => {
    setupCatalogs();
    render(<SegmentBuilder value={{ statuses: [], networkSiteId: 'site-1' }} onChange={vi.fn()} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('con SOLO un AP elegido NO muestra la nota de "sin criterio"', () => {
    setupCatalogs();
    render(<SegmentBuilder value={{ statuses: [], accessPointId: 'ap-1' }} onChange={vi.fn()} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('sin ningún criterio, la nota menciona también nodo/AP', () => {
    setupCatalogs();
    render(<SegmentBuilder value={EMPTY} onChange={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent(/nodo\/ap/i);
  });
});
