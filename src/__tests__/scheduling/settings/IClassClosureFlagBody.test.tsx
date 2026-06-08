import { render, screen, fireEvent, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/hooks/useFeatureFlags', () => ({
  useFeatureFlag: vi.fn(),
  useSetFeatureFlag: vi.fn(),
}));
vi.mock('@/hooks/useIClassClosure', () => ({ useRunClosureBackfill: vi.fn(), useReprocessClosure: vi.fn(), usePendingCount: vi.fn() }));
vi.mock('@/hooks/useMyPermissions', () => ({ useMyPermissions: vi.fn() }));

import { useFeatureFlag, useSetFeatureFlag } from '@/hooks/useFeatureFlags';
import { useRunClosureBackfill, useReprocessClosure, usePendingCount } from '@/hooks/useIClassClosure';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { IClassClosureFlagBody } from '@/pages/scheduling/settings/IClassClosureFlagBody';

const FLAG = 'iclass-closure-loop';
const TOGGLE = /cierre automático de os de iclass/i;

const idleMutation = {
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  reset: vi.fn(),
};

const idlePendingCount = {
  data: { pending: 0 },
  isLoading: false,
  isError: false,
  isSuccess: true,
};

const REPROCESS_FLAG = 'iclass-closure-reprocess';
const REPROCESS_TOGGLE = /reprocesamiento de side-effects/i;
const AUDIT_FLAG = 'iclass-audit';
const AUDIT_TOGGLE = /auditor(í|i)a de ia/i;
const AUTOCOMPLETE_FLAG = 'task-autocomplete';
const AUTOCOMPLETE_TOGGLE = /auto-?completado de tareas/i;

/** Mock the closure flags independently (loop + reprocess + audit + autocomplete), keyed by flag name. */
function mockFlags(loop: boolean | null, reprocess: boolean | null = loop, audit: boolean | null = false, autocomplete: boolean | null = false, loading = false, error = false) {
  vi.mocked(useFeatureFlag).mockImplementation(((key: string) => {
    const enabled = key === REPROCESS_FLAG ? reprocess : key === AUDIT_FLAG ? audit : key === AUTOCOMPLETE_FLAG ? autocomplete : loop;
    return {
      data: enabled === null ? undefined : { key, enabled },
      isLoading: loading,
      isError: error,
      isSuccess: !loading && !error && enabled !== null,
      refetch: vi.fn(),
    };
  }) as never);
}

function mockFlag(enabled: boolean | null, loading = false, error = false) {
  mockFlags(enabled, enabled, false, false, loading, error);
}

function mockPerms(can: (p: string | string[]) => boolean) {
  vi.mocked(useMyPermissions).mockReturnValue({
    user: null, roles: [], permissions: [], isLoading: false, isError: false, can,
  } as never);
}

function renderBody() {
  return render(
    <MemoryRouter>
      <IClassClosureFlagBody />
    </MemoryRouter>,
  );
}

