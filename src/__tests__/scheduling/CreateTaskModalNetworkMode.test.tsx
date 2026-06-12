/**
 * CreateTaskModal — network-mode additions (#40):
 *  - REQ-NTP-3: defaultMode='network' opens locked in network mode, toggle hidden,
 *    NodeSelector visible, static "Nodo Fibra" badge shown.
 *  - REQ-NTP-5: selecting a NetworkSite prefills the address (editable); a site
 *    with empty address leaves the field empty.
 *  - REQ-NTP-4 (empty hint): no projects → project select shows a network hint.
 *  - REQ-54: required "Localidad" dropdown (IClass node code) in network mode.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { NetworkSite } from '@/types/networkSite';
import type { IClassNode } from '@/types/iclassNode';

// CustomerPicker uses useCustomers — stub so the modal renders without QueryClient.
vi.mock('@/hooks/useCustomers', () => ({
  useClientList: () => ({ data: { data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 }, isFetching: false }),
  useClientDetail: () => ({ data: undefined }),
  useClientContracts: () => ({ data: [] }),
}));
vi.mock('@/hooks/useTaskCategories', () => ({
  useTaskCategories: () => ({ data: [{ id: 'c5', name: 'Otro', description: null }] }),
}));
vi.mock('@/hooks/useTaskPriorities', () => ({
  useTaskPriorities: () => ({ data: [{ id: 'p2', name: 'Normal', color: '#3b82f6', weight: 2 }] }),
}));

const useNetworkSitesMock = vi.fn();
vi.mock('@/hooks/useNetworkSites', () => ({
  useNetworkSites: () => useNetworkSitesMock(),
}));

const useIClassNodesMock = vi.fn();
vi.mock('@/hooks/useIClassNodes', () => ({
  useIClassNodes: () => useIClassNodesMock(),
}));

// IClass node fixtures: Springfield matches the makeSite city; Rosario is another eligible node.
const iclassNodes: IClassNode[] = [
  { id: 'n1', nodeId: 1, code: 'Springfield', description: 'Springfield node', active: true, selectable: true, lastSyncedAt: null },
  { id: 'n2', nodeId: 2, code: 'Rosario', description: 'Rosario node', active: true, selectable: true, lastSyncedAt: null },
  { id: 'n3', nodeId: 3, code: 'Inactive', description: 'Not selectable', active: false, selectable: false, lastSyncedAt: null },
];

import { CreateTaskModal } from '@/pages/scheduling/SchedulingTasksPage/components/CreateTaskModal';
import type { Project } from '@/types/project';
import type { Workflow } from '@/types/workflow';

const workflows: Workflow[] = [
  {
    id: 'wf-1', name: 'Default', description: null, createdAt: '', updatedAt: '',
    stages: [
      { id: 'stage-new', workflowId: 'wf-1', name: 'Nuevo', category: 'nuevo', order: 0 },
      { id: 'stage-prog', workflowId: 'wf-1', name: 'En progreso', category: 'enProgreso', order: 1 },
    ],
  },
];

const networkProjects: Project[] = [
  { id: 'np-1', title: 'RED - FIBRA', description: null, workflowId: 'wf-1', isNetworkProject: true, createdAt: '', updatedAt: '' },
];

const makeSite = (over: Partial<NetworkSite> = {}): NetworkSite => ({
  id: 'site-1', name: 'POP Centro', address: 'Av. Siempreviva 742', city: 'Springfield',
  coordinates: null, type: 'pop', status: 'active', deviceCount: 0, clientCount: 0,
  uplink: '', parentSiteId: null, description: '', iclassNodeCode: null, uispSiteId: null,
  ...over,
});

const onClose = vi.fn();
const onCreate = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  onCreate.mockResolvedValue(undefined);
  useNetworkSitesMock.mockReturnValue({ data: [makeSite()], isLoading: false });
  useIClassNodesMock.mockReturnValue({ data: iclassNodes });
});

describe('CreateTaskModal defaultMode="network" (REQ-NTP-3)', () => {
  function setup(projects = networkProjects) {
    return render(
      <CreateTaskModal
        projects={projects}
        workflows={workflows}
        defaultMode="network"
        onClose={onClose}
        onCreate={onCreate}
        loading={false}
      />,
    );
  }

  it('hides the mode toggle (no Cliente/Nodo segmented control)', () => {
    setup();
    expect(screen.queryByRole('group', { name: /tipo de tarea/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^cliente$/i })).not.toBeInTheDocument();
  });

  it('shows a static "Nodo RED" badge by default (networkType defaults to red)', () => {
    setup();
    expect(screen.getByLabelText(/tipo de tarea: nodo red/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/tipo de tarea: nodo red/i)).toHaveTextContent('Nodo RED');
  });

  it('renders the NodeSelector (network mode active), not the CustomerPicker', () => {
    setup();
    expect(screen.getByRole('listbox', { name: /nodos de red/i })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/buscar cliente/i)).not.toBeInTheDocument();
  });
});

describe('CreateTaskModal address prefill from NetworkSite (REQ-NTP-5)', () => {
  function setup(sites: NetworkSite[]) {
    useNetworkSitesMock.mockReturnValue({ data: sites, isLoading: false });
    return render(
      <CreateTaskModal
        projects={networkProjects}
        workflows={workflows}
        defaultMode="network"
        onClose={onClose}
        onCreate={onCreate}
        loading={false}
      />,
    );
  }

  it('prefills the address input when a site with an address is selected', async () => {
    setup([makeSite({ id: 'site-1', name: 'POP Centro', address: 'Av. Siempreviva 742' })]);
    fireEvent.click(screen.getByText('POP Centro'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Dirección del trabajo')).toHaveValue('Av. Siempreviva 742');
    });
  });

  it('leaves the address empty when the selected site has an empty address', async () => {
    setup([makeSite({ id: 'site-2', name: 'Nodo Vacío', address: '' })]);
    fireEvent.click(screen.getByText('Nodo Vacío'));
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /nodo vacío/i })).toHaveAttribute('aria-selected', 'true');
    });
    expect(screen.getByPlaceholderText('Dirección del trabajo')).toHaveValue('');
  });

  it('does not clobber a manual address edit after selecting the same site', async () => {
    setup([makeSite({ id: 'site-1', name: 'POP Centro', address: 'Av. Siempreviva 742' })]);
    fireEvent.click(screen.getByText('POP Centro'));
    const addr = screen.getByPlaceholderText('Dirección del trabajo');
    await waitFor(() => expect(addr).toHaveValue('Av. Siempreviva 742'));
    fireEvent.change(addr, { target: { value: 'Mi dirección manual' } });
    expect(addr).toHaveValue('Mi dirección manual');
  });
});

describe('CreateTaskModal network submit payload (REQ-NTP-3)', () => {
  it('emits kind="network" + networkSiteId (and nulled customer fields) on Crear tarea', async () => {
    render(
      <CreateTaskModal
        projects={networkProjects}
        workflows={workflows}
        defaultMode="network"
        onClose={onClose}
        onCreate={onCreate}
        loading={false}
      />,
    );

    // Required fields for a valid network create: title, description, project, site.
    fireEvent.change(screen.getByPlaceholderText('Título de la tarea'), { target: { value: 'Mantenimiento POP' } });
    fireEvent.change(screen.getByPlaceholderText('Detalles de la tarea…'), { target: { value: 'Revisión de equipo' } });
    fireEvent.change(screen.getByRole('combobox', { name: /proyecto/i }), { target: { value: 'np-1' } });
    fireEvent.click(screen.getByText('POP Centro'));

    const submit = screen.getByRole('button', { name: /crear tarea/i });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'network',
        networkType: 'red',
        networkSiteId: 'site-1',
        networkSiteName: null,
        projectId: 'np-1',
        customerId: null,
        customerName: null,
        contractId: null,
      }),
    );
  });
});

describe('CreateTaskModal address required in network mode (REQ-53)', () => {
  function setupFilled() {
    return render(
      <CreateTaskModal
        projects={networkProjects}
        workflows={workflows}
        defaultMode="network"
        onClose={onClose}
        onCreate={onCreate}
        loading={false}
      />,
    );
  }

  it('disables "Crear tarea" when a node is selected but address is cleared', async () => {
    setupFilled();
    fireEvent.change(screen.getByPlaceholderText('Título de la tarea'), { target: { value: 'Tarea nodo' } });
    fireEvent.change(screen.getByPlaceholderText('Detalles de la tarea…'), { target: { value: 'Descripción' } });
    fireEvent.change(screen.getByRole('combobox', { name: /proyecto/i }), { target: { value: 'np-1' } });
    fireEvent.click(screen.getByText('POP Centro'));
    // Address gets autofilled; clear it manually.
    const addr = screen.getByPlaceholderText('Dirección del trabajo');
    await waitFor(() => expect(addr).toHaveValue('Av. Siempreviva 742'));
    fireEvent.change(addr, { target: { value: '' } });
    const submit = screen.getByRole('button', { name: /crear tarea/i });
    expect(submit).toBeDisabled();
  });

  it('enables "Crear tarea" when node is selected and address is non-blank', async () => {
    setupFilled();
    fireEvent.change(screen.getByPlaceholderText('Título de la tarea'), { target: { value: 'Tarea nodo' } });
    fireEvent.change(screen.getByPlaceholderText('Detalles de la tarea…'), { target: { value: 'Descripción' } });
    fireEvent.change(screen.getByRole('combobox', { name: /proyecto/i }), { target: { value: 'np-1' } });
    fireEvent.click(screen.getByText('POP Centro'));
    const addr = screen.getByPlaceholderText('Dirección del trabajo');
    await waitFor(() => expect(addr).toHaveValue('Av. Siempreviva 742'));
    const submit = screen.getByRole('button', { name: /crear tarea/i });
    await waitFor(() => expect(submit).toBeEnabled());
  });

  it('shows the required asterisk on Dirección label in network mode', () => {
    setupFilled();
    // aria-hidden span with "*" next to "Dirección" text
    const asterisk = document.querySelector('[aria-hidden="true"]');
    // Find all aria-hidden="true" elements and check one contains "*"
    const allHidden = document.querySelectorAll('[aria-hidden="true"]');
    const hasAsterisk = Array.from(allHidden).some(el => el.textContent === '*');
    expect(hasAsterisk).toBe(true);
  });
});

describe('CreateTaskModal empty network-project hint (REQ-NTP-4)', () => {
  it('shows a network hint when no projects are available in network mode', () => {
    render(
      <CreateTaskModal
        projects={[]}
        workflows={workflows}
        defaultMode="network"
        onClose={onClose}
        onCreate={onCreate}
        loading={false}
      />,
    );
    expect(screen.getByText(/no hay proyectos de red configurados/i)).toBeInTheDocument();
  });
});

// ── REQ-54: required Localidad dropdown ──────────────────────────────────────

describe('CreateTaskModal — Localidad dropdown in network mode (REQ-54)', () => {
  function setupNetwork(sites = [makeSite()]) {
    useNetworkSitesMock.mockReturnValue({ data: sites, isLoading: false });
    return render(
      <CreateTaskModal
        projects={networkProjects}
        workflows={workflows}
        defaultMode="network"
        onClose={onClose}
        onCreate={onCreate}
        loading={false}
      />,
    );
  }

  // ── TC-1: Localidad select is present with eligible options ──────────────
  // In RED mode (default) localidad is OPTIONAL (no asterisk). In FO mode it is REQUIRED.
  it('renders a "Localidad" select with eligible IClass node options (optional in RED mode)', () => {
    setupNetwork();
    // The label text "Localidad" must be visible
    expect(screen.getByText(/^localidad$/i)).toBeInTheDocument();
    // The select has options from the eligible nodes (Springfield, Rosario — not Inactive)
    const select = screen.getByRole('combobox', { name: /localidad/i });
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Springfield' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Rosario' })).toBeInTheDocument();
    // Inactive node must NOT appear as an option
    expect(screen.queryByRole('option', { name: 'Inactive' })).not.toBeInTheDocument();
    // In RED mode, localidad has NO required asterisk (it is optional)
    const label = screen.getByText(/^localidad$/i).closest('label') ?? screen.getByText(/^localidad$/i).parentElement;
    expect(label?.querySelector('[aria-hidden="true"]')).not.toBeInTheDocument();
  });

  it('shows required asterisk on Localidad when switched to FO mode', () => {
    setupNetwork();
    fireEvent.click(screen.getByRole('button', { name: /^FO$/i }));
    const label = screen.getByText(/^localidad$/i).closest('label') ?? screen.getByText(/^localidad$/i).parentElement;
    expect(label?.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  // ── TC-2: With all required fields (incl. locality) -> button enabled ────
  it('enables "Crear tarea" when node, address, locality, title, description, project are filled', async () => {
    setupNetwork();
    fireEvent.change(screen.getByPlaceholderText('Título de la tarea'), { target: { value: 'Mantenimiento' } });
    fireEvent.change(screen.getByPlaceholderText('Detalles de la tarea…'), { target: { value: 'Descripción' } });
    fireEvent.change(screen.getByRole('combobox', { name: /proyecto/i }), { target: { value: 'np-1' } });
    // Select the site -> address autofills; locality also autofills (city=Springfield matches a node)
    fireEvent.click(screen.getByText('POP Centro'));
    // Select locality manually if not auto-filled
    const localidadSelect = screen.getByRole('combobox', { name: /localidad/i });
    await waitFor(() => expect(localidadSelect).toHaveValue('Springfield'));
    const submit = screen.getByRole('button', { name: /crear tarea/i });
    await waitFor(() => expect(submit).toBeEnabled());
  });

  // ── TC-3: In RED mode, clearing locality does NOT disable submit (locality optional) ──
  it('keeps "Crear tarea" enabled when locality is cleared in RED mode (locality optional in red)', async () => {
    setupNetwork();
    fireEvent.change(screen.getByPlaceholderText('Título de la tarea'), { target: { value: 'Mantenimiento' } });
    fireEvent.change(screen.getByPlaceholderText('Detalles de la tarea…'), { target: { value: 'Descripción' } });
    fireEvent.change(screen.getByRole('combobox', { name: /proyecto/i }), { target: { value: 'np-1' } });
    fireEvent.click(screen.getByText('POP Centro'));
    const localidadSelect = screen.getByRole('combobox', { name: /localidad/i });
    await waitFor(() => expect(localidadSelect).toHaveValue('Springfield'));
    // Clear locality — in RED mode this should NOT block submit
    fireEvent.change(localidadSelect, { target: { value: '' } });
    const submit = screen.getByRole('button', { name: /crear tarea/i });
    // Address was autofilled from site, nodeId is selected -> should still be enabled
    await waitFor(() => expect(submit).toBeEnabled());
  });

  // ── TC-4: Payload includes iclassCityCode ────────────────────────────────
  it('includes iclassCityCode in the payload on submit', async () => {
    setupNetwork();
    fireEvent.change(screen.getByPlaceholderText('Título de la tarea'), { target: { value: 'Mantenimiento' } });
    fireEvent.change(screen.getByPlaceholderText('Detalles de la tarea…'), { target: { value: 'Descripción' } });
    fireEvent.change(screen.getByRole('combobox', { name: /proyecto/i }), { target: { value: 'np-1' } });
    fireEvent.click(screen.getByText('POP Centro'));
    const localidadSelect = screen.getByRole('combobox', { name: /localidad/i });
    await waitFor(() => expect(localidadSelect).toHaveValue('Springfield'));
    // Change to Rosario
    fireEvent.change(localidadSelect, { target: { value: 'Rosario' } });
    const submit = screen.getByRole('button', { name: /crear tarea/i });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ iclassCityCode: 'Rosario' }),
    );
  });

  // ── TC-5: Default from site city when city matches an eligible node ──────
  it('preselects the site city in Localidad when it matches an eligible node code', async () => {
    // makeSite has city: 'Springfield' — which matches iclassNodes[0].code
    setupNetwork([makeSite()]);
    fireEvent.click(screen.getByText('POP Centro'));
    const localidadSelect = screen.getByRole('combobox', { name: /localidad/i });
    await waitFor(() => expect(localidadSelect).toHaveValue('Springfield'));
  });

  // ── TC-6: Customer mode — no Localidad dropdown, customer payload unaffected ─
  it('does NOT render Localidad in customer mode (customer context)', () => {
    render(
      <CreateTaskModal
        projects={networkProjects}
        workflows={workflows}
        onClose={onClose}
        onCreate={onCreate}
        loading={false}
      />,
    );
    expect(screen.queryByRole('combobox', { name: /localidad/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/^localidad$/i)).not.toBeInTheDocument();
  });
});

// ── #68: coordinates fallback when site has no manual address ────────────────
// Replica del criterio de #51 (addressDisplay): la `address` manual gana siempre;
// si está vacía pero el sitio tiene coordenadas UISP, el campo Dirección se
// autocarga con "{lat},{lng}" (editable). Si no hay ni address ni coords → vacío.

describe('CreateTaskModal — coordinates address fallback in RED mode (#68)', () => {
  function setup(sites: NetworkSite[]) {
    useNetworkSitesMock.mockReturnValue({ data: sites, isLoading: false });
    return render(
      <CreateTaskModal
        projects={networkProjects}
        workflows={workflows}
        defaultMode="network"
        onClose={onClose}
        onCreate={onCreate}
        loading={false}
      />,
    );
  }

  it('prefills address with "lat,lng" when the site has no manual address but has coordinates', async () => {
    setup([makeSite({ id: 'site-c', name: 'Nodo Coord', address: '', coordinates: { lat: -34.6037, lng: -58.3816 } })]);
    fireEvent.click(screen.getByText('Nodo Coord'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Dirección del trabajo')).toHaveValue('-34.6037,-58.3816');
    });
  });

  it('manual address wins over coordinates (does not fall back to lat,lng)', async () => {
    setup([makeSite({ id: 'site-m', name: 'Nodo Manual', address: 'Av. Siempreviva 742', coordinates: { lat: -34.6037, lng: -58.3816 } })]);
    fireEvent.click(screen.getByText('Nodo Manual'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Dirección del trabajo')).toHaveValue('Av. Siempreviva 742');
    });
  });

  it('leaves address empty when the site has neither manual address nor coordinates', async () => {
    setup([makeSite({ id: 'site-e', name: 'Nodo Vacío', address: '', coordinates: null })]);
    fireEvent.click(screen.getByText('Nodo Vacío'));
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /nodo vacío/i })).toHaveAttribute('aria-selected', 'true');
    });
    expect(screen.getByPlaceholderText('Dirección del trabajo')).toHaveValue('');
  });

  it('the autofilled "lat,lng" address is editable (manual edit is not clobbered)', async () => {
    setup([makeSite({ id: 'site-c', name: 'Nodo Coord', address: '', coordinates: { lat: -34.6037, lng: -58.3816 } })]);
    fireEvent.click(screen.getByText('Nodo Coord'));
    const addr = screen.getByPlaceholderText('Dirección del trabajo');
    await waitFor(() => expect(addr).toHaveValue('-34.6037,-58.3816'));
    fireEvent.change(addr, { target: { value: 'Dirección corregida 100' } });
    expect(addr).toHaveValue('Dirección corregida 100');
  });
});

// ── Red / FO switch (#66) ────────────────────────────────────────────────────

describe('CreateTaskModal — Red/FO switch in network mode (#66)', () => {
  function setupNetwork(sites = [makeSite()]) {
    useNetworkSitesMock.mockReturnValue({ data: sites, isLoading: false });
    return render(
      <CreateTaskModal
        projects={networkProjects}
        workflows={workflows}
        defaultMode="network"
        onClose={onClose}
        onCreate={onCreate}
        loading={false}
      />,
    );
  }

  it('renders "Red" and "FO" toggle buttons in network mode', () => {
    setupNetwork();
    expect(screen.getByRole('button', { name: /^Red$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^FO$/i })).toBeInTheDocument();
  });

  it('defaults to Red (Red button pressed, NodeSelector visible)', () => {
    setupNetwork();
    const redBtn = screen.getByRole('button', { name: /^Red$/i });
    expect(redBtn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('listbox', { name: /nodos de red/i })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/nombre del nodo fo/i)).not.toBeInTheDocument();
  });

  it('switches to FO: hides NodeSelector, shows free-text node name input', () => {
    setupNetwork();
    fireEvent.click(screen.getByRole('button', { name: /^FO$/i }));
    expect(screen.getByRole('button', { name: /^FO$/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('listbox', { name: /nodos de red/i })).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/nombre del nodo fo/i)).toBeInTheDocument();
  });

  it('shows "Nodo Fibra" badge when switched to FO', () => {
    setupNetwork();
    fireEvent.click(screen.getByRole('button', { name: /^FO$/i }));
    expect(screen.getByLabelText(/tipo de tarea: nodo fibra/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/tipo de tarea: nodo fibra/i)).toHaveTextContent('Nodo Fibra');
  });

  it('shows "Nodo RED" badge in Red mode (default)', () => {
    setupNetwork();
    expect(screen.getByLabelText(/tipo de tarea: nodo red/i)).toHaveTextContent('Nodo RED');
  });

  it('in FO mode, localidad is required: clearing it disables submit', async () => {
    setupNetwork();
    fireEvent.click(screen.getByRole('button', { name: /^FO$/i }));
    fireEvent.change(screen.getByPlaceholderText('Título de la tarea'), { target: { value: 'Tarea FO' } });
    fireEvent.change(screen.getByPlaceholderText('Detalles de la tarea…'), { target: { value: 'Desc' } });
    fireEvent.change(screen.getByRole('combobox', { name: /proyecto/i }), { target: { value: 'np-1' } });
    fireEvent.change(screen.getByPlaceholderText(/nombre del nodo fo/i), { target: { value: 'Nodo-FO-01' } });
    fireEvent.change(screen.getByPlaceholderText('Dirección del trabajo'), { target: { value: 'Calle 1' } });
    // Leave localidad empty — should be disabled
    const submit = screen.getByRole('button', { name: /crear tarea/i });
    expect(submit).toBeDisabled();
  });

  it('in FO mode, submit enabled when node name + address + localidad filled', async () => {
    setupNetwork();
    fireEvent.click(screen.getByRole('button', { name: /^FO$/i }));
    fireEvent.change(screen.getByPlaceholderText('Título de la tarea'), { target: { value: 'Tarea FO' } });
    fireEvent.change(screen.getByPlaceholderText('Detalles de la tarea…'), { target: { value: 'Desc' } });
    fireEvent.change(screen.getByRole('combobox', { name: /proyecto/i }), { target: { value: 'np-1' } });
    fireEvent.change(screen.getByPlaceholderText(/nombre del nodo fo/i), { target: { value: 'Nodo-FO-01' } });
    fireEvent.change(screen.getByPlaceholderText('Dirección del trabajo'), { target: { value: 'Calle 1' } });
    fireEvent.change(screen.getByRole('combobox', { name: /localidad/i }), { target: { value: 'Springfield' } });
    const submit = screen.getByRole('button', { name: /crear tarea/i });
    await waitFor(() => expect(submit).toBeEnabled());
  });

  it('FO payload has networkType=fibra, networkSiteId=null, networkSiteName set', async () => {
    setupNetwork();
    fireEvent.click(screen.getByRole('button', { name: /^FO$/i }));
    fireEvent.change(screen.getByPlaceholderText('Título de la tarea'), { target: { value: 'Tarea FO' } });
    fireEvent.change(screen.getByPlaceholderText('Detalles de la tarea…'), { target: { value: 'Desc' } });
    fireEvent.change(screen.getByRole('combobox', { name: /proyecto/i }), { target: { value: 'np-1' } });
    fireEvent.change(screen.getByPlaceholderText(/nombre del nodo fo/i), { target: { value: 'Nodo-FO-01' } });
    fireEvent.change(screen.getByPlaceholderText('Dirección del trabajo'), { target: { value: 'Calle 1' } });
    fireEvent.change(screen.getByRole('combobox', { name: /localidad/i }), { target: { value: 'Rosario' } });
    const submit = screen.getByRole('button', { name: /crear tarea/i });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'network',
        networkType: 'fibra',
        networkSiteId: null,
        networkSiteName: 'Nodo-FO-01',
        iclassCityCode: 'Rosario',
      }),
    );
  });
});
