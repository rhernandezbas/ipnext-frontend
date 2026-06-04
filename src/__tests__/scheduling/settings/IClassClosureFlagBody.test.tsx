import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/hooks/useFeatureFlags', () => ({
  useFeatureFlag: vi.fn(),
  useSetFeatureFlag: vi.fn(),
}));
vi.mock('@/hooks/useIClassClosure', () => ({ useRunClosureBackfill: vi.fn(), useReprocessClosure: vi.fn() }));
vi.mock('@/hooks/useMyPermissions', () => ({ useMyPermissions: vi.fn() }));

import { useFeatureFlag, useSetFeatureFlag } from '@/hooks/useFeatureFlags';
import { useRunClosureBackfill, useReprocessClosure } from '@/hooks/useIClassClosure';
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

function mockFlag(enabled: boolean | null, loading = false, error = false) {
  vi.mocked(useFeatureFlag).mockReturnValue({
    data: enabled === null ? undefined : { key: FLAG, enabled },
    isLoading: loading,
    isError: error,
    isSuccess: !loading && !error && enabled !== null,
    refetch: vi.fn(),
  } as never);
}

function mockPerms(can: (p: string | string[]) => boolean) {
  vi.mocked(useMyPermissions).mockReturnValue({
    user: null, roles: [], permissions: [], isLoading: false, isError: false, can,
  } as never);
}

describe('IClassClosureFlagBody', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSetFeatureFlag).mockReturnValue(idleMutation as never);
    vi.mocked(useRunClosureBackfill).mockReturnValue(idleMutation as never);
    vi.mocked(useReprocessClosure).mockReturnValue(idleMutation as never);
    mockPerms(() => true); // default: all permissions granted
  });

  it('renders loading state while the flag query is loading', () => {
    mockFlag(null, true);
    render(<IClassClosureFlagBody />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('renders error state with retry when the flag query errors', () => {
    mockFlag(null, false, true);
    render(<IClassClosureFlagBody />);
    expect(screen.getByText(/no se pudo cargar/i)).toBeInTheDocument();
  });

  it('renders toggle OFF and the inactive badge when disabled', () => {
    mockFlag(false);
    render(<IClassClosureFlagBody />);
    expect(screen.getByRole('checkbox', { name: TOGGLE })).not.toBeChecked();
    expect(screen.getByText('Inactivo')).toBeInTheDocument();
  });

  it('renders toggle ON and the active badge when enabled', () => {
    mockFlag(true);
    render(<IClassClosureFlagBody />);
    expect(screen.getByRole('checkbox', { name: TOGGLE })).toBeChecked();
    expect(screen.getByText('Activo')).toBeInTheDocument();
  });

  it('clicking the toggle calls setFlag with the inverted boolean and the closure key', () => {
    mockFlag(false);
    const mutate = vi.fn();
    vi.mocked(useSetFeatureFlag).mockReturnValue({ ...idleMutation, mutate } as never);

    render(<IClassClosureFlagBody />);
    fireEvent.click(screen.getByRole('checkbox', { name: TOGGLE }));

    expect(mutate).toHaveBeenCalledWith({ key: FLAG, enabled: true });
  });

  it('disables the toggle while the mutation is pending', () => {
    mockFlag(true);
    vi.mocked(useSetFeatureFlag).mockReturnValue({ ...idleMutation, isPending: true } as never);

    render(<IClassClosureFlagBody />);
    expect(screen.getByRole('checkbox', { name: TOGGLE })).toBeDisabled();
  });

  it('shows an error banner when the mutation fails', () => {
    mockFlag(true);
    vi.mocked(useSetFeatureFlag).mockReturnValue({ ...idleMutation, isError: true } as never);

    render(<IClassClosureFlagBody />);
    expect(screen.getByText(/no se pudo cambiar el estado/i)).toBeInTheDocument();
  });

  it('runs the backfill when "Reconciliar ahora" is clicked', () => {
    mockFlag(true);
    const mutateAsync = vi.fn().mockResolvedValue({ mirrored: 0, transitioned: 0, skippedNotClosed: 0, skippedNotOurs: 0, skippedUnchanged: 0 });
    vi.mocked(useRunClosureBackfill).mockReturnValue({ ...idleMutation, mutateAsync } as never);

    render(<IClassClosureFlagBody />);
    fireEvent.click(screen.getByRole('button', { name: /reconciliar ahora/i }));

    expect(mutateAsync).toHaveBeenCalled();
  });

  it('runs the reprocess when "Reprocesar ahora" is clicked (iclass.manage granted)', () => {
    mockFlag(true);
    const mutateAsync = vi.fn().mockResolvedValue({ skipped: false, candidates: 0, processed: 0, noTask: 0 });
    vi.mocked(useReprocessClosure).mockReturnValue({ ...idleMutation, mutateAsync } as never);

    render(<IClassClosureFlagBody />);
    fireEvent.click(screen.getByRole('button', { name: /reprocesar ahora/i }));

    expect(mutateAsync).toHaveBeenCalled();
  });

  it('hides the reprocess section without the iclass.manage permission', () => {
    mockFlag(true);
    mockPerms((p) => !(Array.isArray(p) ? p : [p]).includes('iclass.manage'));

    render(<IClassClosureFlagBody />);

    expect(screen.queryByRole('button', { name: /reprocesar ahora/i })).not.toBeInTheDocument();
    // the rest of the panel still renders
    expect(screen.getByRole('button', { name: /reconciliar ahora/i })).toBeInTheDocument();
  });
});
