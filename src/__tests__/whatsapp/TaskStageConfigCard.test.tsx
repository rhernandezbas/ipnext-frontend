/**
 * TaskStageConfigCard tests — bulk-task-recipients FE (D8, Parte A): tarjeta
 * de configuración del mapeo Stage→elegible-como-destinatario-de-tarea, en
 * Ajustes → WhatsApp. Molde `NocBroadcastCard.test.tsx`.
 *
 * Contrato BE:
 *   GET  /api/messaging/config/task-stages → { stages: MappedStageDto[] } (messaging.read)
 *   PUT  /api/messaging/config/task-stages → body { stageIds } → { stages } (messaging.manage)
 *   Catálogo de estados: `useWorkflows()` (gate FE scheduling.read).
 *
 * Covers (4 ramas + guardado):
 *  1. Sin scheduling.read → hint accionable, NO fetchea el catálogo, sin checkboxes
 *  2. Cargando (workflows o config todavía resolviendo)
 *  3. Catálogo de workflows vacío (sin stages en ningún workflow) → hint
 *  4. Cargado: checklist agrupado por workflow, mapeo actual tildado
 *  5. Guardar (agregar, SIN reducir) → PUT directo, sin confirm
 *  6. Guardar (reduciendo el set) → pide confirm; cancelar NO llama al PUT
 *  7. Guardar (reduciendo) confirmado → llama al PUT con el set reducido
 *  8. Guardado exitoso → banner de éxito
 *  9. Guardado 403 → mensaje legible (403-view)
 * 10. Sin messaging.manage → checklist de solo lectura, Guardar deshabilitado
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/hooks/useWorkflows', () => ({
  useWorkflows: vi.fn(),
}));
vi.mock('@/hooks/useTaskStageConfig', () => ({
  useTaskStageConfig: vi.fn(),
  useUpdateTaskStageConfig: vi.fn(),
}));
vi.mock('@/hooks/useMyPermissions');

import { useWorkflows } from '@/hooks/useWorkflows';
import { useTaskStageConfig, useUpdateTaskStageConfig } from '@/hooks/useTaskStageConfig';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { useConfirm } from '@/context/ConfirmContext';
import type { UseMyPermissionsResult } from '@/hooks/useMyPermissions';
import type { Workflow } from '@/types/workflow';
import type { MappedStageDto, TaskStageConfigOutput } from '@/types/taskStageConfig';
import { TaskStageConfigCard } from '@/components/settings/TaskStageConfigCard';

const WORKFLOWS: Workflow[] = [
  {
    id: 'wf1',
    name: 'Instalaciones',
    description: null,
    stages: [
      { id: 's1', workflowId: 'wf1', name: 'Pendiente', code: 'PEND', category: 'nuevo', order: 1, color: '#111111' },
      { id: 's2', workflowId: 'wf1', name: 'En proceso', code: 'PROC', category: 'nuevo', order: 2, color: '#222222' },
    ],
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'wf2',
    name: 'Reclamos',
    description: null,
    stages: [
      { id: 's3', workflowId: 'wf2', name: 'Abierto', code: 'ABIERTO', category: 'nuevo', order: 1, color: '#333333' },
    ],
    createdAt: '',
    updatedAt: '',
  },
];

const MAPPED: MappedStageDto[] = [
  { stageId: 's1', stageName: 'Pendiente', stageCode: 'PEND', color: '#111111', workflowId: 'wf1', workflowName: 'Instalaciones' },
  { stageId: 's3', stageName: 'Abierto', stageCode: 'ABIERTO', color: '#333333', workflowId: 'wf2', workflowName: 'Reclamos' },
];

/**
 * Matcher por función para texto partido entre tags (ej. `<strong>` en medio
 * de una oración) — molde recomendado de testing-library: matchea el
 * elemento MÁS PROFUNDO cuyo `textContent` cubre el regex completo (ninguno
 * de sus hijos directos lo cubre solo).
 */
