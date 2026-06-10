import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/hooks/useFeatureFlags', () => ({
  useFeatureFlag: vi.fn(),
  useSetFeatureFlag: vi.fn(),
}));
vi.mock('@/hooks/useMyPermissions', () => ({ useMyPermissions: vi.fn() }));

import { useFeatureFlag, useSetFeatureFlag } from '@/hooks/useFeatureFlags';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { IClassFlagBody } from '@/pages/scheduling/settings/IClassFlagBody';

const idleMutation = {
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  reset: vi.fn(),
};

function mockFlag(enabled: boolean | null, loading = false, error = false) {
  vi.mocked(useFeatureFlag).mockReturnValue({
    data: enabled === null ? undefined : { key: 'iclass-integration', enabled },
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

describe('IClassFlagBody', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSetFeatureFlag).mockReturnValue(idleMutation as never);
    mockPerms(() => true); // default: all permissions granted
  });

  it('renders loading state while the flag query is loading', () => {
    mockFlag(null, true);
    render(<IClassFlagBody />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('renders error state with retry when the flag query errors', () => {
    mockFlag(null, false, true);
    render(<IClassFlagBody />);
    expect(screen.getByText(/no se pudo cargar/i)).toBeInTheDocument();
  });

  it('renders toggle OFF and the inactive status badge when enabled is false', () => {
    mockFlag(false);
    render(<IClassFlagBody />);
    const toggle = screen.getByRole('checkbox', { name: /integración con iclass/i });
    expect(toggle).not.toBeChecked();
    expect(screen.getByText('Inactiva')).toBeInTheDocument();
  });

  it('renders toggle ON and the active status badge when enabled is true', () => {
    mockFlag(true);
    render(<IClassFlagBody />);
    const toggle = screen.getByRole('checkbox', { name: /integración con iclass/i });
    expect(toggle).toBeChecked();
    expect(screen.getByText('Activa')).toBeInTheDocument();
  });

  it('clicking the toggle calls setFlag with the inverted boolean', () => {
    mockFlag(false);
    const mutate = vi.fn();
    vi.mocked(useSetFeatureFlag).mockReturnValue({ ...idleMutation, mutate } as never);

    render(<IClassFlagBody />);
    fireEvent.click(screen.getByRole('checkbox', { name: /integración con iclass/i }));

    expect(mutate).toHaveBeenCalledWith({ key: 'iclass-integration', enabled: true });
  });

  it('disables the toggle while the mutation is pending', () => {
    mockFlag(false);
    vi.mocked(useSetFeatureFlag).mockReturnValue({ ...idleMutation, isPending: true } as never);

    render(<IClassFlagBody />);
    expect(screen.getByRole('checkbox', { name: /integración con iclass/i })).toBeDisabled();
  });

  it('shows an error banner when the mutation fails', () => {
    mockFlag(true);
    vi.mocked(useSetFeatureFlag).mockReturnValue({ ...idleMutation, isError: true } as never);

    render(<IClassFlagBody />);
    expect(screen.getByText(/no se pudo cambiar el estado/i)).toBeInTheDocument();
  });

  // ── Permission gate (admin.flags) ──────────────────────────────────────

  it('hides the toggle switch when user lacks admin.flags, but the status badge is still visible', () => {
    mockFlag(true);
    mockPerms((p) => !(Array.isArray(p) ? p : [p]).includes('admin.flags'));

    render(<IClassFlagBody />);

    expect(screen.queryByRole('checkbox', { name: /integración con iclass/i })).not.toBeInTheDocument();
    // badge still visible
    expect(screen.getByText('Activa')).toBeInTheDocument();
  });

  it('shows the toggle switch when user has admin.flags', () => {
    mockFlag(false);
    mockPerms(() => true);

    render(<IClassFlagBody />);

    expect(screen.getByRole('checkbox', { name: /integración con iclass/i })).toBeInTheDocument();
  });
});
