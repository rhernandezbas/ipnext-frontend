/**
 * CreateTaskModal — network-mode additions (#40):
 *  - REQ-NTP-3: defaultMode='network' opens locked in network mode, toggle hidden,
 *    NodeSelector visible, static "Nodo Fibra" badge shown.
 *  - REQ-NTP-5: selecting a NetworkSite prefills the address (editable); a site
 *    with empty address leaves the field empty.
 *  - REQ-NTP-4 (empty hint): no projects → project select shows a network hint.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { NetworkSite } from '@/types/networkSite';

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

  it('shows a static "Nodo Fibra" badge instead of the toggle', () => {
    setup();
    expect(screen.getByLabelText(/tipo de tarea: nodo fibra/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/tipo de tarea: nodo fibra/i)).toHaveTextContent('Nodo Fibra');
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
        networkSiteId: 'site-1',
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
