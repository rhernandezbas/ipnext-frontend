import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mocks BEFORE imports del código bajo test
vi.mock('@/hooks/useIClassStatusCatalog', () => ({
  useIClassStatusCatalog: vi.fn(),
  useSyncIClassStatuses: vi.fn(),
  useUpdateIClassStatus: vi.fn(),
}));

// NOTE: useMyPermissions is already mocked globally in setup.ts (grants '*').
// Per-suite overrides use vi.mocked(useMyPermissions).mockReturnValue(...) — NO dynamic import.
import { useMyPermissions } from '@/hooks/useMyPermissions';
import {
  useIClassStatusCatalog,
  useSyncIClassStatuses,
  useUpdateIClassStatus,
} from '@/hooks/useIClassStatusCatalog';
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
    lastSyncedAt: '2026-06-01T00:00:00Z',
  },
  {
    statusCode: 'PENDIENTE',
    iclassLabel: 'Pendiente',
    displayLabel: null,
    effectiveLabel: 'Pendiente',
    color: null,
    tracked: false,
    lastSyncedAt: '2026-06-01T00:00:00Z',
  },
];

function mockData(entries: typeof ENTRIES | undefined = ENTRIES, loading = false) {
  vi.mocked(useIClassStatusCatalog).mockReturnValue({
    data: loading ? undefined : entries,
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
