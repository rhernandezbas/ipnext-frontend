import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TicketHeader } from '@/pages/tickets/TicketDetailPage/components/TicketHeader';
import type { Ticket } from '@/types/ticket';

vi.mock('@/hooks/useMyPermissions');
vi.mock('@/hooks/useTicketStatuses');

import * as useMyPermissionsModule from '@/hooks/useMyPermissions';
import * as useTicketStatusesModule from '@/hooks/useTicketStatuses';

const mockStatuses = [
  { id: '1', name: 'abierto', color: '#22c55e', weight: 1 },
  { id: '2', name: 'cerrado', color: '#6b7280', weight: 2 },
];

const mockTicket: Ticket = {
  id: 42,
  subject: 'Falla de luz',
  description: 'Sin servicio',
  status: 'abierto',
  priority: 'high',
  type: null,
  customerId: 7,
  customerName: 'Empresa SA',
  assigneeId: null,
  assigneeName: null,
  reporter: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-02T00:00:00Z',
  resolvedAt: null,
  tags: [],
};

function renderHeader(overrides: {
  ticket?: Partial<Ticket>;
  onSubjectSave?: () => Promise<void>;
  onStatusChange?: (status: string) => Promise<void>;
  onClose?: () => void;
  onDelete?: () => void;
  onCreateTask?: () => void;
  isSaving?: boolean;
} = {}) {
  const ticket = { ...mockTicket, ...overrides.ticket } as Ticket;
  return render(
    <MemoryRouter>
      <TicketHeader
        ticket={ticket}
        onSubjectSave={overrides.onSubjectSave ?? vi.fn().mockResolvedValue(undefined)}
        onStatusChange={overrides.onStatusChange ?? vi.fn().mockResolvedValue(undefined)}
        onClose={overrides.onClose ?? vi.fn()}
        onDelete={overrides.onDelete ?? vi.fn()}
        onCreateTask={overrides.onCreateTask ?? vi.fn()}
        isSaving={overrides.isSaving ?? false}
      />
    </MemoryRouter>
  );
}

