/**
 * CreateTaskModal — network mode tests (#29)
 * Tests the RED toggle, NodeSelector visibility, canSave logic, and payload shape
 * for the network-task (kind: 'network') branch.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { NetworkSite } from '@/types/networkSite';

// ── Mocks ────────────────────────────────────────────────────────────────────

const useClientListMock = vi.fn(() => ({
  data: { data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 },
  isFetching: false,
}));
const useClientDetailMock = vi.fn(() => ({ data: undefined as unknown }));
const useClientContractsMock = vi.fn(() => ({ data: [] as unknown[], isLoading: false }));

vi.mock('@/hooks/useCustomers', () => ({
  useClientList: () => useClientListMock(),
  useClientDetail: () => useClientDetailMock(),
  useClientContracts: () => useClientContractsMock(),
}));

vi.mock('@/hooks/useTaskCategories', () => ({
  useTaskCategories: () => ({
    data: [
      { id: 'c1', name: 'Instalación', description: null },
      { id: 'c5', name: 'Otro', description: null },
    ],
  }),
}));

vi.mock('@/hooks/useTaskPriorities', () => ({
  useTaskPriorities: () => ({
    data: [
      { id: 'p2', name: 'Normal', color: '#3b82f6', weight: 2 },
    ],
  }),
}));

const mockNetworkSites: NetworkSite[] = [
  {
    id: 'ns-alpha',
    name: 'Nodo Alpha',
    address: 'Calle Falsa 123',
    city: 'Tigre',
    coordinates: null,
    type: 'nodo',
    status: 'active',
    deviceCount: 5,
    clientCount: 80,
    uplink: '1 Gbps',
    parentSiteId: null,
    description: 'Test node',
    iclassNodeCode: 'ALPHA-01',
  },
  {
    id: 'ns-beta',
    name: 'Nodo Beta',
    address: 'Av. Siempre Viva 742',
    city: 'Pilar',
    coordinates: null,
    type: 'nodo',
    status: 'active',
    deviceCount: 3,
    clientCount: 40,
    uplink: '500 Mbps',
    parentSiteId: null,
    description: 'Test node 2',
    iclassNodeCode: null,
  },
];

vi.mock('@/hooks/useNetworkSites', () => ({
  useNetworkSites: () => ({ data: mockNetworkSites, isLoading: false }),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { CreateTaskModal } from '@/pages/scheduling/SchedulingTasksPage/components/CreateTaskModal';
import type { Project } from '@/types/project';
import type { Workflow } from '@/types/workflow';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const workflows: Workflow[] = [
  {
    id: 'wf-1',
    name: 'Default',
    description: null,
    createdAt: '',
    updatedAt: '',
    stages: [
      { id: 'stage-new', workflowId: 'wf-1', name: 'Nuevo', category: 'nuevo', order: 0 },
      { id: 'stage-done', workflowId: 'wf-1', name: 'Hecho', category: 'hecho', order: 2 },
    ],
  },
];

const projects: Project[] = [
  {
    id: 'proj-1',
    title: 'Instalaciones',
    description: null,
    workflowId: 'wf-1',
    createdAt: '',
    updatedAt: '',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function setup() {
  const onClose = vi.fn();
  const onCreate = vi.fn().mockResolvedValue(undefined);
  const result = render(
    <CreateTaskModal
      projects={projects}
      workflows={workflows}
      onClose={onClose}
      onCreate={onCreate}
      loading={false}
    />,
  );
  return { onClose, onCreate, ...result };
}

/** Activate network mode via the toggle */
function switchToNetworkMode() {
  fireEvent.click(screen.getByRole('button', { name: /nodo|red/i }));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CreateTaskModal — network mode toggle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders a toggle to switch between customer and network modes', () => {
    setup();
    // The toggle must have two options: one for customer mode, one for network/nodo
    expect(screen.getByRole('button', { name: /cliente/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /nodo|red/i })).toBeInTheDocument();
  });

  it('starts in customer mode — CustomerPicker is visible', () => {
    setup();
    // CustomerPicker renders the search input
    expect(screen.getByPlaceholderText(/buscar cliente/i)).toBeInTheDocument();
  });

  it('switches to network mode — CustomerPicker disappears, NodeSelector appears', () => {
    setup();
    switchToNetworkMode();
    expect(screen.queryByPlaceholderText(/buscar cliente/i)).not.toBeInTheDocument();
    // NodeSelector search input
    expect(screen.getByPlaceholderText(/buscar nodo/i)).toBeInTheDocument();
  });

  it('hides the contract select in network mode', () => {
    setup();
    switchToNetworkMode();
    expect(screen.queryByRole('combobox', { name: /contrato/i })).not.toBeInTheDocument();
  });

  it('switching back to customer mode restores CustomerPicker', () => {
    setup();
    switchToNetworkMode();
    // Switch back to customer mode
    fireEvent.click(screen.getByRole('button', { name: /cliente/i }));
    expect(screen.getByPlaceholderText(/buscar cliente/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/buscar nodo/i)).not.toBeInTheDocument();
  });
});

