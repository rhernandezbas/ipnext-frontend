import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/hooks/useGestionRealIngest', () => ({
  useGestionRealConfig: vi.fn(),
  useUpdateGestionRealConfig: vi.fn(),
  useGestionRealStatus: vi.fn(),
  useGestionRealNeedsReview: vi.fn(),
}));
vi.mock('@/hooks/useProjects', () => ({
  useProjects: vi.fn(),
}));
vi.mock('@/hooks/useFeatureFlags', () => ({
  useFeatureFlag: vi.fn(),
  useSetFeatureFlag: vi.fn(),
}));

import {
  useGestionRealConfig,
  useUpdateGestionRealConfig,
  useGestionRealStatus,
  useGestionRealNeedsReview,
} from '@/hooks/useGestionRealIngest';
import { useProjects } from '@/hooks/useProjects';
import { useFeatureFlag, useSetFeatureFlag } from '@/hooks/useFeatureFlags';
import { GestionRealBody } from '@/pages/scheduling/settings/GestionRealBody';
import type { IngestConfigDTO, IngestStatusDTO, NeedsReviewTaskDTO } from '@/types/gestionRealIngest';
import type { Project } from '@/types/project';

const makeProject = (over: Partial<Project> = {}): Project => ({
  id: 'p1',
  title: 'Proyecto Fibra',
  description: null,
  workflowId: null,
  visible: true,
  createdAt: '',
  updatedAt: '',
  ...over,
});

const makeConfig = (over: Partial<IngestConfigDTO> = {}): IngestConfigDTO => ({
  intervalMs: 300_000,
  windowMonths: 3,
  fiberProjectId: 'p1',
  wirelessProjectId: 'p2',
  sourceEstado: 'CONF',
  ...over,
});

const makeStatus = (over: Partial<IngestStatusDTO> = {}): IngestStatusDTO => ({
  lastRunAt: '2026-05-29T12:00:00.000Z',
  created: 4,
  skippedDuplicate: 1,
  skippedUnmirrored: 2,
  unclassified: 3,
  ...over,
});

const makeTask = (over: Partial<NeedsReviewTaskDTO> = {}): NeedsReviewTaskDTO => ({
  id: 'task-1',
  title: 'Instalación Pérez',
  description: null,
  grOrdenId: 'GR-123',
  projectId: null,
  customerId: null,
  serviceId: null,
  address: 'Calle Falsa 123',
  category: 'instalacion',
  priority: 'normal',
  stageId: 'stage-1',
  createdAt: '2026-05-29T10:00:00.000Z',
  ...over,
});

const idleMutation = {
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
  reset: vi.fn(),
};

function mockConfig(
  config: IngestConfigDTO | null,
  opts: { loading?: boolean; isError?: boolean; refetch?: () => void } = {},
) {
  vi.mocked(useGestionRealConfig).mockReturnValue({
    data: config ?? undefined,
    isLoading: opts.loading ?? false,
    isError: opts.isError ?? false,
    refetch: opts.refetch ?? vi.fn(),
  } as never);
}

function mockProjects(projects: Project[]) {
  vi.mocked(useProjects).mockReturnValue({
    data: projects,
    isLoading: false,
    isError: false,
  } as never);
}

function mockStatus(
  status: IngestStatusDTO | null,
  opts: { loading?: boolean; isError?: boolean } = {},
) {
  vi.mocked(useGestionRealStatus).mockReturnValue({
    data: status ?? undefined,
    isLoading: opts.loading ?? false,
    isError: opts.isError ?? false,
  } as never);
}

function mockNeedsReview(
  tasks: NeedsReviewTaskDTO[] | null,
  opts: { loading?: boolean; isError?: boolean } = {},
) {
  vi.mocked(useGestionRealNeedsReview).mockReturnValue({
    data: tasks ?? undefined,
    isLoading: opts.loading ?? false,
    isError: opts.isError ?? false,
  } as never);
}

function mockFeatureFlag(enabled: boolean) {
  vi.mocked(useFeatureFlag).mockReturnValue({
    data: { key: 'gestion-real-ingest', enabled },
    isLoading: false,
    isError: false,
  } as never);
}

const idleSetFlag = {
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
  reset: vi.fn(),
};