describe('TicketHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useTicketStatusesModule.useTicketStatuses).mockReturnValue({
      data: mockStatuses,
      isLoading: false,
    } as ReturnType<typeof useTicketStatusesModule.useTicketStatuses>);
    vi.mocked(useMyPermissionsModule.useMyPermissions).mockReturnValue({
      can: vi.fn().mockReturnValue(true),
      permissions: ['tickets.close', 'tickets.delete', 'scheduling.write', 'tickets.write'],
      isLoading: false,
    } as ReturnType<typeof useMyPermissionsModule.useMyPermissions>);
  });

  it('renders breadcrumb with ticket id', () => {
    renderHeader();
    expect(screen.getByText(/soporte.*tickets.*42/i)).toBeInTheDocument();
  });

  it('renders ticket subject', () => {
    renderHeader();
    expect(screen.getByText('Falla de luz')).toBeInTheDocument();
  });

  it('renders kebab menu button', () => {
    renderHeader();
    expect(screen.getByRole('button', { name: /acciones/i })).toBeInTheDocument();
  });

  it('kebab menu opens when clicked', () => {
    renderHeader();
    fireEvent.click(screen.getByRole('button', { name: /acciones/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  // ── Cerrar ticket ─────────────────────────────────────────────────────────
  it('shows "Cerrar ticket" when user has tickets.close and status is not closed', () => {
    renderHeader();
    fireEvent.click(screen.getByRole('button', { name: /acciones/i }));
    expect(screen.getByRole('menuitem', { name: /cerrar ticket/i })).toBeInTheDocument();
  });

  it('hides "Cerrar ticket" when user lacks tickets.close', () => {
    vi.mocked(useMyPermissionsModule.useMyPermissions).mockReturnValue({
      can: vi.fn().mockImplementation((perms: string[]) => !perms.includes('tickets.close')),
      permissions: [],
      isLoading: false,
    } as ReturnType<typeof useMyPermissionsModule.useMyPermissions>);
    renderHeader();
    fireEvent.click(screen.getByRole('button', { name: /acciones/i }));
    expect(screen.queryByRole('menuitem', { name: /cerrar ticket/i })).not.toBeInTheDocument();
  });

  it('hides "Cerrar ticket" when status is already "cerrado"', () => {
    renderHeader({ ticket: { status: 'cerrado' } });
    fireEvent.click(screen.getByRole('button', { name: /acciones/i }));
    expect(screen.queryByRole('menuitem', { name: /cerrar ticket/i })).not.toBeInTheDocument();
  });

  it('hides "Cerrar ticket" when status is "closed"', () => {
    renderHeader({ ticket: { status: 'closed' } });
    fireEvent.click(screen.getByRole('button', { name: /acciones/i }));
    expect(screen.queryByRole('menuitem', { name: /cerrar ticket/i })).not.toBeInTheDocument();
  });

  // ── Crear tarea ───────────────────────────────────────────────────────────
  it('shows "Crear tarea" when user has scheduling.write', () => {
    renderHeader();
    fireEvent.click(screen.getByRole('button', { name: /acciones/i }));
    expect(screen.getByRole('menuitem', { name: /crear tarea/i })).toBeInTheDocument();
  });

  it('hides "Crear tarea" when user lacks scheduling.write', () => {
    vi.mocked(useMyPermissionsModule.useMyPermissions).mockReturnValue({
      can: vi.fn().mockImplementation((perms: string[]) => !perms.includes('scheduling.write')),
      permissions: [],
      isLoading: false,
    } as ReturnType<typeof useMyPermissionsModule.useMyPermissions>);
    renderHeader();
    fireEvent.click(screen.getByRole('button', { name: /acciones/i }));
    expect(screen.queryByRole('menuitem', { name: /crear tarea/i })).not.toBeInTheDocument();
  });

  // ── Eliminar ──────────────────────────────────────────────────────────────
  it('shows "Eliminar" when user has tickets.delete', () => {
    renderHeader();
    fireEvent.click(screen.getByRole('button', { name: /acciones/i }));
    expect(screen.getByRole('menuitem', { name: /eliminar/i })).toBeInTheDocument();
  });

  it('hides "Eliminar" when user lacks tickets.delete', () => {
    vi.mocked(useMyPermissionsModule.useMyPermissions).mockReturnValue({
      can: vi.fn().mockImplementation((perms: string[]) => !perms.includes('tickets.delete')),
      permissions: [],
      isLoading: false,
    } as ReturnType<typeof useMyPermissionsModule.useMyPermissions>);
    renderHeader();
    fireEvent.click(screen.getByRole('button', { name: /acciones/i }));
    expect(screen.queryByRole('menuitem', { name: /eliminar/i })).not.toBeInTheDocument();
  });

  // ── Callbacks ─────────────────────────────────────────────────────────────
  it('calls onClose when "Cerrar ticket" is clicked', () => {
    const onClose = vi.fn();
    renderHeader({ onClose });
    fireEvent.click(screen.getByRole('button', { name: /acciones/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /cerrar ticket/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onDelete when "Eliminar" is clicked', () => {
    const onDelete = vi.fn();
    renderHeader({ onDelete });
    fireEvent.click(screen.getByRole('button', { name: /acciones/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /eliminar/i }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('calls onCreateTask when "Crear tarea" is clicked', () => {
    const onCreateTask = vi.fn();
    renderHeader({ onCreateTask });
    fireEvent.click(screen.getByRole('button', { name: /acciones/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /crear tarea/i }));
    expect(onCreateTask).toHaveBeenCalledTimes(1);
  });

  // ── StatusSelect catalog-driven ───────────────────────────────────────────
  it('renders StatusSelect with catalog options', () => {
    renderHeader();
    const select = screen.getByRole('combobox', { name: /estado/i });
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'abierto' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'cerrado' })).toBeInTheDocument();
  });

  // ── Reopen gate (origin rule preserved) ───────────────────────────────────
  it('disables reopening (non-closed options) when ticket is closed and user lacks tickets.reopen', () => {
    vi.mocked(useMyPermissionsModule.useMyPermissions).mockReturnValue({
      can: vi.fn().mockImplementation((perms: string[]) => !perms.includes('tickets.reopen')),
      permissions: [],
      isLoading: false,
    } as ReturnType<typeof useMyPermissionsModule.useMyPermissions>);
    renderHeader({ ticket: { status: 'cerrado' } });
    // The non-closed option ("abierto") must be disabled — no reopen permission.
    expect(screen.getByRole('option', { name: 'abierto' })).toBeDisabled();
    // The closed option stays enabled.
    expect(screen.getByRole('option', { name: 'cerrado' })).not.toBeDisabled();
  });

  it('allows reopening (non-closed options enabled) when user has tickets.reopen', () => {
    vi.mocked(useMyPermissionsModule.useMyPermissions).mockReturnValue({
      can: vi.fn().mockReturnValue(true),
      permissions: ['tickets.reopen', 'tickets.write'],
      isLoading: false,
    } as ReturnType<typeof useMyPermissionsModule.useMyPermissions>);
    renderHeader({ ticket: { status: 'cerrado' } });
    expect(screen.getByRole('option', { name: 'abierto' })).not.toBeDisabled();
  });
});