describe('IClassClosureFlagBody', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSetFeatureFlag).mockReturnValue(idleMutation as never);
    vi.mocked(useRunClosureBackfill).mockReturnValue(idleMutation as never);
    vi.mocked(useReprocessClosure).mockReturnValue(idleMutation as never);
    vi.mocked(usePendingCount).mockReturnValue(idlePendingCount as never);
    mockPerms(() => true); // default: all permissions granted
  });

  it('renders loading state while the flag query is loading', () => {
    mockFlag(null, true);
    renderBody();
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('renders error state with retry when the flag query errors', () => {
    mockFlag(null, false, true);
    renderBody();
    expect(screen.getByText(/no se pudo cargar/i)).toBeInTheDocument();
  });

  it('renders toggle OFF and the inactive badge when disabled', () => {
    mockFlag(false);
    renderBody();
    expect(screen.getByRole('checkbox', { name: TOGGLE })).not.toBeChecked();
    const closureCard = screen.getByText('Cierre automático de OS').closest('section')!;
    expect(within(closureCard).getByText('Inactivo')).toBeInTheDocument();
  });

  it('renders toggle ON and the active badge when enabled', () => {
    mockFlag(true);
    renderBody();
    expect(screen.getByRole('checkbox', { name: TOGGLE })).toBeChecked();
    expect(screen.getByText('Activo')).toBeInTheDocument();
  });

  it('clicking the toggle calls setFlag with the inverted boolean and the closure key', () => {
    mockFlag(false);
    const mutate = vi.fn();
    vi.mocked(useSetFeatureFlag).mockReturnValue({ ...idleMutation, mutate } as never);

    renderBody();
    fireEvent.click(screen.getByRole('checkbox', { name: TOGGLE }));

    expect(mutate).toHaveBeenCalledWith({ key: FLAG, enabled: true });
  });

  it('disables the toggle while the mutation is pending', () => {
    mockFlag(true);
    vi.mocked(useSetFeatureFlag).mockReturnValue({ ...idleMutation, isPending: true } as never);

    renderBody();
    expect(screen.getByRole('checkbox', { name: TOGGLE })).toBeDisabled();
  });

  it('shows an error banner when the mutation fails', () => {
    mockFlag(true);
    vi.mocked(useSetFeatureFlag).mockReturnValue({ ...idleMutation, isError: true } as never);

    renderBody();
    expect(screen.getByText(/no se pudo cambiar el estado/i)).toBeInTheDocument();
  });

  it('runs the backfill when "Reconciliar ahora" is clicked', () => {
    mockFlag(true);
    const mutateAsync = vi.fn().mockResolvedValue({ queued: true });
    vi.mocked(useRunClosureBackfill).mockReturnValue({ ...idleMutation, mutateAsync } as never);

    renderBody();
    fireEvent.click(screen.getByRole('button', { name: /reconciliar ahora/i }));

    expect(mutateAsync).toHaveBeenCalled();
  });

  // ─── B1.1 — banner: queued ────────────────────────────────────────────────
  it('B1.1 shows "Reconciliación encolada" banner when backfill returns queued:true', async () => {
    mockFlag(true);
    const mutateAsync = vi.fn().mockResolvedValue({ queued: true });
    vi.mocked(useRunClosureBackfill).mockReturnValue({ ...idleMutation, mutateAsync } as never);

    renderBody();
    fireEvent.click(screen.getByRole('button', { name: /reconciliar ahora/i }));

    await screen.findByText(/reconciliación encolada/i);
  });

  // ─── B1.2 — banner: already-running ──────────────────────────────────────
  it('B1.2 shows "Ya hay una reconciliación en curso" when backfill returns queued:false already-running', async () => {
    mockFlag(true);
    const mutateAsync = vi.fn().mockResolvedValue({ queued: false, reason: 'already-running' });
    vi.mocked(useRunClosureBackfill).mockReturnValue({ ...idleMutation, mutateAsync } as never);

    renderBody();
    fireEvent.click(screen.getByRole('button', { name: /reconciliar ahora/i }));

    await screen.findByText(/ya hay una reconciliación en curso/i);
  });

  // ─── B1.3 — banner: unavailable (503) ────────────────────────────────────
  it('B1.3 shows "No disponible" when backfill throws with 503 unavailable', async () => {
    mockFlag(true);
    const mutateAsync = vi.fn().mockRejectedValue({ response: { status: 503, data: { reason: 'unavailable' } } });
    vi.mocked(useRunClosureBackfill).mockReturnValue({ ...idleMutation, mutateAsync } as never);

    renderBody();
    fireEvent.click(screen.getByRole('button', { name: /reconciliar ahora/i }));

    await screen.findByText(/no disponible/i);
  });

  // ─── B3.3 — pending count is a Link ──────────────────────────────────────
  it('B3.3 renders pending count as a Link to /admin/scheduling/iclass/closure/pending', () => {
    mockFlags(true, true);
    vi.mocked(usePendingCount).mockReturnValue({ ...idlePendingCount, data: { pending: 5 } } as never);

    renderBody();

    const link = screen.getByRole('link', { name: /quedan 5 pendientes/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/admin/scheduling/iclass/closure/pending');
  });

  it('runs the reprocess when "Reprocesar ahora" is clicked (iclass.manage granted)', () => {
    mockFlag(true);
    const mutateAsync = vi.fn().mockResolvedValue({ skipped: false, candidates: 0, processed: 0, noTask: 0 });
    vi.mocked(useReprocessClosure).mockReturnValue({ ...idleMutation, mutateAsync } as never);

    renderBody();
    fireEvent.click(screen.getByRole('button', { name: /reprocesar ahora/i }));

    expect(mutateAsync).toHaveBeenCalled();
  });

  it('hides the reprocess section without the iclass.manage permission', () => {
    mockFlag(true);
    mockPerms((p) => !(Array.isArray(p) ? p : [p]).includes('iclass.manage'));

    renderBody();

    expect(screen.queryByRole('button', { name: /reprocesar ahora/i })).not.toBeInTheDocument();
    // the rest of the panel still renders
    expect(screen.getByRole('button', { name: /reconciliar ahora/i })).toBeInTheDocument();
  });

  it('renders the reprocess toggle reflecting the iclass-closure-reprocess flag (independent of the loop flag)', () => {
    mockFlags(true, false); // loop ON, reprocess OFF
    renderBody();
    expect(screen.getByRole('checkbox', { name: REPROCESS_TOGGLE })).not.toBeChecked();
  });

  it('clicking the reprocess toggle flips the iclass-closure-reprocess flag', () => {
    mockFlags(true, false);
    const mutate = vi.fn();
    vi.mocked(useSetFeatureFlag).mockReturnValue({ ...idleMutation, mutate } as never);

    renderBody();
    fireEvent.click(screen.getByRole('checkbox', { name: REPROCESS_TOGGLE }));

    expect(mutate).toHaveBeenCalledWith({ key: REPROCESS_FLAG, enabled: true });
  });

  it('disables "Reprocesar ahora" while the reprocess flag is OFF', () => {
    mockFlags(true, false); // reprocess OFF
    renderBody();
    expect(screen.getByRole('button', { name: /reprocesar ahora/i })).toBeDisabled();
  });

  it('renders the audit toggle reflecting the iclass-audit flag (independent of loop/reprocess)', () => {
    mockFlags(true, false, true); // loop ON, reprocess OFF, audit ON
    renderBody();
    expect(screen.getByRole('checkbox', { name: AUDIT_TOGGLE })).toBeChecked();
  });

  it('clicking the audit toggle flips the iclass-audit flag', () => {
    mockFlags(true, false, false); // audit OFF
    const mutate = vi.fn();
    vi.mocked(useSetFeatureFlag).mockReturnValue({ ...idleMutation, mutate } as never);

    renderBody();
    fireEvent.click(screen.getByRole('checkbox', { name: AUDIT_TOGGLE }));

    expect(mutate).toHaveBeenCalledWith({ key: AUDIT_FLAG, enabled: true });
  });

  it('hides the audit toggle without the iclass.manage permission', () => {
    mockFlag(true);
    mockPerms((p) => !(Array.isArray(p) ? p : [p]).includes('iclass.manage'));

    renderBody();

    expect(screen.queryByRole('checkbox', { name: AUDIT_TOGGLE })).not.toBeInTheDocument();
  });

  it('renders the autocomplete toggle reflecting the task-autocomplete flag', () => {
    mockFlags(true, false, false, true); // autocomplete ON
    renderBody();
    expect(screen.getByRole('checkbox', { name: AUTOCOMPLETE_TOGGLE })).toBeChecked();
  });

  it('clicking the autocomplete toggle flips the task-autocomplete flag', () => {
    mockFlags(true, false, false, false); // autocomplete OFF
    const mutate = vi.fn();
    vi.mocked(useSetFeatureFlag).mockReturnValue({ ...idleMutation, mutate } as never);

    renderBody();
    fireEvent.click(screen.getByRole('checkbox', { name: AUTOCOMPLETE_TOGGLE }));

    expect(mutate).toHaveBeenCalledWith({ key: AUTOCOMPLETE_FLAG, enabled: true });
  });

  it('hides the autocomplete toggle without the iclass.manage permission', () => {
    mockFlag(true);
    mockPerms((p) => !(Array.isArray(p) ? p : [p]).includes('iclass.manage'));

    renderBody();

    expect(screen.queryByRole('checkbox', { name: AUTOCOMPLETE_TOGGLE })).not.toBeInTheDocument();
  });

  // ─── B2.1 — queued banner + pending-count + button disable ───────────────

  it('shows "encolado" banner when reprocess mutation returns queued:true', async () => {
    mockFlags(true, true);
    const mutateAsync = vi.fn().mockResolvedValue({ queued: true });
    vi.mocked(useReprocessClosure).mockReturnValue({ ...idleMutation, mutateAsync } as never);

    renderBody();
    fireEvent.click(screen.getByRole('button', { name: /reprocesar ahora/i }));

    await screen.findByText(/reprocesamiento encolado/i);
  });

  it('shows "en curso" banner when reprocess returns queued:false reason already-running', async () => {
    mockFlags(true, true);
    const mutateAsync = vi.fn().mockResolvedValue({ queued: false, reason: 'already-running' });
    vi.mocked(useReprocessClosure).mockReturnValue({ ...idleMutation, mutateAsync } as never);

    renderBody();
    fireEvent.click(screen.getByRole('button', { name: /reprocesar ahora/i }));

    await screen.findByText(/ya hay un reprocesamiento en curso/i);
  });

  it('shows "deshabilitado" banner when reprocess returns queued:false reason flag-disabled', async () => {
    mockFlags(true, true);
    const mutateAsync = vi.fn().mockResolvedValue({ queued: false, reason: 'flag-disabled' });
    vi.mocked(useReprocessClosure).mockReturnValue({ ...idleMutation, mutateAsync } as never);

    renderBody();
    fireEvent.click(screen.getByRole('button', { name: /reprocesar ahora/i }));

    await screen.findByText(/reprocesamiento deshabilitado/i);
  });

  it('shows "quedan N pendientes" when pending>0', () => {
    mockFlags(true, true);
    vi.mocked(usePendingCount).mockReturnValue({ ...idlePendingCount, data: { pending: 7 } } as never);

    renderBody();

    expect(screen.getByText(/quedan 7 pendientes/i)).toBeInTheDocument();
  });

  it('disables the reprocess button while pending>0', () => {
    mockFlags(true, true);
    vi.mocked(usePendingCount).mockReturnValue({ ...idlePendingCount, data: { pending: 3 } } as never);

    renderBody();

    expect(screen.getByRole('button', { name: /reprocesar ahora/i })).toBeDisabled();
  });

  it('disables the reprocess button while a queued run is in flight (isPending=true)', () => {
    mockFlags(true, true);
    vi.mocked(useReprocessClosure).mockReturnValue({ ...idleMutation, isPending: true } as never);

    renderBody();

    expect(screen.getByRole('button', { name: /reprocesando/i })).toBeDisabled();
  });
});
