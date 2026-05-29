import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/hooks/useFeatureFlags', () => ({
  useFeatureFlag: vi.fn(),
  useSetFeatureFlag: vi.fn(),
}));

import { useFeatureFlag, useSetFeatureFlag } from '@/hooks/useFeatureFlags';
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

describe('IClassClosureFlagBody', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSetFeatureFlag).mockReturnValue(idleMutation as never);
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
});
