import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/hooks/useIClassResultCodes', () => ({
  useIClassResultCodes: vi.fn(),
  useSyncIClassResultCodes: vi.fn(),
  useAssignResultCodeStage: vi.fn(),
}));
vi.mock('@/hooks/useWorkflows', () => ({ useWorkflows: vi.fn() }));

import {
  useIClassResultCodes,
  useSyncIClassResultCodes,
  useAssignResultCodeStage,
} from '@/hooks/useIClassResultCodes';
import { useWorkflows } from '@/hooks/useWorkflows';
import { IClassResultCodeMappingBody } from '@/pages/scheduling/settings/IClassResultCodeMappingBody';

const idle = { mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue({}), isPending: false, isError: false, reset: vi.fn() };

const WORKFLOWS = [
  { id: 'wf1', name: 'Default', description: null, createdAt: '', updatedAt: '', stages: [
    { id: 'st-inst', workflowId: 'wf1', name: 'Instalado', category: 'hecho', order: 8 },
    { id: 'st-nf', workflowId: 'wf1', name: 'No Factible', category: 'nuevo', order: 3 },
  ] },
];

function codes(list: Array<{ id: string; code: string; type: string; mappedStageId: string | null }>) {
  return list.map(c => ({ ...c, soTypeId: '1', mappedStageName: null, lastSyncedAt: '2026-05-29T00:00:00Z' }));
}

function mockData(list: ReturnType<typeof codes>, loading = false) {
  vi.mocked(useIClassResultCodes).mockReturnValue({ data: loading ? undefined : list, isLoading: loading } as never);
  vi.mocked(useWorkflows).mockReturnValue({ data: WORKFLOWS, isLoading: false } as never);
}

describe('IClassResultCodeMappingBody', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSyncIClassResultCodes).mockReturnValue(idle as never);
    vi.mocked(useAssignResultCodeStage).mockReturnValue(idle as never);
  });

  it('renders a row per result code with its outcome type', () => {
    mockData(codes([
      { id: 'r1', code: 'Instalacion Completa Fibra', type: 'Sucesso', mappedStageId: null },
      { id: 'r2', code: 'Cliente Ausente', type: 'Pendente', mappedStageId: null },
    ]));
    render(<IClassResultCodeMappingBody />);
    expect(screen.getByText('Instalacion Completa Fibra')).toBeInTheDocument();
    expect(screen.getByText('Sucesso')).toBeInTheDocument();
    expect(screen.getByText('Cliente Ausente')).toBeInTheDocument();
  });

  it('lists workflow stages grouped as options in the select', () => {
    mockData(codes([{ id: 'r1', code: 'OK', type: 'Sucesso', mappedStageId: null }]));
    render(<IClassResultCodeMappingBody />);
    const select = screen.getByRole('combobox', { name: /estado destino para ok/i });
    expect(select).toHaveValue('');
    expect(screen.getByRole('option', { name: 'Instalado' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'No Factible' })).toBeInTheDocument();
  });

  it('changing the select assigns the stage (auto-save)', () => {
    mockData(codes([{ id: 'r1', code: 'OK', type: 'Sucesso', mappedStageId: null }]));
    const mutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useAssignResultCodeStage).mockReturnValue({ ...idle, mutateAsync } as never);

    render(<IClassResultCodeMappingBody />);
    fireEvent.change(screen.getByRole('combobox', { name: /estado destino para ok/i }), { target: { value: 'st-inst' } });

    expect(mutateAsync).toHaveBeenCalledWith({ id: 'r1', stageId: 'st-inst' });
  });

  it('clearing the select assigns null (no move)', () => {
    mockData(codes([{ id: 'r1', code: 'OK', type: 'Sucesso', mappedStageId: 'st-inst' }]));
    const mutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useAssignResultCodeStage).mockReturnValue({ ...idle, mutateAsync } as never);

    render(<IClassResultCodeMappingBody />);
    fireEvent.change(screen.getByRole('combobox', { name: /estado destino para ok/i }), { target: { value: '' } });

    expect(mutateAsync).toHaveBeenCalledWith({ id: 'r1', stageId: null });
  });

  it('filters to mapped only', () => {
    mockData(codes([
      { id: 'r1', code: 'Mapeado', type: 'Sucesso', mappedStageId: 'st-inst' },
      { id: 'r2', code: 'SinMapear', type: 'Falha', mappedStageId: null },
    ]));
    render(<IClassResultCodeMappingBody />);
    fireEvent.click(screen.getByRole('radio', { name: /solo mapeados/i }));
    expect(screen.getByText('Mapeado')).toBeInTheDocument();
    expect(screen.queryByText('SinMapear')).not.toBeInTheDocument();
  });

  it('shows the empty state with a sync CTA when there are no result codes', () => {
    mockData(codes([]));
    render(<IClassResultCodeMappingBody />);
    expect(screen.getByText(/sin resultados sincronizados/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sincronizar resultados/i })).toBeInTheDocument();
  });

  it('triggers a sync when the button is clicked', () => {
    mockData(codes([{ id: 'r1', code: 'OK', type: 'Sucesso', mappedStageId: null }]));
    const mutateAsync = vi.fn().mockResolvedValue({ synced: 1, created: 1, updated: 0 });
    vi.mocked(useSyncIClassResultCodes).mockReturnValue({ ...idle, mutateAsync } as never);

    render(<IClassResultCodeMappingBody />);
    fireEvent.click(screen.getByRole('button', { name: /sincronizar resultados/i }));

    expect(mutateAsync).toHaveBeenCalled();
  });
});
