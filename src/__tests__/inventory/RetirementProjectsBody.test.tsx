/**
 * SCEN-FE-7/8/9 — RetirementProjectsBody: tab "Proyectos de retiro" in InventorySettingsPage
 *
 * Covers:
 *  SCEN-FE-7: tab renders the projects list with toggle per row
 *  SCEN-FE-8: toggle visible + auto-save PATCH when user has inventory.manage
 *  SCEN-FE-9: read-only (no toggle) when user lacks inventory.manage
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/hooks/useProjects', () => ({
  useProjects: vi.fn(),
  useUpdateProject: vi.fn(),
}));
vi.mock('@/hooks/useMyPermissions', () => ({
  useMyPermissions: vi.fn(),
  useCan: vi.fn(() => false),
}));

import { useProjects, useUpdateProject } from '@/hooks/useProjects';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { RetirementProjectsBody } from '@/pages/inventory/settings/RetirementProjectsBody';
import type { Project } from '@/types/project';

const makeProject = (over: Partial<Project> = {}): Project => ({
  id: 'p1',
  title: 'INSTALACION FIBRA',
  description: null,
  workflowId: null,
  visible: true,
  allowsEquipmentRetirement: false,
  createdAt: '',
  updatedAt: '',
  iclassSoTypeId: null,
  iclassSoType: null,
  ...over,
});

const idleUpdate = {
  mutate: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue({}),
  isPending: false,
  isError: false,
  reset: vi.fn(),
};

function mockData(projects: Project[], opts: { loading?: boolean } = {}) {
  vi.mocked(useProjects).mockReturnValue({
    data: projects,
    isLoading: opts.loading ?? false,
    isError: false,
  } as never);
}

function mockPerms(canFn: (p: string | string[]) => boolean) {
  vi.mocked(useMyPermissions).mockReturnValue({
    user: null, roles: [], permissions: [], isLoading: false, isError: false, can: canFn,
  } as never);
}

describe('SCEN-FE-7: RetirementProjectsBody renders project list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUpdateProject).mockReturnValue(idleUpdate as never);
    mockPerms(() => true);
  });

  it('renders loading state', () => {
    mockData([], { loading: true });
    render(<RetirementProjectsBody />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('renders empty state when no projects', () => {
    mockData([]);
    render(<RetirementProjectsBody />);
    expect(screen.getByText(/sin proyectos/i)).toBeInTheDocument();
  });

  it('renders a row per project with project title', () => {
    mockData([
      makeProject({ id: 'p1', title: 'INSTALACION FIBRA' }),
      makeProject({ id: 'p2', title: 'MANTENIMIENTO' }),
    ]);
    render(<RetirementProjectsBody />);
    expect(screen.getByText('INSTALACION FIBRA')).toBeInTheDocument();
    expect(screen.getByText('MANTENIMIENTO')).toBeInTheDocument();
  });
});

describe('SCEN-FE-8: toggle visible + PATCH auto-save with inventory.manage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUpdateProject).mockReturnValue(idleUpdate as never);
    mockPerms(() => true); // has inventory.manage
  });

  it('renders a toggle (checkbox) per row when user has inventory.manage', () => {
    mockData([makeProject({ id: 'p1', allowsEquipmentRetirement: false })]);
    render(<RetirementProjectsBody />);
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('toggle starts unchecked when allowsEquipmentRetirement=false', () => {
    mockData([makeProject({ id: 'p1', allowsEquipmentRetirement: false })]);
    render(<RetirementProjectsBody />);
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('toggle starts checked when allowsEquipmentRetirement=true', () => {
    mockData([makeProject({ id: 'p1', allowsEquipmentRetirement: true })]);
    render(<RetirementProjectsBody />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('clicking toggle calls PATCH with allowsEquipmentRetirement=true', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useUpdateProject).mockReturnValue({ ...idleUpdate, mutateAsync } as never);
    mockData([makeProject({ id: 'p1', allowsEquipmentRetirement: false })]);

    render(<RetirementProjectsBody />);
    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ id: 'p1', data: { allowsEquipmentRetirement: true } });
    });
  });

  it('clicking toggle again calls PATCH with allowsEquipmentRetirement=false', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useUpdateProject).mockReturnValue({ ...idleUpdate, mutateAsync } as never);
    mockData([makeProject({ id: 'p1', allowsEquipmentRetirement: true })]);

    render(<RetirementProjectsBody />);
    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ id: 'p1', data: { allowsEquipmentRetirement: false } });
    });
  });
});

describe('SCEN-FE-9: read-only without inventory.manage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUpdateProject).mockReturnValue(idleUpdate as never);
    // Deny inventory.manage
    mockPerms((p) => {
      const arr = Array.isArray(p) ? p : [p];
      return !arr.includes('inventory.manage');
    });
  });

  it('does not render toggles (checkboxes) without inventory.manage', () => {
    mockData([makeProject({ id: 'p1', allowsEquipmentRetirement: false })]);
    render(<RetirementProjectsBody />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('shows the project title in read-only mode', () => {
    mockData([makeProject({ id: 'p1', title: 'INSTALACION FIBRA', allowsEquipmentRetirement: true })]);
    render(<RetirementProjectsBody />);
    expect(screen.getByText('INSTALACION FIBRA')).toBeInTheDocument();
    // Still shows the retirement status as text, not interactive checkbox
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
