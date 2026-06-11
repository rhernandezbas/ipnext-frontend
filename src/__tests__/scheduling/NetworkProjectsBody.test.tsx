/**
 * NetworkProjectsBody (#40) — settings sub-tab "Proyectos de red" in
 * SchedulingSettingsPage. Mirror of RetirementProjectsBody but gated by
 * `scheduling.manage` and toggling `isNetworkProject` via PATCH.
 *
 * Covers (FE side of REQ-PROJ-NET-4):
 *  - renders the projects list with a toggle per row
 *  - toggle visible + auto-save PATCH when user has scheduling.manage
 *  - read-only (no toggle) when user lacks scheduling.manage
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
import { NetworkProjectsBody } from '@/pages/scheduling/settings/NetworkProjectsBody';
import type { Project } from '@/types/project';

const makeProject = (over: Partial<Project> = {}): Project => ({
  id: 'p1',
  title: 'RED - FIBRA',
  description: null,
  workflowId: null,
  visible: true,
  isNetworkProject: false,
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

describe('NetworkProjectsBody renders project list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUpdateProject).mockReturnValue(idleUpdate as never);
    mockPerms(() => true);
  });

  it('renders loading state', () => {
    mockData([], { loading: true });
    render(<NetworkProjectsBody />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('renders empty state when no projects', () => {
    mockData([]);
    render(<NetworkProjectsBody />);
    expect(screen.getByText(/sin proyectos/i)).toBeInTheDocument();
  });

  it('renders a row per project with project title', () => {
    mockData([
      makeProject({ id: 'p1', title: 'RED - FIBRA' }),
      makeProject({ id: 'p2', title: 'RED WIRELESS' }),
    ]);
    render(<NetworkProjectsBody />);
    expect(screen.getByText('RED - FIBRA')).toBeInTheDocument();
    expect(screen.getByText('RED WIRELESS')).toBeInTheDocument();
  });

  it('calls useProjects with "all" so hidden projects are listed too', () => {
    mockData([makeProject()]);
    render(<NetworkProjectsBody />);
    expect(useProjects).toHaveBeenCalledWith('all');
  });
});

describe('toggle visible + PATCH auto-save with scheduling.manage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUpdateProject).mockReturnValue(idleUpdate as never);
    mockPerms(() => true);
  });

  it('renders a toggle (checkbox) per row when user has scheduling.manage', () => {
    mockData([makeProject({ id: 'p1', isNetworkProject: false })]);
    render(<NetworkProjectsBody />);
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('toggle starts unchecked when isNetworkProject=false', () => {
    mockData([makeProject({ id: 'p1', isNetworkProject: false })]);
    render(<NetworkProjectsBody />);
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('toggle starts checked when isNetworkProject=true', () => {
    mockData([makeProject({ id: 'p1', isNetworkProject: true })]);
    render(<NetworkProjectsBody />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('clicking toggle calls PATCH with isNetworkProject=true', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useUpdateProject).mockReturnValue({ ...idleUpdate, mutateAsync } as never);
    mockData([makeProject({ id: 'p1', isNetworkProject: false })]);

    render(<NetworkProjectsBody />);
    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ id: 'p1', data: { isNetworkProject: true } });
    });
  });

  it('clicking toggle again calls PATCH with isNetworkProject=false', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useUpdateProject).mockReturnValue({ ...idleUpdate, mutateAsync } as never);
    mockData([makeProject({ id: 'p1', isNetworkProject: true })]);

    render(<NetworkProjectsBody />);
    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ id: 'p1', data: { isNetworkProject: false } });
    });
  });
});

describe('read-only without scheduling.manage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUpdateProject).mockReturnValue(idleUpdate as never);
    mockPerms((p) => {
      const arr = Array.isArray(p) ? p : [p];
      return !arr.includes('scheduling.manage');
    });
  });

  it('does not render toggles (checkboxes) without scheduling.manage', () => {
    mockData([makeProject({ id: 'p1', isNetworkProject: false })]);
    render(<NetworkProjectsBody />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('shows the project title in read-only mode', () => {
    mockData([makeProject({ id: 'p1', title: 'RED - FIBRA', isNetworkProject: true })]);
    render(<NetworkProjectsBody />);
    expect(screen.getByText('RED - FIBRA')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
