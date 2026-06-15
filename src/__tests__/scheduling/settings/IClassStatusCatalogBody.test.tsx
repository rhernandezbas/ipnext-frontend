import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mocks BEFORE imports del código bajo test
vi.mock('@/hooks/useIClassStatusCatalog', () => ({
  useIClassStatusCatalog: vi.fn(),
  useSyncIClassStatuses: vi.fn(),
  useUpdateIClassStatus: vi.fn(),
}));

vi.mock('@/hooks/useWorkflows', () => ({
  useWorkflows: vi.fn(),
}));

// NOTE: useMyPermissions is already mocked globally in setup.ts (grants '*').
// Per-suite overrides use vi.mocked(useMyPermissions).mockReturnValue(...) — NO dynamic import.
import { useMyPermissions } from '@/hooks/useMyPermissions';
import {
  useIClassStatusCatalog,
  useSyncIClassStatuses,
  useUpdateIClassStatus,
} from '@/hooks/useIClassStatusCatalog';
import { useWorkflows } from '@/hooks/useWorkflows';
import { IClassStatusCatalogBody } from '@/pages/scheduling/settings/IClassStatusCatalogBody';

const idle = {
  mutate: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue({}),
  isPending: false,
  isError: false,
  reset: vi.fn(),
};

/** Entradas de catálogo de prueba */
const ENTRIES = [
  {
    statusCode: 'INSTALADO',
    iclassLabel: 'Instalado',
    displayLabel: 'Instalación OK',
    effectiveLabel: 'Instalación OK',
    color: '#22c55e',
    tracked: true,
    prominenseStageId: 'stage-done',
    lastSyncedAt: '2026-06-01T00:00:00Z',
  },
  {
    statusCode: 'PENDIENTE',
    iclassLabel: 'Pendiente',
    displayLabel: null,
    effectiveLabel: 'Pendiente',
    color: null,
    tracked: false,
    prominenseStageId: null,
    lastSyncedAt: '2026-06-01T00:00:00Z',
  },
];

/** Workflows de prueba — dos workflows, cada uno con sus propios stages. */
const WORKFLOWS = [
  {
    id: 'wf-instalaciones',
    name: 'Instalaciones',
    description: null,
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
    stages: [
      { id: 'stage-new', workflowId: 'wf-instalaciones', name: 'Nueva', code: 'NEW', category: 'nuevo', order: 0, color: '#3b82f6' },
      { id: 'stage-done', workflowId: 'wf-instalaciones', name: 'Finalizada', code: 'DONE', category: 'hecho', order: 1, color: '#22c55e' },
    ],
  },
  {
    id: 'wf-soporte',
    name: 'Soporte',
    description: null,
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
    stages: [
      { id: 'stage-triage', workflowId: 'wf-soporte', name: 'Triage', code: 'TRIAGE', category: 'nuevo', order: 0, color: '#f59e0b' },
    ],
  },
];

function mockData(entries: typeof ENTRIES | undefined = ENTRIES, loading = false) {
  vi.mocked(useIClassStatusCatalog).mockReturnValue({
    data: loading ? undefined : entries,
    isLoading: loading,
  } as never);
}

function mockWorkflows(workflows: typeof WORKFLOWS | undefined = WORKFLOWS, loading = false) {
  vi.mocked(useWorkflows).mockReturnValue({
    data: loading ? undefined : workflows,
    isLoading: loading,
  } as never);
}

/** Helper: mock con permisos dados. */
function mockPermissions(permissions: string[]) {
  vi.mocked(useMyPermissions).mockReturnValue({
    can: (perms: string | string[], mode: 'any' | 'all' = 'any') => {
      // sentinel '*' short-circuit — same as the real hook
      if (permissions.includes('*')) return true;
      const list = Array.isArray(perms) ? perms : [perms];
      if (mode === 'all') return list.every(p => permissions.includes(p));
      return list.some(p => permissions.includes(p));
    },
    isLoading: false,
    permissions,
    user: null,
    roles: [],
    isError: false,
  } as never);
}

