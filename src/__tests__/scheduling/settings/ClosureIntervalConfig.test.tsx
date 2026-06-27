import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/hooks/useClosureConfig', () => ({
  useClosureConfig: vi.fn(),
  useUpdateClosureConfig: vi.fn(),
}));
vi.mock('@/hooks/useMyPermissions', () => ({ useMyPermissions: vi.fn() }));

import { useClosureConfig, useUpdateClosureConfig } from '@/hooks/useClosureConfig';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { ClosureIntervalConfig } from '@/pages/scheduling/settings/ClosureIntervalConfig';

const idleMutation = {
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  isSuccess: false,
  reset: vi.fn(),
};

function mockConfig(closureIntervalMs = 300_000, autocompleteIntervalMs = 600_000) {
  vi.mocked(useClosureConfig).mockReturnValue({
    data: { closureIntervalMs, autocompleteIntervalMs },
    isLoading: false,
    isError: false,
  } as never);
}

function mockPerms(canManage: boolean) {
  vi.mocked(useMyPermissions).mockReturnValue({
    user: null,
    roles: [],
    permissions: [],
    isLoading: false,
    isError: false,
    can: () => canManage,
  } as never);
}

describe('ClosureIntervalConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUpdateClosureConfig).mockReturnValue(idleMutation as never);
    mockConfig();
    mockPerms(true);
  });

  // ─── C1: Render ──────────────────────────────────────────────────────────

  it('renders the card title', () => {
    render(<ClosureIntervalConfig />);
    expect(screen.getByText(/frecuencia de los procesos autom/i)).toBeInTheDocument();
  });

  it('renders the closure interval input pre-filled in minutes (300000ms → 5min)', () => {
    mockConfig(300_000, 600_000);
    render(<ClosureIntervalConfig />);
    const input = screen.getByRole('spinbutton', { name: /cierre autom/i });
    expect(input).toHaveValue(5);
  });

  it('renders the autocomplete interval input pre-filled in minutes (600000ms → 10min)', () => {
    mockConfig(300_000, 600_000);
    render(<ClosureIntervalConfig />);
    const input = screen.getByRole('spinbutton', { name: /auto-?completado/i });
    expect(input).toHaveValue(10);
  });

  it('renders the restart-required helper note', () => {
    render(<ClosureIntervalConfig />);
    expect(screen.getByText(/pr.ximo reinicio/i)).toBeInTheDocument();
  });

  it('renders a Save button', () => {
    render(<ClosureIntervalConfig />);
    expect(screen.getByRole('button', { name: /guardar/i })).toBeInTheDocument();
  });

  // ─── C2: Disabled state ───────────────────────────────────────────────────

  it('Save button is disabled when values are unchanged', () => {
    render(<ClosureIntervalConfig />);
    expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled();
  });

  it('Save button becomes enabled after editing a value', () => {
    render(<ClosureIntervalConfig />);
    const input = screen.getByRole('spinbutton', { name: /cierre autom/i });
    fireEvent.change(input, { target: { value: '10' } });
    expect(screen.getByRole('button', { name: /guardar/i })).not.toBeDisabled();
  });

  it('Save button is disabled while mutation is pending', () => {
    vi.mocked(useUpdateClosureConfig).mockReturnValue({ ...idleMutation, isPending: true } as never);
    mockConfig(300_000, 600_000);
    // Manually dirty the state by editing — but even with isPending alone it should be disabled
    render(<ClosureIntervalConfig />);
    expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled();
  });

  // ─── C3: Save calls updateClosureConfig with ms values ───────────────────

  it('clicking Save calls mutate with ms values converted from minutes', () => {
    const mutate = vi.fn();
    vi.mocked(useUpdateClosureConfig).mockReturnValue({ ...idleMutation, mutate } as never);
    mockConfig(300_000, 600_000);

    render(<ClosureIntervalConfig />);

    const closureInput = screen.getByRole('spinbutton', { name: /cierre autom/i });
    fireEvent.change(closureInput, { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    expect(mutate).toHaveBeenCalledWith({
      closureIntervalMs: 900_000,   // 15 * 60000
      autocompleteIntervalMs: 600_000,
    });
  });

  it('converts both fields to ms before calling mutate', () => {
    const mutate = vi.fn();
    vi.mocked(useUpdateClosureConfig).mockReturnValue({ ...idleMutation, mutate } as never);
    mockConfig(300_000, 600_000);

    render(<ClosureIntervalConfig />);

    fireEvent.change(screen.getByRole('spinbutton', { name: /cierre autom/i }), { target: { value: '2' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: /auto-?completado/i }), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    expect(mutate).toHaveBeenCalledWith({
      closureIntervalMs: 120_000,
      autocompleteIntervalMs: 180_000,
    });
  });

  // ─── C4: Validation — minimum 1 minute ────────────────────────────────────

  it('disables Save when closure interval is below 1 minute', () => {
    render(<ClosureIntervalConfig />);
    const input = screen.getByRole('spinbutton', { name: /cierre autom/i });
    fireEvent.change(input, { target: { value: '0' } });
    expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled();
  });

  it('disables Save when autocomplete interval is below 1 minute', () => {
    render(<ClosureIntervalConfig />);
    const input = screen.getByRole('spinbutton', { name: /auto-?completado/i });
    fireEvent.change(input, { target: { value: '0' } });
    expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled();
  });

  // ─── C5: Inline feedback ──────────────────────────────────────────────────

  it('shows a success message after the mutation succeeds', () => {
    vi.mocked(useUpdateClosureConfig).mockReturnValue({ ...idleMutation, isSuccess: true } as never);
    render(<ClosureIntervalConfig />);
    expect(screen.getByText(/guardado/i)).toBeInTheDocument();
  });

  it('shows an error message after the mutation fails', () => {
    vi.mocked(useUpdateClosureConfig).mockReturnValue({ ...idleMutation, isError: true } as never);
    render(<ClosureIntervalConfig />);
    expect(screen.getByText(/no se pudo guardar/i)).toBeInTheDocument();
  });

  // ─── C6: Permission gate ──────────────────────────────────────────────────

  it('renders nothing when the user lacks iclass.manage permission', () => {
    mockPerms(false);
    const { container } = render(<ClosureIntervalConfig />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the card when the user has iclass.manage permission', () => {
    mockPerms(true);
    render(<ClosureIntervalConfig />);
    expect(screen.getByText(/frecuencia de los procesos autom/i)).toBeInTheDocument();
  });

  // ─── C7: Loading / error states ──────────────────────────────────────────

  it('renders a loading placeholder while the config is loading', () => {
    vi.mocked(useClosureConfig).mockReturnValue({ data: undefined, isLoading: true, isError: false } as never);
    render(<ClosureIntervalConfig />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('renders an error banner when the config query fails', () => {
    vi.mocked(useClosureConfig).mockReturnValue({ data: undefined, isLoading: false, isError: true } as never);
    render(<ClosureIntervalConfig />);
    expect(screen.getByText(/no se pudo cargar/i)).toBeInTheDocument();
  });
});