describe('CreateTaskModal — network mode canSave', () => {
  beforeEach(() => vi.clearAllMocks());

  it('disables Crear tarea in network mode when no node is selected', () => {
    setup();
    switchToNetworkMode();
    fireEvent.change(screen.getByPlaceholderText('Título de la tarea'), { target: { value: 'Nodo task' } });
    fireEvent.change(screen.getByRole('combobox', { name: /proyecto/i }), { target: { value: 'proj-1' } });
    fireEvent.change(screen.getByPlaceholderText('Detalles de la tarea…'), { target: { value: 'desc' } });
    // No node selected yet
    expect(screen.getByRole('button', { name: /crear tarea/i })).toBeDisabled();
  });

  it('enables Crear tarea in network mode when title + project + description + node are all filled', async () => {
    setup();
    switchToNetworkMode();
    fireEvent.change(screen.getByPlaceholderText('Título de la tarea'), { target: { value: 'Nodo task' } });
    fireEvent.change(screen.getByRole('combobox', { name: /proyecto/i }), { target: { value: 'proj-1' } });
    fireEvent.change(screen.getByPlaceholderText('Detalles de la tarea…'), { target: { value: 'desc' } });
    // Select a node
    fireEvent.click(screen.getByRole('option', { name: /Nodo Alpha/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /crear tarea/i })).toBeEnabled(),
    );
  });
});

describe('CreateTaskModal — network mode payload', () => {
  beforeEach(() => vi.clearAllMocks());

  it('submits kind:network payload with networkSiteId and no customerId/contractId', async () => {
    const { onCreate } = setup();
    switchToNetworkMode();
    fireEvent.change(screen.getByPlaceholderText('Título de la tarea'), { target: { value: 'RED task' } });
    fireEvent.change(screen.getByRole('combobox', { name: /proyecto/i }), { target: { value: 'proj-1' } });
    fireEvent.change(screen.getByPlaceholderText('Detalles de la tarea…'), { target: { value: 'instalar antena' } });
    // Select node
    fireEvent.click(screen.getByRole('option', { name: /Nodo Alpha/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /crear tarea/i })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: /crear tarea/i }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    const payload = onCreate.mock.calls[0][0];
    expect(payload.kind).toBe('network');
    expect(payload.networkSiteId).toBe('ns-alpha');
    expect(payload.customerId).toBeNull();
    expect(payload.contractId).toBeNull();
  });

  it('customer mode still submits kind:customer payload', async () => {
    const customer = { id: 'c-net', name: 'NET CUSTOMER', email: 'net@test.com' };
    useClientListMock.mockReturnValue({
      data: { data: [customer], total: 1, page: 1, pageSize: 20, totalPages: 1 },
      isFetching: false,
    });
    useClientDetailMock.mockReturnValue({ data: { id: 'c-net', name: 'NET CUSTOMER', address: 'Calle Test 1' } });
    useClientContractsMock.mockReturnValue({
      data: [{ id: 5, plan: 'Plan 100', type: 'internet', status: 'active', price: 2000, startDate: '2024-01-01', endDate: null, ipAddress: null, description: '', address: null }],
      isLoading: false,
    });
    const { onCreate } = setup();
    // Stay in customer mode (default)
    fireEvent.change(screen.getByPlaceholderText('Título de la tarea'), { target: { value: 'Customer task' } });
    fireEvent.change(screen.getByPlaceholderText(/buscar cliente/i), { target: { value: 'Net' } });
    fireEvent.click(await screen.findByText('NET CUSTOMER'));
    const contractSelect = await screen.findByRole('combobox', { name: /contrato/i });
    fireEvent.change(contractSelect, { target: { value: '5' } });
    fireEvent.change(screen.getByRole('combobox', { name: /proyecto/i }), { target: { value: 'proj-1' } });
    fireEvent.change(screen.getByPlaceholderText('Detalles de la tarea…'), { target: { value: 'desc' } });
    fireEvent.click(screen.getByRole('button', { name: /crear tarea/i }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    const payload = onCreate.mock.calls[0][0];
    expect(payload.kind).toBe('customer');
    expect(payload.networkSiteId).toBeUndefined();
    expect(payload.customerId).toBe('c-net');
    expect(payload.contractId).toBe('5');
  });
});
