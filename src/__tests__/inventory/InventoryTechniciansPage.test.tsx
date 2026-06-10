/**
 * Tests for InventoryTechniciansPage (FIX 1 — W5b list nav).
 *
 * Covers:
 * - Renders the table when technicians are returned
 * - Empty state when list is empty
 * - Each row links to /admin/inventory/technicians/:id
 * - Gate: inventory.read — users without it see NoPermissionPage
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Mock hooks ──────────────────────────────────────────────────────────────
vi.mock('@/hooks/useTechnicianList', () => ({
  useTechnicianList: vi.fn(),
}));

vi.mock('@/hooks/useMyPermissions', () => ({
  useMyPermissions: vi.fn(),
}));

vi.mock('@/components/auth/NoPermissionPage', () => ({
  NoPermissionPage: () => <div data-testid="no-permission-page">Sin permiso</div>,
}));

import { useTechnicianList } from '@/hooks/useTechnicianList';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { TechnicianListItemDTO } from '@/types/technicianList';

// ── Helpers ─────────────────────────────────────────────────────────────────

const TWO_TECHNICIANS: TechnicianListItemDTO[] = [
  { id: 'tech-1', name: 'Ana García', assetCount: 3, materialQty: 12 },
  { id: 'tech-2', name: 'Carlos López', assetCount: 0, materialQty: 0 },
];

function mockWithPerm() {
  vi.mocked(useMyPermissions).mockReturnValue({
    user: null,
    roles: [],
    permissions: ['inventory.read'],
    isLoading: false,
    isError: false,
    can: (p: string | string[]) => {
      const arr = Array.isArray(p) ? p : [p];
      return arr.includes('inventory.read');
    },
  });
}

function mockNoPerm() {
  vi.mocked(useMyPermissions).mockReturnValue({
    user: null,
    roles: [],
    permissions: [],
    isLoading: false,
    isError: false,
    can: () => false,
  });
}

function mockList(data: TechnicianListItemDTO[], isLoading = false) {
  vi.mocked(useTechnicianList).mockReturnValue({
    data,
    isLoading,
    isError: false,
  } as ReturnType<typeof useTechnicianList>);
}

import InventoryTechniciansPage from '@/pages/inventory/InventoryTechniciansPage';

function renderPage() {
  return render(
    <MemoryRouter>
      <InventoryTechniciansPage />
    </MemoryRouter>,
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('InventoryTechniciansPage — render with data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWithPerm();
    mockList(TWO_TECHNICIANS);
  });

  it('renders the page title', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /técnicos/i, level: 1 })).toBeInTheDocument();
  });

  it('renders a row for each technician', () => {
    renderPage();
    expect(screen.getByText('Ana García')).toBeInTheDocument();
    expect(screen.getByText('Carlos López')).toBeInTheDocument();
  });

  it('links each row to /admin/inventory/technicians/:id', () => {
    renderPage();
    const link1 = screen.getByRole('link', { name: /ver stock de ana/i });
    expect(link1).toHaveAttribute('href', '/admin/inventory/technicians/tech-1');
    const link2 = screen.getByRole('link', { name: /ver stock de carlos/i });
    expect(link2).toHaveAttribute('href', '/admin/inventory/technicians/tech-2');
  });

  it('shows assetCount and materialQty for each technician', () => {
    renderPage();
    // Ana: 3 equipos, 12 materiales
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });
});

describe('InventoryTechniciansPage — empty state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWithPerm();
    mockList([]);
  });

  it('renders empty state when list is empty', () => {
    renderPage();
    expect(screen.getByText(/sin técnicos/i)).toBeInTheDocument();
  });

  it('does not render a table when list is empty', () => {
    renderPage();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('InventoryTechniciansPage — loading state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWithPerm();
    mockList([], true);
  });

  it('shows loading text while fetching', () => {
    renderPage();
    expect(screen.getByText(/cargando técnicos/i)).toBeInTheDocument();
  });
});

describe('InventoryTechniciansPage — permission gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNoPerm();
    mockList([]);
  });

  it('renders NoPermissionPage when user lacks inventory.read', () => {
    renderPage();
    expect(screen.getByTestId('no-permission-page')).toBeInTheDocument();
  });

  it('does not render the page title when user has no permission', () => {
    renderPage();
    expect(screen.queryByRole('heading', { name: /técnicos/i, level: 1 })).not.toBeInTheDocument();
  });
});
