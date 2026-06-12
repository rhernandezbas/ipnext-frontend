/**
 * CreateTaskModal — customer-context tests (#40b fix-a)
 *
 * The RED mode toggle (#29) is SUPERSEDED: node tasks are created ONLY from the
 * Tareas Nodos page (modal locked via defaultMode='network'). In customer
 * context (no defaultMode) the modal must be customer-ONLY:
 *   - the Cliente/Nodo RED toggle is GONE
 *   - there is NO path to network mode (NodeSelector never reachable)
 *   - the customer payload (kind:'customer') is unchanged
 *
 * The defaultMode='network' lock behaviour lives in CreateTaskModalNetworkMode.test.tsx.
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
    uispSiteId: null,
  },
];

vi.mock('@/hooks/useNetworkSites', () => ({
  useNetworkSites: () => ({ data: mockNetworkSites, isLoading: false }),
}));

vi.mock('@/hooks/useIClassNodes', () => ({
  useIClassNodes: () => ({
    data: [
      { id: 'n1', nodeId: 1, code: 'Tigre', description: 'Tigre node', active: true, selectable: true, lastSyncedAt: null },
      { id: 'n2', nodeId: 2, code: 'Rosario', description: 'Rosario node', active: true, selectable: true, lastSyncedAt: null },
    ],
  }),
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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CreateTaskModal — customer context has no network toggle (#40b fix-a)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does NOT render the Cliente/Nodo RED mode toggle', () => {
    setup();
    // The segmented control (role=group, aria-label "Tipo de tarea") must be gone.
    expect(screen.queryByRole('group', { name: /tipo de tarea/i })).not.toBeInTheDocument();
    // And neither toggle button exists (the "Nodo RED" toggle in particular).
    expect(screen.queryByRole('button', { name: /^nodo red$/i })).not.toBeInTheDocument();
  });

  it('does NOT render the static "Nodo RED" badge either (customer context, not locked)', () => {
    setup();
    expect(screen.queryByLabelText(/tipo de tarea: nodo red/i)).not.toBeInTheDocument();
  });

  it('shows the CustomerPicker — customer mode is the only mode', () => {
    setup();
    expect(screen.getByPlaceholderText(/buscar cliente/i)).toBeInTheDocument();
  });

  it('never exposes the NodeSelector (no path to network mode)', () => {
    setup();
    // NodeSelector search input must never be reachable in customer context.
    expect(screen.queryByPlaceholderText(/buscar nodo/i)).not.toBeInTheDocument();
  });
});

describe('CreateTaskModal — customer payload unchanged (#40b fix-a)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('submits kind:customer payload with customerId/contractId and no networkSiteId', async () => {
    const customer = { id: 'c-net', name: 'NET CUSTOMER', email: 'net@test.com' };
    useClientListMock.mockReturnValue({
      data: { data: [customer], total: 1, page: 1, pageSize: 20, totalPages: 1 },
      isFetching: false,
    });
    useClientDetailMock.mockReturnValue({ data: { id: 'c-net', name: 'NET CUSTOMER', address: 'Calle Test 1' } });
    useClientContractsMock.mockReturnValue({
      data: [{ id: '5', plan: 'Plan 100', type: 'internet', status: 'active', price: 2000, startDate: '2024-01-01', endDate: null, description: '', address: null }],
      isLoading: false,
    });
    const { onCreate } = setup();
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