describe('IClassStatusCatalogBody', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSyncIClassStatuses).mockReturnValue(idle as never);
    vi.mocked(useUpdateIClassStatus).mockReturnValue(idle as never);
    mockWorkflows();
    // Restore default permissive mock after clearAllMocks resets it
    mockPermissions(['*']);
  });

  it('renders a row per catalog entry', () => {
    mockData();
    render(<IClassStatusCatalogBody />);
    expect(screen.getByText('INSTALADO')).toBeInTheDocument();
    expect(screen.getByText('Instalado')).toBeInTheDocument();
    expect(screen.getByText('PENDIENTE')).toBeInTheDocument();
  });

  it('shows the displayLabel input prefilled when displayLabel is set', () => {
    mockData();
    render(<IClassStatusCatalogBody />);
    const input = screen.getByRole('textbox', { name: /etiqueta personalizada para INSTALADO/i });
    expect(input).toHaveValue('Instalación OK');
  });

  it('shows the displayLabel input empty (with placeholder) when displayLabel is null', () => {
    mockData();
    render(<IClassStatusCatalogBody />);
    const input = screen.getByRole('textbox', { name: /etiqueta personalizada para PENDIENTE/i });
    expect(input).toHaveValue('');
    expect(input).toHaveAttribute('placeholder', 'Pendiente');
  });

  it('calls useUpdateIClassStatus.mutateAsync with displayLabel on blur', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useUpdateIClassStatus).mockReturnValue({ ...idle, mutateAsync } as never);
    mockData();

    render(<IClassStatusCatalogBody />);
    const input = screen.getByRole('textbox', { name: /etiqueta personalizada para PENDIENTE/i });
    fireEvent.change(input, { target: { value: 'Orden pendiente' } });
    fireEvent.blur(input);

    expect(mutateAsync).toHaveBeenCalledWith({
      statusCode: 'PENDIENTE',
      payload: { displayLabel: 'Orden pendiente' },
    });
  });

  it('calls mutateAsync with null when the displayLabel input is cleared', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useUpdateIClassStatus).mockReturnValue({ ...idle, mutateAsync } as never);
    mockData();

    render(<IClassStatusCatalogBody />);
    const input = screen.getByRole('textbox', { name: /etiqueta personalizada para INSTALADO/i });
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);

    expect(mutateAsync).toHaveBeenCalledWith({
      statusCode: 'INSTALADO',
      payload: { displayLabel: null },
    });
  });

  it('calls mutateAsync with tracked=false when the toggle is unchecked', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useUpdateIClassStatus).mockReturnValue({ ...idle, mutateAsync } as never);
    mockData();

    render(<IClassStatusCatalogBody />);
    const toggle = screen.getByRole('checkbox', { name: /mostrar badge para INSTALADO/i });
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);

    expect(mutateAsync).toHaveBeenCalledWith({
      statusCode: 'INSTALADO',
      payload: { tracked: false },
    });
  });

  it('calls mutateAsync with tracked=true when the toggle is checked', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useUpdateIClassStatus).mockReturnValue({ ...idle, mutateAsync } as never);
    mockData();

    render(<IClassStatusCatalogBody />);
    const toggle = screen.getByRole('checkbox', { name: /mostrar badge para PENDIENTE/i });
    expect(toggle).not.toBeChecked();
    fireEvent.click(toggle);

    expect(mutateAsync).toHaveBeenCalledWith({
      statusCode: 'PENDIENTE',
      payload: { tracked: true },
    });
  });

  it('clicking Sincronizar calls useSyncIClassStatuses.mutateAsync', () => {
    const mutateAsync = vi.fn().mockResolvedValue({ synced: 2, created: 1, updated: 1 });
    vi.mocked(useSyncIClassStatuses).mockReturnValue({ ...idle, mutateAsync } as never);
    mockData();

    render(<IClassStatusCatalogBody />);
    fireEvent.click(screen.getByRole('button', { name: /sincronizar estados/i }));

    expect(mutateAsync).toHaveBeenCalled();
  });

  it('shows success banner after sync with synced count', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ synced: 3, created: 2, updated: 1 });
    vi.mocked(useSyncIClassStatuses).mockReturnValue({ ...idle, mutateAsync } as never);
    mockData();

    render(<IClassStatusCatalogBody />);
    await fireEvent.click(screen.getByRole('button', { name: /sincronizar estados/i }));

    // El banner aparece tras el mutateAsync resolve
    await screen.findByText(/Sincronizados 3 estados/i);
    expect(screen.getByText(/2 nuevos/i)).toBeInTheDocument();
  });

  it('shows empty state when catalog has no entries', () => {
    mockData([]);
    render(<IClassStatusCatalogBody />);
    expect(screen.getByText(/sin estados sincronizados/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sincronizar estados/i })).toBeInTheDocument();
  });

  it('shows loading indicator while fetching', () => {
    mockData(undefined, true);
    render(<IClassStatusCatalogBody />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('shows error banner when sync fails', () => {
    vi.mocked(useSyncIClassStatuses).mockReturnValue({ ...idle, isError: true } as never);
    mockData();
    render(<IClassStatusCatalogBody />);
    expect(screen.getByText(/no se pudieron sincronizar/i)).toBeInTheDocument();
  });

  // ── Prominense stage mapping (selector por fila) ─────────────────────────
  describe('Prominense stage mapping selector', () => {
    it('renders a stage select per row populated from all workflows, grouped by workflow', () => {
      mockData();
      render(<IClassStatusCatalogBody />);

      const select = screen.getByRole('combobox', { name: /stage de prominense para INSTALADO/i }) as HTMLSelectElement;
      expect(select).toBeInTheDocument();

      // Grouped by workflow via optgroups
      const groups = select.querySelectorAll('optgroup');
      const groupLabels = Array.from(groups).map(g => g.label);
      expect(groupLabels).toEqual(expect.arrayContaining(['Instalaciones', 'Soporte']));

      // Stage options from BOTH workflows are present
      expect(screen.getAllByRole('option', { name: /Finalizada/i }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole('option', { name: /Triage/i }).length).toBeGreaterThan(0);
    });

    it('reflects the current prominenseStageId as the selected option', () => {
      mockData();
      render(<IClassStatusCatalogBody />);
      const select = screen.getByRole('combobox', { name: /stage de prominense para INSTALADO/i }) as HTMLSelectElement;
      expect(select.value).toBe('stage-done');
    });

    it('shows the empty "sin mapeo" option selected when prominenseStageId is null', () => {
      mockData();
      render(<IClassStatusCatalogBody />);
      const select = screen.getByRole('combobox', { name: /stage de prominense para PENDIENTE/i }) as HTMLSelectElement;
      expect(select.value).toBe('');
    });

    it('calls mutateAsync with prominenseStageId when a stage is selected', () => {
      const mutateAsync = vi.fn().mockResolvedValue({});
      vi.mocked(useUpdateIClassStatus).mockReturnValue({ ...idle, mutateAsync } as never);
      mockData();

      render(<IClassStatusCatalogBody />);
      const select = screen.getByRole('combobox', { name: /stage de prominense para PENDIENTE/i });
      fireEvent.change(select, { target: { value: 'stage-triage' } });

      expect(mutateAsync).toHaveBeenCalledWith({
        statusCode: 'PENDIENTE',
        payload: { prominenseStageId: 'stage-triage' },
      });
    });

    it('calls mutateAsync with null when the mapping is cleared (empty option)', () => {
      const mutateAsync = vi.fn().mockResolvedValue({});
      vi.mocked(useUpdateIClassStatus).mockReturnValue({ ...idle, mutateAsync } as never);
      mockData();

      render(<IClassStatusCatalogBody />);
      const select = screen.getByRole('combobox', { name: /stage de prominense para INSTALADO/i });
      fireEvent.change(select, { target: { value: '' } });

      expect(mutateAsync).toHaveBeenCalledWith({
        statusCode: 'INSTALADO',
        payload: { prominenseStageId: null },
      });
    });

    it('does NOT fire PATCH when the selected value did not change', () => {
      const mutateAsync = vi.fn().mockResolvedValue({});
      vi.mocked(useUpdateIClassStatus).mockReturnValue({ ...idle, mutateAsync } as never);
      mockData();

      render(<IClassStatusCatalogBody />);
      const select = screen.getByRole('combobox', { name: /stage de prominense para INSTALADO/i });
      // Re-select the already-selected stage
      fireEvent.change(select, { target: { value: 'stage-done' } });

      expect(mutateAsync).not.toHaveBeenCalled();
    });

    it('renders a read-only stage label (no combobox) without iclass.manage', () => {
      mockPermissions(['iclass.read']);
      mockData();
      render(<IClassStatusCatalogBody />);
      expect(screen.queryByRole('combobox', { name: /stage de prominense para INSTALADO/i })).not.toBeInTheDocument();
      // The mapped stage name is still shown read-only
      expect(screen.getByText(/Instalaciones — Finalizada/i)).toBeInTheDocument();
    });

    // ── Orphaned stage — prominenseStageId apunta a un stage inexistente ─────
    // BUG FIX-FIRST: si el value del <select> no matchea ninguna option, el
    // navegador muestra "Sin mapeo" PERO el value real sigue seteado → el
    // operador cree que no hay mapeo cuando sí lo hay (desync silenciosa).
    // El fix: renderizar una option "fantasma" con ese value para que matchee.
    it('renders a ghost option for an orphaned prominenseStageId (not in any workflow)', () => {
      const orphanEntries = [
        {
          statusCode: 'HUERFANO',
          iclassLabel: 'Huérfano',
          displayLabel: null,
          effectiveLabel: 'Huérfano',
          color: null,
          tracked: false,
          // Este stage NO existe en ningún workflow del mock
          prominenseStageId: 'stage-borrado',
          lastSyncedAt: '2026-06-01T00:00:00Z',
        },
      ];
      mockData(orphanEntries as never);
      render(<IClassStatusCatalogBody />);

      const select = screen.getByRole('combobox', { name: /stage de prominense para HUERFANO/i }) as HTMLSelectElement;
      // El value DEBE matchear (no quedar en '') — sino el browser muestra "Sin mapeo" falsamente
      expect(select.value).toBe('stage-borrado');

      // Debe existir una option con ese value (la "fantasma")
      const ghost = Array.from(select.options).find(o => o.value === 'stage-borrado');
      expect(ghost).toBeDefined();
      // Marcada como mapeo roto — NO debe decir "Sin mapeo"
      expect(ghost!.textContent).toMatch(/inexistente|⚠/i);

      // La option "Sin mapeo" (value='') NO debe estar seleccionada
      const sinMapeo = Array.from(select.options).find(o => o.value === '');
      expect(sinMapeo?.selected).toBe(false);
    });

    it('does NOT render a ghost option when prominenseStageId maps to an existing stage', () => {
      mockData(); // INSTALADO → stage-done (existe en wf-instalaciones)
      render(<IClassStatusCatalogBody />);
      const select = screen.getByRole('combobox', { name: /stage de prominense para INSTALADO/i }) as HTMLSelectElement;
      // No debe haber ninguna option marcada como inexistente
      const ghost = Array.from(select.options).find(o => /inexistente|⚠/i.test(o.textContent ?? ''));
      expect(ghost).toBeUndefined();
    });
  });

  // ── FIX 3: color picker dispara PATCH solo en onBlur, no en onChange ──────
  describe('FIX 3 — color picker fires PATCH only on blur', () => {
    it('does NOT call mutateAsync when the color changes (only onChange, no blur)', () => {
      const mutateAsync = vi.fn().mockResolvedValue({});
      vi.mocked(useUpdateIClassStatus).mockReturnValue({ ...idle, mutateAsync } as never);
      mockData();

      render(<IClassStatusCatalogBody />);
      // Locate the color input via aria-label
      const picker = document.querySelector('input[type="color"][aria-label*="INSTALADO"]') as HTMLInputElement;
      expect(picker).not.toBeNull();
      // Simulate dragging the color picker (multiple change events, no blur)
      fireEvent.change(picker, { target: { value: '#ff0000' } });
      fireEvent.change(picker, { target: { value: '#aa0000' } });

      // Must NOT fire PATCH on change — only on blur
      expect(mutateAsync).not.toHaveBeenCalled();
    });

    it('calls mutateAsync with the new color only on blur (single PATCH)', () => {
      const mutateAsync = vi.fn().mockResolvedValue({});
      vi.mocked(useUpdateIClassStatus).mockReturnValue({ ...idle, mutateAsync } as never);
      mockData();

      render(<IClassStatusCatalogBody />);
      const picker = document.querySelector('input[type="color"][aria-label*="INSTALADO"]') as HTMLInputElement;
      // Simulate drag (multiple changes) then blur
      fireEvent.change(picker, { target: { value: '#ff0000' } });
      fireEvent.change(picker, { target: { value: '#00ff00' } });
      fireEvent.blur(picker);

      // Exactly ONE PATCH, with the final value
      expect(mutateAsync).toHaveBeenCalledTimes(1);
      expect(mutateAsync).toHaveBeenCalledWith({
        statusCode: 'INSTALADO',
        payload: { color: picker.value },
      });
    });
  });

  // ── FIX 4 + FIX 5: gating iclass.read — confiable y no-falsificable ──────
  describe('Permission gating — iclass.read gate (FIX 4 + FIX 5)', () => {
    it('hides the entire table content when user has NO iclass.read', () => {
      // Without iclass.read, Can falls back to null → no table, no helper text
      mockPermissions([]);
      mockData();
      render(<IClassStatusCatalogBody />);
      expect(screen.queryByText('INSTALADO')).not.toBeInTheDocument();
      expect(screen.queryByText('PENDIENTE')).not.toBeInTheDocument();
    });

    it('shows table rows when user has iclass.read', () => {
      mockPermissions(['iclass.read']);
      mockData();
      render(<IClassStatusCatalogBody />);
      expect(screen.getByText('INSTALADO')).toBeInTheDocument();
      expect(screen.getByText('PENDIENTE')).toBeInTheDocument();
    });

    it('hides Sincronizar button when user has iclass.read but NOT iclass.manage', () => {
      mockPermissions(['iclass.read']);
      mockData();
      render(<IClassStatusCatalogBody />);
      expect(screen.queryByRole('button', { name: /sincronizar estados/i })).not.toBeInTheDocument();
    });

    it('hides the displayLabel input when user has iclass.read but NOT iclass.manage', () => {
      mockPermissions(['iclass.read']);
      mockData();
      render(<IClassStatusCatalogBody />);
      expect(screen.queryByRole('textbox', { name: /etiqueta personalizada/i })).not.toBeInTheDocument();
    });

    it('hides the tracked toggle when user has iclass.read but NOT iclass.manage', () => {
      mockPermissions(['iclass.read']);
      mockData();
      render(<IClassStatusCatalogBody />);
      expect(screen.queryByRole('checkbox', { name: /mostrar badge/i })).not.toBeInTheDocument();
    });
  });

  describe('Permission gating — without iclass.manage (keeps backward compat)', () => {
    it('hides the Sincronizar button without iclass.manage', () => {
      mockPermissions(['iclass.read']);
      mockData();
      render(<IClassStatusCatalogBody />);
      expect(screen.queryByRole('button', { name: /sincronizar estados/i })).not.toBeInTheDocument();
    });

    it('hides the displayLabel input without iclass.manage', () => {
      mockPermissions(['iclass.read']);
      mockData();
      render(<IClassStatusCatalogBody />);
      expect(screen.queryByRole('textbox', { name: /etiqueta personalizada/i })).not.toBeInTheDocument();
    });

    it('hides the tracked toggle without iclass.manage', () => {
      mockPermissions(['iclass.read']);
      mockData();
      render(<IClassStatusCatalogBody />);
      expect(screen.queryByRole('checkbox', { name: /mostrar badge/i })).not.toBeInTheDocument();
    });
  });
});