function mockSetFeatureFlag(over: Partial<typeof idleSetFlag> = {}) {
  const m = { ...idleSetFlag, ...over };
  vi.mocked(useSetFeatureFlag).mockReturnValue(m as never);
  return m;
}

function renderBody() {
  return render(
    <MemoryRouter>
      <GestionRealBody />
    </MemoryRouter>,
  );
}

describe('GestionRealBody', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUpdateGestionRealConfig).mockReturnValue(idleMutation as never);
    // sensible defaults; individual tests override what they care about
    mockConfig(makeConfig());
    mockProjects([
      makeProject({ id: 'p1', title: 'Proyecto Fibra' }),
      makeProject({ id: 'p2', title: 'Proyecto Wireless' }),
    ]);
    mockStatus(makeStatus());
    mockNeedsReview([]);
    mockFeatureFlag(true);
    mockSetFeatureFlag();
  });

  // ── Phase 4: Configuración ────────────────────────────────────────────────
  describe('Configuración', () => {
    it('populates the form from the loaded config', () => {
      mockConfig(makeConfig({ intervalMs: 900_000, windowMonths: 6, fiberProjectId: 'p1', wirelessProjectId: 'p2' }));
      renderBody();

      expect((screen.getByLabelText(/intervalo/i) as HTMLSelectElement).value).toBe('15');
      expect((screen.getByLabelText(/ventana/i) as HTMLInputElement).value).toBe('6');
      expect((screen.getByLabelText(/proyecto fibra/i) as HTMLSelectElement).value).toBe('p1');
      expect((screen.getByLabelText(/proyecto wireless/i) as HTMLSelectElement).value).toBe('p2');
    });

    it('project dropdowns include a "(sin asignar)" option mapping to null', () => {
      renderBody();
      const fiber = screen.getByLabelText(/proyecto fibra/i) as HTMLSelectElement;
      const options = Array.from(fiber.options).map(o => o.textContent);
      expect(options).toContain('(sin asignar)');
    });

    it('renders a non-preset intervalMs gracefully without crashing', () => {
      mockConfig(makeConfig({ intervalMs: 123_000 })); // ~2 min, not a preset
      renderBody();
      const select = screen.getByLabelText(/intervalo/i) as HTMLSelectElement;
      expect(select.value).toBe('2');
      expect(Array.from(select.options).map(o => o.textContent)).toContain('2 min (personalizado)');
    });

    it('Guardar is disabled when the form is clean', () => {
      renderBody();
      expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled();
    });

    it('editing a field enables Guardar', () => {
      renderBody();
      fireEvent.change(screen.getByLabelText(/ventana/i), { target: { value: '9' } });
      expect(screen.getByRole('button', { name: /guardar/i })).toBeEnabled();
    });

    it('Guardar sends the payload with intervalMs converted from minutes (5 → 300000) and no enabled field', async () => {
      const mutate = vi.fn();
      vi.mocked(useUpdateGestionRealConfig).mockReturnValue({ ...idleMutation, mutate } as never);
      mockConfig(makeConfig({ intervalMs: 900_000, windowMonths: 3, fiberProjectId: 'p1', wirelessProjectId: 'p2' }));

      renderBody();
      fireEvent.change(screen.getByLabelText(/intervalo/i), { target: { value: '5' } });
      fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

      await waitFor(() => {
        expect(mutate).toHaveBeenCalledWith(
          expect.objectContaining({ intervalMs: 300_000, windowMonths: 3, fiberProjectId: 'p1', wirelessProjectId: 'p2' }),
        );
      });
      expect(mutate.mock.calls[0][0]).not.toHaveProperty('enabled');
    });

    it('Guardar is disabled while the mutation is pending', () => {
      vi.mocked(useUpdateGestionRealConfig).mockReturnValue({ ...idleMutation, isPending: true } as never);
      renderBody();
      fireEvent.change(screen.getByLabelText(/ventana/i), { target: { value: '9' } });
      expect(screen.getByRole('button', { name: /guardar|guardando/i })).toBeDisabled();
    });

    it('shows a Spanish validation message on 400 VALIDATION_ERROR', () => {
      vi.mocked(useUpdateGestionRealConfig).mockReturnValue({
        ...idleMutation,
        isError: true,
        error: { response: { status: 400, data: { code: 'VALIDATION_ERROR' } } },
      } as never);
      renderBody();
      expect(screen.getByText(/validación|datos inválidos|revisá los campos/i)).toBeInTheDocument();
    });

    it('shows a Spanish project-not-found message on 404 PROJECT_NOT_FOUND', () => {
      vi.mocked(useUpdateGestionRealConfig).mockReturnValue({
        ...idleMutation,
        isError: true,
        error: { response: { status: 404, data: { code: 'PROJECT_NOT_FOUND' } } },
      } as never);
      renderBody();
      expect(screen.getByText(/proyecto.*no.*encontr|no existe/i)).toBeInTheDocument();
    });
  });

  // ── Estado de OS a traer (sourceEstado) ───────────────────────────────────
  describe('Estado de OS a traer (sourceEstado)', () => {
    it('populates the estado select from the loaded config (CONF → Confirmada selected)', () => {
      mockConfig(makeConfig({ sourceEstado: 'CONF' }));
      renderBody();
      const select = screen.getByLabelText(/estado de os a traer/i) as HTMLSelectElement;
      expect(select.value).toBe('CONF');
      expect(select.options[select.selectedIndex].textContent).toBe('Confirmada');
    });

    it('renders the 4 estado options with Spanish labels', () => {
      renderBody();
      const select = screen.getByLabelText(/estado de os a traer/i) as HTMLSelectElement;
      const labels = Array.from(select.options).map(o => o.textContent);
      expect(labels).toEqual(['Pendiente', 'Confirmada', 'Cerrada', 'Anulada']);
    });

    it('reflects a different loaded estado (PEND → Pendiente selected)', () => {
      mockConfig(makeConfig({ sourceEstado: 'PEND' }));
      renderBody();
      const select = screen.getByLabelText(/estado de os a traer/i) as HTMLSelectElement;
      expect(select.value).toBe('PEND');
    });

    it('changing the estado enables Guardar', () => {
      mockConfig(makeConfig({ sourceEstado: 'CONF' }));
      renderBody();
      expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled();
      fireEvent.change(screen.getByLabelText(/estado de os a traer/i), { target: { value: 'CERR' } });
      expect(screen.getByRole('button', { name: /guardar/i })).toBeEnabled();
    });

    it('saving sends sourceEstado in the PUT payload', async () => {
      const mutate = vi.fn();
      vi.mocked(useUpdateGestionRealConfig).mockReturnValue({ ...idleMutation, mutate } as never);
      mockConfig(makeConfig({ sourceEstado: 'CONF' }));

      renderBody();
      fireEvent.change(screen.getByLabelText(/estado de os a traer/i), { target: { value: 'ANUL' } });
      fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

      await waitFor(() => {
        expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ sourceEstado: 'ANUL' }));
      });
    });
  });

  // ── Activación (feature flag gestion-real-ingest) ─────────────────────────
  describe('Activación (feature flag)', () => {
    it('toggle reflects the flag state when ON', () => {
      mockFeatureFlag(true);
      renderBody();
      expect(screen.getByRole('checkbox', { name: /activar ingesta de gestión real/i })).toBeChecked();
    });

    it('toggle reflects the flag state when OFF and shows the off-hint', () => {
      mockFeatureFlag(false);
      renderBody();
      expect(screen.getByRole('checkbox', { name: /activar ingesta de gestión real/i })).not.toBeChecked();
      expect(screen.getByText(/la ingesta está desactivada/i)).toBeInTheDocument();
    });

    it('does NOT render the old "ir al panel de Feature Flags" wording', () => {
      mockFeatureFlag(false);
      renderBody();
      expect(screen.queryByText(/panel\s+de feature flags/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/deshabilitada a nivel sistema/i)).not.toBeInTheDocument();
    });

    it('turning the flag ON calls setFeatureFlag with enabled=true', () => {
      const setFlag = mockSetFeatureFlag();
      mockFeatureFlag(false);
      mockConfig(makeConfig({ fiberProjectId: 'p1', wirelessProjectId: 'p2' }));
      renderBody();

      fireEvent.click(screen.getByRole('checkbox', { name: /activar ingesta de gestión real/i }));

      expect(setFlag.mutate).toHaveBeenCalledWith({ key: 'gestion-real-ingest', enabled: true });
    });

    it('turning the flag OFF calls setFeatureFlag with enabled=false (always allowed, even with unmapped projects)', () => {
      const setFlag = mockSetFeatureFlag();
      mockFeatureFlag(true);
      mockConfig(makeConfig({ fiberProjectId: null, wirelessProjectId: null }));
      renderBody();

      fireEvent.click(screen.getByRole('checkbox', { name: /activar ingesta de gestión real/i }));

      expect(setFlag.mutate).toHaveBeenCalledWith({ key: 'gestion-real-ingest', enabled: false });
    });

    it('enable-guard: turning ON while a project is unmapped is BLOCKED (setFeatureFlag not called) and shows the warning', () => {
      const setFlag = mockSetFeatureFlag();
      mockFeatureFlag(false);
      mockConfig(makeConfig({ fiberProjectId: null, wirelessProjectId: 'p2' }));
      renderBody();

      fireEvent.click(screen.getByRole('checkbox', { name: /activar ingesta de gestión real/i }));

      expect(setFlag.mutate).not.toHaveBeenCalled();
      expect(screen.getByText(/mape.* los proyectos primero|proyecto sin mapear/i)).toBeInTheDocument();
    });

    it('shows pending/disabled state while the mutation runs', () => {
      mockSetFeatureFlag({ isPending: true });
      mockFeatureFlag(false);
      renderBody();
      expect(screen.getByRole('checkbox', { name: /activar ingesta de gestión real/i })).toBeDisabled();
    });

    it('surfaces an error when the toggle mutation fails', () => {
      mockSetFeatureFlag({ isError: true });
      mockFeatureFlag(false);
      renderBody();
      expect(screen.getByText(/no se pudo cambiar el estado de la ingesta/i)).toBeInTheDocument();
    });
  });

  // ── Phase 5: Estado ───────────────────────────────────────────────────────
  describe('Estado', () => {
    it('renders the 4 counters from status data', () => {
      mockConfig(makeConfig());
      mockStatus(makeStatus({ created: 4, skippedDuplicate: 1, skippedUnmirrored: 2, unclassified: 3 }));
      renderBody();

      const created = screen.getByTestId('gr-counter-created');
      const dup = screen.getByTestId('gr-counter-skippedDuplicate');
      const unm = screen.getByTestId('gr-counter-skippedUnmirrored');
      const unc = screen.getByTestId('gr-counter-unclassified');
      expect(created).toHaveTextContent('4');
      expect(dup).toHaveTextContent('1');
      expect(unm).toHaveTextContent('2');
      expect(unc).toHaveTextContent('3');
    });

    it('shows "Nunca" when lastRunAt is null', () => {
      mockStatus(makeStatus({ lastRunAt: null }));
      renderBody();
      expect(screen.getByText(/nunca/i)).toBeInTheDocument();
    });
  });

  // ── Phase 6: Revisión pendiente ───────────────────────────────────────────
  describe('Revisión pendiente', () => {
    it('renders a row per needs-review task linking to the task detail', () => {
      mockNeedsReview([makeTask({ id: 'task-9', title: 'Instalación X', address: 'Av. Siempre Viva 742', grOrdenId: 'GR-9' })]);
      renderBody();

      expect(screen.getByText('Instalación X')).toBeInTheDocument();
      expect(screen.getByText('Av. Siempre Viva 742')).toBeInTheDocument();
      expect(screen.getByText('GR-9')).toBeInTheDocument();
      const link = screen.getByRole('link', { name: /instalación x/i });
      expect(link).toHaveAttribute('href', '/admin/scheduling/tasks/task-9');
    });

    it('shows an empty state when there are no needs-review tasks', () => {
      mockNeedsReview([]);
      renderBody();
      expect(screen.getByText(/no hay tareas (en|pendientes de) revisión|sin tareas/i)).toBeInTheDocument();
    });
  });

  // ── Review fixes ───────────────────────────────────────────────────────────
  describe('Review fix C1 — non-preset intervalMs preserved on save', () => {
    it('keeps a loaded non-preset intervalMs when editing another field (200000 stays 200000)', async () => {
      const mutate = vi.fn();
      vi.mocked(useUpdateGestionRealConfig).mockReturnValue({ ...idleMutation, mutate } as never);
      // 200000ms ≈ 3.33 min → rounds to 3 (a preset), but raw must be preserved.
      mockConfig(makeConfig({ intervalMs: 200_000, windowMonths: 3 }));

      renderBody();
      fireEvent.change(screen.getByLabelText(/ventana/i), { target: { value: '6' } });
      fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

      await waitFor(() => {
        expect(mutate).toHaveBeenCalledWith(
          expect.objectContaining({ intervalMs: 200_000, windowMonths: 6 }),
        );
      });
    });

    it('uses the select value when the user changes the interval (5 min → 300000)', async () => {
      const mutate = vi.fn();
      vi.mocked(useUpdateGestionRealConfig).mockReturnValue({ ...idleMutation, mutate } as never);
      mockConfig(makeConfig({ intervalMs: 200_000, windowMonths: 3 }));

      renderBody();
      fireEvent.change(screen.getByLabelText(/intervalo/i), { target: { value: '5' } });
      fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

      await waitFor(() => {
        expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ intervalMs: 300_000 }));
      });
    });

    it('leaves Guardar disabled for an untouched non-preset config', () => {
      mockConfig(makeConfig({ intervalMs: 200_000 }));
      renderBody();
      expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled();
    });
  });

  describe('Review fix W1 — GET query error states', () => {
    it('config query error shows an error banner with a retry button (not the spinner)', () => {
      const refetch = vi.fn();
      mockConfig(null, { isError: true, refetch });
      renderBody();

      expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument();
      expect(screen.getByText(/no se pudo cargar la configuración/i)).toBeInTheDocument();
      const retry = screen.getByRole('button', { name: /reintentar/i });
      fireEvent.click(retry);
      expect(refetch).toHaveBeenCalled();
    });

    it('status query error shows an error indicator (not all-zero counters)', () => {
      mockStatus(null, { isError: true });
      renderBody();
      expect(screen.getByText(/no se pudo cargar el estado/i)).toBeInTheDocument();
      expect(screen.queryByTestId('gr-counter-created')).not.toBeInTheDocument();
    });

    it('needs-review query error shows an error message (not the empty state)', () => {
      mockNeedsReview(null, { isError: true });
      renderBody();
      expect(screen.getByText(/no se pudo cargar.*revisión/i)).toBeInTheDocument();
      expect(screen.queryByText(/no hay tareas pendientes de revisión/i)).not.toBeInTheDocument();
    });
  });

  describe('Review fix W2 — windowMonths >= 1 client-side', () => {
    it('clearing windowMonths disables Guardar', () => {
      mockConfig(makeConfig({ windowMonths: 3 }));
      renderBody();
      fireEvent.change(screen.getByLabelText(/ventana/i), { target: { value: '' } });
      expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled();
    });

    it('a valid windowMonths still saves', async () => {
      const mutate = vi.fn();
      vi.mocked(useUpdateGestionRealConfig).mockReturnValue({ ...idleMutation, mutate } as never);
      mockConfig(makeConfig({ windowMonths: 3 }));
      renderBody();
      fireEvent.change(screen.getByLabelText(/ventana/i), { target: { value: '6' } });
      fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
      await waitFor(() => {
        expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ windowMonths: 6 }));
      });
    });
  });

  describe('Review fix W3 — reset stale banners on edit', () => {
    it('does not reshow the success banner after edit→revert', () => {
      const reset = vi.fn();
      vi.mocked(useUpdateGestionRealConfig).mockReturnValue({
        ...idleMutation,
        isSuccess: true,
        reset,
      } as never);
      mockConfig(makeConfig({ windowMonths: 3 }));
      renderBody();

      // Initially clean + success → banner visible.
      expect(screen.getByText(/configuración guardada/i)).toBeInTheDocument();

      // Edit then revert back to the baseline value.
      fireEvent.change(screen.getByLabelText(/ventana/i), { target: { value: '9' } });
      expect(reset).toHaveBeenCalled();
    });

    it('clears the error banner when the user edits a field after a failed save', () => {
      const reset = vi.fn();
      vi.mocked(useUpdateGestionRealConfig).mockReturnValue({
        ...idleMutation,
        isError: true,
        error: { response: { status: 400, data: { code: 'VALIDATION_ERROR' } } },
        reset,
      } as never);
      mockConfig(makeConfig({ windowMonths: 3 }));
      renderBody();

      expect(screen.getByText(/datos inválidos/i)).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText(/ventana/i), { target: { value: '9' } });
      expect(reset).toHaveBeenCalled();
    });
  });
});