function hasSplitText(re: RegExp) {
  const matches = (node: Element | null) => re.test(node?.textContent ?? '');
  return (_content: string, element: Element | null) =>
    matches(element) && Array.from(element?.children ?? []).every((child) => !matches(child));
}

function baseConfig(over: Partial<TaskStageConfigOutput> = {}): TaskStageConfigOutput {
  return { stages: MAPPED, ...over };
}

function mockPerms(permissions: string[]) {
  vi.mocked(useMyPermissions).mockReturnValue({
    user: null,
    roles: [],
    permissions,
    isLoading: false,
    isError: false,
    can: (p: string | string[], mode: 'any' | 'all' = 'any') => {
      const perms = Array.isArray(p) ? p : [p];
      return mode === 'all' ? perms.every((x) => permissions.includes(x)) : perms.some((x) => permissions.includes(x));
    },
  } as UseMyPermissionsResult);
}

function setup({
  permissions = ['scheduling.read', 'messaging.read', 'messaging.manage'],
  workflows = WORKFLOWS,
  workflowsLoading = false,
  config = baseConfig(),
  configLoading = false,
  updatePending = false,
  updateSuccess = false,
  updateError = null as unknown,
}: {
  permissions?: string[];
  workflows?: Workflow[];
  workflowsLoading?: boolean;
  config?: TaskStageConfigOutput;
  configLoading?: boolean;
  updatePending?: boolean;
  updateSuccess?: boolean;
  updateError?: unknown;
} = {}) {
  mockPerms(permissions);

  vi.mocked(useWorkflows).mockReturnValue({
    data: workflowsLoading ? undefined : workflows,
    isLoading: workflowsLoading,
    isError: false,
  } as unknown as ReturnType<typeof useWorkflows>);

  vi.mocked(useTaskStageConfig).mockReturnValue({
    data: configLoading ? undefined : config,
    isLoading: configLoading,
    isError: false,
  } as unknown as ReturnType<typeof useTaskStageConfig>);

  const updateMutate = vi.fn();
  const updateReset = vi.fn();
  vi.mocked(useUpdateTaskStageConfig).mockReturnValue({
    mutate: updateMutate,
    isPending: updatePending,
    isSuccess: updateSuccess,
    isError: updateError != null,
    error: updateError,
    reset: updateReset,
  } as unknown as ReturnType<typeof useUpdateTaskStageConfig>);

  return { updateMutate, updateReset };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: auto-confirma (setup.ts global mock) — los tests de "cancelar"
  // sobreescriben con `.mockResolvedValue(false)`.
  vi.mocked(useConfirm).mockReturnValue(vi.fn().mockResolvedValue(true));
});

