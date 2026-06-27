/**
 * CreateTaskModal — FO node dropdown (#fo-nodo-dropdown)
 *
 * When Tipo de red = FO, "Nombre del nodo" must be a <select> with the 3
 * temporary hardcoded options (FO_NODES_TEMP). Free-text input is gone.
 * When Tipo de red = Red (default), the field is NOT a select of these 3 options
 * (NodeSelector still works as before).
 *
 * Covered:
 *   TC-FO-1: FO mode shows a <select> with "Seleccioná el nodo" placeholder +
 *             the 3 FO options (Mercedes, Estudiantes, Chivilcoy).
 *   TC-FO-2: Selecting a node from the dropdown updates the select value.
 *   TC-FO-3: Submit payload carries the selected node as networkSiteName.
 *   TC-FO-4: Red mode (default) does NOT show the FO node dropdown.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { NetworkSite } from '@/types/networkSite';
import type { IClassNode } from '@/types/iclassNode';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/hooks/useCustomers', () => ({
  useClientList: () => ({ data: { data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 }, isFetching: false }),
  useClientDetail: () => ({ data: undefined }),
  useClientContracts: () => ({ data: [], isLoading: false }),
}));

vi.mock('@/hooks/useTaskCategories', () => ({
  useTaskCategories: () => ({ data: [{ id: 'c5', name: 'Otro', description: null }] }),
}));

vi.mock('@/hooks/useTaskPriorities', () => ({
  useTaskPriorities: () => ({ data: [{ id: 'p2', name: 'Normal', color: '#3b82f6', weight: 2 }] }),
}));

const mockSite: NetworkSite = {
  id: 'site-1',
  name: 'POP Centro',
  address: 'Calle Test 1',
  city: 'Springfield',
  coordinates: null,
  type: 'pop',
  status: 'active',
  deviceCount: 0,
  clientCount: 0,
  uplink: '',
  parentSiteId: null,
  description: '',
  iclassNodeCode: null,
  siteNumber: 1,
  fixedCode: 'NODO-1',
  uispSiteId: null,
};

vi.mock('@/hooks/useNetworkSites', () => ({
  useNetworkSites: () => ({ data: [mockSite], isLoading: false }),
}));

const iclassNodes: IClassNode[] = [
  { id: 'n1', nodeId: 1, code: 'Springfield', description: 'Springfield node', active: true, selectable: true, lastSyncedAt: null },
];

vi.mock('@/hooks/useIClassNodes', () => ({
  useIClassNodes: () => ({ data: iclassNodes }),
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
      { id: 'stage-new', workflowId: 'wf-1', name: 'Nuevo', category: 'nuevo', code: 'nuevo', order: 0 },
    ],
  },
];

const networkProjects: Project[] = [
  {
    id: 'np-1',
    title: 'RED - FIBRA',
    description: null,
    workflowId: 'wf-1',
    isNetworkProject: true,
    createdAt: '',
    updatedAt: '',
  },
];

const onClose = vi.fn();
const onCreate = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  onCreate.mockResolvedValue(undefined);
});

function setupNetworkModal() {
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

// ── TC-FO-1: FO mode shows dropdown with 3 options ───────────────────────────

describe('CreateTaskModal — FO node dropdown (TC-FO-1)', () => {
  it('shows a <select> with placeholder + 3 FO options when switched to FO mode', () => {
    setupNetworkModal();
    fireEvent.click(screen.getByRole('button', { name: /^FO$/i }));

    const nodeSelect = screen.getByRole('combobox', { name: /nombre del nodo/i });
    expect(nodeSelect).toBeInTheDocument();

    // Placeholder option
    expect(screen.getByRole('option', { name: 'Seleccioná el nodo' })).toBeInTheDocument();

    // The 3 temporary options
    expect(screen.getByRole('option', { name: 'Mercedes' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Estudiantes' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Chivilcoy' })).toBeInTheDocument();
  });

  it('starts with empty value (placeholder selected) in FO mode', () => {
    setupNetworkModal();
    fireEvent.click(screen.getByRole('button', { name: /^FO$/i }));

    const nodeSelect = screen.getByRole('combobox', { name: /nombre del nodo/i });
    expect(nodeSelect).toHaveValue('');
  });
});

// ── TC-FO-2: Selecting a node updates the select value ───────────────────────

describe('CreateTaskModal — FO dropdown selection (TC-FO-2)', () => {
  it('updates the select value when a node is chosen', () => {
    setupNetworkModal();
    fireEvent.click(screen.getByRole('button', { name: /^FO$/i }));

    const nodeSelect = screen.getByRole('combobox', { name: /nombre del nodo/i });
    fireEvent.change(nodeSelect, { target: { value: 'Estudiantes' } });
    expect(nodeSelect).toHaveValue('Estudiantes');
  });

  it('can select each of the 3 FO node options', () => {
    const { unmount } = setupNetworkModal();
    fireEvent.click(screen.getByRole('button', { name: /^FO$/i }));
    const nodeSelect = screen.getByRole('combobox', { name: /nombre del nodo/i });

    for (const node of ['Mercedes', 'Estudiantes', 'Chivilcoy'] as const) {
      fireEvent.change(nodeSelect, { target: { value: node } });
      expect(nodeSelect).toHaveValue(node);
    }
    unmount();
  });
});

// ── TC-FO-3: Submit sends the selected node name as networkSiteName ───────────

describe('CreateTaskModal — FO dropdown submit payload (TC-FO-3)', () => {
  it('includes the selected FO node as networkSiteName in the payload', async () => {
    setupNetworkModal();
    fireEvent.click(screen.getByRole('button', { name: /^FO$/i }));

    fireEvent.change(screen.getByPlaceholderText('Título de la tarea'), { target: { value: 'Tarea FO' } });
    fireEvent.change(screen.getByPlaceholderText('Detalles de la tarea…'), { target: { value: 'Descripción' } });
    fireEvent.change(screen.getByRole('combobox', { name: /proyecto/i }), { target: { value: 'np-1' } });
    fireEvent.change(screen.getByRole('combobox', { name: /nombre del nodo/i }), { target: { value: 'Chivilcoy' } });
    fireEvent.change(screen.getByPlaceholderText('Dirección del trabajo'), { target: { value: 'Calle 1' } });
    fireEvent.change(screen.getByRole('combobox', { name: /localidad/i }), { target: { value: 'Springfield' } });

    const submit = screen.getByRole('button', { name: /crear tarea/i });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'network',
        networkType: 'fibra',
        networkSiteId: null,
        networkSiteName: 'Chivilcoy',
      }),
    );
  });

  it('disables submit when no FO node is selected (placeholder = empty value)', () => {
    setupNetworkModal();
    fireEvent.click(screen.getByRole('button', { name: /^FO$/i }));

    fireEvent.change(screen.getByPlaceholderText('Título de la tarea'), { target: { value: 'Tarea FO' } });
    fireEvent.change(screen.getByPlaceholderText('Detalles de la tarea…'), { target: { value: 'Descripción' } });
    fireEvent.change(screen.getByRole('combobox', { name: /proyecto/i }), { target: { value: 'np-1' } });
    // Intentionally leave node select at placeholder (value="")
    fireEvent.change(screen.getByPlaceholderText('Dirección del trabajo'), { target: { value: 'Calle 1' } });
    fireEvent.change(screen.getByRole('combobox', { name: /localidad/i }), { target: { value: 'Springfield' } });

    const submit = screen.getByRole('button', { name: /crear tarea/i });
    expect(submit).toBeDisabled();
  });
});

// ── TC-FO-4: Red mode does NOT show the FO node dropdown ─────────────────────

describe('CreateTaskModal — Red mode unchanged (TC-FO-4)', () => {
  it('does NOT show the FO node dropdown in Red mode (default)', () => {
    setupNetworkModal();
    // Default is Red — the FO "Nombre del nodo" select must not be present
    expect(screen.queryByRole('combobox', { name: /nombre del nodo/i })).not.toBeInTheDocument();
    // NodeSelector (listbox) IS shown in Red mode
    expect(screen.getByRole('listbox', { name: /nodos de red/i })).toBeInTheDocument();
  });

  it('switching back from FO to Red removes the FO dropdown and restores NodeSelector', () => {
    setupNetworkModal();
    // Switch to FO
    fireEvent.click(screen.getByRole('button', { name: /^FO$/i }));
    expect(screen.getByRole('combobox', { name: /nombre del nodo/i })).toBeInTheDocument();
    expect(screen.queryByRole('listbox', { name: /nodos de red/i })).not.toBeInTheDocument();

    // Switch back to Red
    fireEvent.click(screen.getByRole('button', { name: /^Red$/i }));
    expect(screen.queryByRole('combobox', { name: /nombre del nodo/i })).not.toBeInTheDocument();
    expect(screen.getByRole('listbox', { name: /nodos de red/i })).toBeInTheDocument();
  });
});
