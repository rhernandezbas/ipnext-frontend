import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/hooks/useProjects', () => ({
  useProjects: vi.fn(),
  useUpdateProject: vi.fn(),
}));
vi.mock('@/hooks/useIClassSoTypes', () => ({
  useIClassSoTypes: vi.fn(),
}));

import { useProjects, useUpdateProject } from '@/hooks/useProjects';
import { useIClassSoTypes } from '@/hooks/useIClassSoTypes';
import { IClassProjectMappingBody } from '@/pages/scheduling/settings/IClassProjectMappingBody';
import type { Project } from '@/types/project';
import type { IClassSoType } from '@/types/iclassSoType';

const makeProject = (over: Partial<Project> = {}): Project => ({
  id: 'p1',
  title: 'INSTALACION FIBRA',
  description: null,
  workflowId: null,
  visible: true,
  createdAt: '',
  updatedAt: '',
  iclassSoTypeId: null,
  iclassSoType: null,
  ...over,
});

const makeType = (over: Partial<IClassSoType> = {}): IClassSoType => ({
  id: 't1',
  code: 'INSTALACION FIBRA',
  description: 'PADRON',
  active: true,
  lastSyncedAt: null,
  createdAt: '',
  updatedAt: '',
  ...over,
});

const idleUpdate = {
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  reset: vi.fn(),
};

function mockData(
  projects: Project[] | null,
  types: IClassSoType[] | null,
  opts: { projLoading?: boolean; typesLoading?: boolean } = {},
) {
  vi.mocked(useProjects).mockReturnValue({
    data: projects ?? undefined,
    isLoading: opts.projLoading ?? false,
    isError: false,
  } as never);
  vi.mocked(useIClassSoTypes).mockReturnValue({
    data: types ?? undefined,
    isLoading: opts.typesLoading ?? false,
    isError: false,
  } as never);
}

describe('IClassProjectMappingBody', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUpdateProject).mockReturnValue(idleUpdate as never);
  });

  it('renders loading state when projects are loading', () => {
    mockData(null, [makeType()], { projLoading: true });
    render(<IClassProjectMappingBody />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('renders loading state when sotypes are loading', () => {
    mockData([makeProject()], null, { typesLoading: true });
    render(<IClassProjectMappingBody />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('blocks the table and shows a CTA when the SO type catalog is empty', () => {
    mockData([makeProject()], []);
    render(<IClassProjectMappingBody />);
    expect(screen.getByText(/no hay tipos de os en el catálogo/i)).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('shows empty state when there are no projects', () => {
    mockData([], [makeType()]);
    render(<IClassProjectMappingBody />);
    expect(screen.getByText(/no hay proyectos para mapear/i)).toBeInTheDocument();
  });

  it('renders a row per project with a dropdown including "(sin mapeo)" and each active sotype', () => {
    const types = [
      makeType({ id: 't1', code: 'INSTALACION FIBRA' }),
      makeType({ id: 't2', code: 'BAJA DE SERVICIO' }),
    ];
    mockData([makeProject({ id: 'p1', title: 'Proyecto A' })], types);
    render(<IClassProjectMappingBody />);

    expect(screen.getByText('Proyecto A')).toBeInTheDocument();
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    const options = Array.from(select.options).map(o => o.textContent);
    expect(options).toContain('(sin mapeo)');
    expect(options).toContain('INSTALACION FIBRA');
    expect(options).toContain('BAJA DE SERVICIO');
  });

  it('preselects the current iclassSoTypeId on the dropdown', () => {
    const types = [makeType({ id: 't2', code: 'BAJA DE SERVICIO' })];
    mockData([makeProject({ iclassSoTypeId: 't2' })], types);
    render(<IClassProjectMappingBody />);

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('t2');
  });

  it('changing the dropdown to a sotype id calls update with that id', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useUpdateProject).mockReturnValue({ ...idleUpdate, mutateAsync } as never);
    mockData([makeProject({ id: 'p1' })], [makeType({ id: 't1' }), makeType({ id: 't2', code: 'BAJA' })]);

    render(<IClassProjectMappingBody />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 't2' } });

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ id: 'p1', data: { iclassSoTypeId: 't2' } });
    });
  });

  it('changing the dropdown to "(sin mapeo)" calls update with null', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useUpdateProject).mockReturnValue({ ...idleUpdate, mutateAsync } as never);
    mockData([makeProject({ id: 'p1', iclassSoTypeId: 't1' })], [makeType({ id: 't1' })]);

    render(<IClassProjectMappingBody />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } });

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ id: 'p1', data: { iclassSoTypeId: null } });
    });
  });

  it('shows a saving indicator on the row while the mutation is in flight', async () => {
    let resolveUpdate!: (v: unknown) => void;
    const mutateAsync = vi.fn(() => new Promise(res => { resolveUpdate = res; }));
    vi.mocked(useUpdateProject).mockReturnValue({ ...idleUpdate, mutateAsync } as never);
    mockData([makeProject({ id: 'p1' })], [makeType({ id: 't1' })]);

    render(<IClassProjectMappingBody />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 't1' } });

    await waitFor(() => expect(screen.getByLabelText(/guardando/i)).toBeInTheDocument());
    resolveUpdate({});
  });

  it('shows an error indicator on the row when the mutation fails', async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new Error('boom'));
    vi.mocked(useUpdateProject).mockReturnValue({ ...idleUpdate, mutateAsync } as never);
    mockData([makeProject({ id: 'p1' })], [makeType({ id: 't1' })]);

    render(<IClassProjectMappingBody />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 't1' } });

    await waitFor(() => expect(screen.getByLabelText(/error/i)).toBeInTheDocument());
  });

  it('filter "Solo mapeados" hides projects without iclassSoTypeId', () => {
    mockData(
      [
        makeProject({ id: 'p1', title: 'Mapeado',   iclassSoTypeId: 't1' }),
        makeProject({ id: 'p2', title: 'SinMapear', iclassSoTypeId: null }),
      ],
      [makeType({ id: 't1' })],
    );

    render(<IClassProjectMappingBody />);
    fireEvent.click(screen.getByLabelText(/solo mapeados/i));

    expect(screen.getByText('Mapeado')).toBeInTheDocument();
    expect(screen.queryByText('SinMapear')).not.toBeInTheDocument();
  });

  it('filter "Solo sin mapear" hides projects with iclassSoTypeId', () => {
    mockData(
      [
        makeProject({ id: 'p1', title: 'Mapeado',   iclassSoTypeId: 't1' }),
        makeProject({ id: 'p2', title: 'SinMapear', iclassSoTypeId: null }),
      ],
      [makeType({ id: 't1' })],
    );

    render(<IClassProjectMappingBody />);
    fireEvent.click(screen.getByLabelText(/solo sin mapear/i));

    expect(screen.queryByText('Mapeado')).not.toBeInTheDocument();
    expect(screen.getByText('SinMapear')).toBeInTheDocument();
  });
});