describe('TaskStageConfigCard — rama: sin scheduling.read', () => {
  it('muestra un hint accionable (NO un 403 opaco) y no monta checkboxes', () => {
    setup({ permissions: ['messaging.read', 'messaging.manage'] });
    render(<TaskStageConfigCard />);

    expect(screen.getByText(/necesit[aá]s permiso.*scheduling/i)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('no pide el catálogo de workflows sin el permiso', () => {
    setup({ permissions: ['messaging.read', 'messaging.manage'] });
    render(<TaskStageConfigCard />);
    expect(useWorkflows).toHaveBeenCalledWith(false);
  });
});

describe('TaskStageConfigCard — rama: cargando', () => {
  it('workflows todavía resolviendo → estado de carga', () => {
    setup({ workflowsLoading: true });
    render(<TaskStageConfigCard />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('config todavía resolviendo → estado de carga', () => {
    setup({ configLoading: true });
    render(<TaskStageConfigCard />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });
});

describe('TaskStageConfigCard — rama: catálogo de workflows vacío', () => {
  it('sin workflows (o sin estados en ninguno) → hint, sin checklist', () => {
    setup({ workflows: [] });
    render(<TaskStageConfigCard />);
    expect(screen.getByText(/no hay estados de tarea configurados/i)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});

describe('TaskStageConfigCard — rama: cargado', () => {
  it('agrupa por workflow y tilda el mapeo actual', () => {
    setup();
    render(<TaskStageConfigCard />);

    expect(screen.getByText('Instalaciones')).toBeInTheDocument();
    expect(screen.getByText('Reclamos')).toBeInTheDocument();

    expect(screen.getByRole('checkbox', { name: 'Pendiente' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'En proceso' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Abierto' })).toBeChecked();
  });

  it('Guardar arranca deshabilitado (sin cambios)', () => {
    setup();
    render(<TaskStageConfigCard />);
    expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled();
  });
});

describe('TaskStageConfigCard — guardar sin reducir (solo agregar)', () => {
  it('tildar un estado nuevo y guardar llama al PUT directo, sin confirm', async () => {
    const user = userEvent.setup();
    const { updateMutate } = setup();
    render(<TaskStageConfigCard />);

    await user.click(screen.getByRole('checkbox', { name: 'En proceso' }));
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(updateMutate).toHaveBeenCalledWith({ stageIds: ['s1', 's3', 's2'] });
  });
});

describe('TaskStageConfigCard — guardar reduciendo el set', () => {
  it('destildar un estado mapeado pide confirm; cancelar NO llama al PUT', async () => {
    vi.mocked(useConfirm).mockReturnValue(vi.fn().mockResolvedValue(false));
    const user = userEvent.setup();
    const { updateMutate } = setup();
    render(<TaskStageConfigCard />);

    await user.click(screen.getByRole('checkbox', { name: 'Pendiente' }));
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(vi.mocked(useConfirm).mock.results[0]?.value).toBeDefined());
    expect(updateMutate).not.toHaveBeenCalled();
  });

  it('confirmar sí llama al PUT con el set reducido', async () => {
    const user = userEvent.setup();
    const { updateMutate } = setup();
    render(<TaskStageConfigCard />);

    await user.click(screen.getByRole('checkbox', { name: 'Pendiente' }));
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(updateMutate).toHaveBeenCalledWith({ stageIds: ['s3'] }));
  });
});

describe('TaskStageConfigCard — feedback de guardado', () => {
  it('éxito muestra un banner de confirmación', () => {
    setup({ updateSuccess: true });
    render(<TaskStageConfigCard />);
    expect(screen.getByText(/mapeo guardado/i)).toBeInTheDocument();
  });

  it('403 muestra un mensaje legible (403-view)', () => {
    setup({ updateError: { response: { status: 403, data: { code: 'PERMISSION_DENIED' } } } });
    render(<TaskStageConfigCard />);
    expect(screen.getByText(/no ten[eé]s permiso/i)).toBeInTheDocument();
  });

  it('error genérico muestra un mensaje de reintento', () => {
    setup({ updateError: { response: { status: 500, data: {} } } });
    render(<TaskStageConfigCard />);
    expect(screen.getByText(/no se pudo guardar/i)).toBeInTheDocument();
  });
});

describe('TaskStageConfigCard — fix wave F3: copy explícita "solo tareas ABIERTAS"', () => {
  it('la card aclara que solo tareas ABIERTAS generan destinatarios', () => {
    setup();
    render(<TaskStageConfigCard />);
    // El texto está partido por un <strong>ABIERTAS</strong> — matcher por
    // función (molde recomendado de testing-library para texto ENTRE tags).
    expect(screen.getByText(hasSplitText(/solo.*tareas.*abiertas/i))).toBeInTheDocument();
  });
});

describe('TaskStageConfigCard — sin messaging.manage', () => {
  it('checklist de solo lectura: checkboxes deshabilitados y Guardar deshabilitado', () => {
    setup({ permissions: ['scheduling.read', 'messaging.read'] });
    render(<TaskStageConfigCard />);

    expect(screen.getByRole('checkbox', { name: 'Pendiente' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled();
  });
});
