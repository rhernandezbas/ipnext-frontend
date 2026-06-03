/**
 * SuggestionCard — B4 editor gating tests + B5 match badge tests.
 * Strict TDD: these are written BEFORE the implementation.
 *
 * Permission mock strategy:
 * - setup.ts globally mocks useMyPermissions to grant all (can → true).
 * - Tests that need to assert DENIAL override via vi.mocked(useMyPermissions).mockReturnValue(...)
 *
 * useDeviceTypes mock:
 * - Mocked at the module level to return a stable list without network.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { TaskInventorySuggestion } from '@/types/serviceInventory';

// ── Mock useDeviceTypes ─────────────────────────────────────────────────────
vi.mock('@/hooks/useDeviceTypes', () => ({
  useDeviceTypes: vi.fn(() => ({
    data: [
      { id: 'dt-1', name: 'ONU', label: 'Óptico', active: true, sortOrder: 1, createdAt: '', updatedAt: '' },
      { id: 'dt-2', name: 'ANTENA', label: 'Antena', active: true, sortOrder: 2, createdAt: '', updatedAt: '' },
      { id: 'dt-3', name: 'ROUTER', label: 'Router', active: true, sortOrder: 3, createdAt: '', updatedAt: '' },
    ],
    isLoading: false,
  })),
}));

// useMyPermissions is already mocked by setup.ts (grants all by default).
import { useMyPermissions } from '@/hooks/useMyPermissions';

import { SuggestionCard } from '@/pages/scheduling/SchedulingTaskDetailPage/components/SuggestionCard';

// ── Fixture builders ─────────────────────────────────────────────────────────
function makeConfirmedDevice(over: Partial<TaskInventorySuggestion> = {}): TaskInventorySuggestion {
  return {
    id: 'sug-1',
    taskId: 'task-1',
    kind: 'DEVICE',
    deviceType: 'ONU',
    qwenDeviceType: null,
    serialNumber: 'SN-001',
    mac: null,
    materialDesc: null,
    quantity: null,
    unit: null,
    source: 'OCR',
    photoUrl: null,
    status: 'confirmed',
    confirmedItemId: 'item-1',
    ...over,
  };
}

function makePendingDevice(over: Partial<TaskInventorySuggestion> = {}): TaskInventorySuggestion {
  return {
    id: 'sug-2',
    taskId: 'task-1',
    kind: 'DEVICE',
    deviceType: 'ONU',
    qwenDeviceType: null,
    serialNumber: 'SN-002',
    mac: null,
    materialDesc: null,
    quantity: null,
    unit: null,
    source: 'OCR',
    photoUrl: null,
    status: 'pending',
    confirmedItemId: null,
    ...over,
  };
}

const noop = () => {};

// ── B4 — Editor gating tests ─────────────────────────────────────────────────
describe('SuggestionCard — type editor (B4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-apply default: grants all permissions
    vi.mocked(useMyPermissions).mockReturnValue({
      permissions: ['*'],
      roles: [],
      user: null,
      isLoading: false,
      isError: false,
      can: () => true,
    });
  });

  it('renders edit-type control when user has inventory.manage (confirmed DEVICE)', async () => {
    render(
      <SuggestionCard
        suggestion={makeConfirmedDevice()}
        onConfirm={noop}
        onDiscard={noop}
        isPending={false}
        canWrite={true}
      />,
    );

    // The editor should be visible: either a select for type editing or a button to enter edit mode
    // After Can(inventory.manage) grants access, an edit control must be present
    await waitFor(() => {
      const editBtn = screen.queryByRole('button', { name: /editar tipo/i })
        ?? screen.queryByLabelText(/editar tipo/i)
        ?? screen.queryByRole('combobox', { name: /tipo de equipo/i });
      expect(editBtn).not.toBeNull();
    });
  });

  it('does NOT render edit-type control without inventory.manage (confirmed DEVICE)', async () => {
    vi.mocked(useMyPermissions).mockReturnValue({
      permissions: [],
      roles: [],
      user: null,
      isLoading: false,
      isError: false,
      can: () => false,
    });

    render(
      <SuggestionCard
        suggestion={makeConfirmedDevice()}
        onConfirm={noop}
        onDiscard={noop}
        isPending={false}
        canWrite={false}
      />,
    );

    await waitFor(() => {
      // Static span must still be present
      expect(screen.getByText('ONU')).toBeInTheDocument();
    });

    // No edit button should exist
    expect(screen.queryByRole('button', { name: /editar tipo/i })).toBeNull();
    expect(screen.queryByLabelText(/editar tipo/i)).toBeNull();
  });

  it('onCorrectType callback called with (id, selectedType) on Guardar', async () => {
    const user = userEvent.setup();
    const onCorrectType = vi.fn();

    render(
      <SuggestionCard
        suggestion={makeConfirmedDevice()}
        onConfirm={noop}
        onDiscard={noop}
        isPending={false}
        canWrite={true}
        onCorrectType={onCorrectType}
      />,
    );

    // Click "Editar tipo" button to enter edit mode
    const editBtn = await screen.findByRole('button', { name: /editar tipo/i });
    await user.click(editBtn);

    // Now a select and Guardar button should be visible
    const select = await screen.findByRole('combobox', { name: /tipo de equipo/i });
    await user.selectOptions(select, 'ANTENA');

    const guardarBtn = screen.getByRole('button', { name: /guardar/i });
    await user.click(guardarBtn);

    expect(onCorrectType).toHaveBeenCalledWith('sug-1', 'ANTENA');
  });

  it('isCorrecting=true disables the Guardar button / shows loading state', async () => {
    const user = userEvent.setup();

    render(
      <SuggestionCard
        suggestion={makeConfirmedDevice()}
        onConfirm={noop}
        onDiscard={noop}
        isPending={false}
        canWrite={true}
        onCorrectType={vi.fn()}
        isCorrecting={true}
      />,
    );

    // Enter edit mode first
    const editBtn = await screen.findByRole('button', { name: /editar tipo/i });
    await user.click(editBtn);

    // Guardar should be disabled
    const guardarBtn = await screen.findByRole('button', { name: /guardar/i });
    expect(guardarBtn).toBeDisabled();
  });
});

// ── B5 — Button-by-match table tests ─────────────────────────────────────────
describe('SuggestionCard — button-by-match (B5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useMyPermissions).mockReturnValue({
      permissions: ['*'],
      roles: [],
      user: null,
      isLoading: false,
      isError: false,
      can: () => true,
    });
  });

  it('same_device → shows "Marcar como ya instalado" and "Descartar", NO "Confirmar"', () => {
    const onLinkExisting = vi.fn();
    const onDiscard = vi.fn();

    render(
      <SuggestionCard
        suggestion={makePendingDevice({ match: { status: 'same_device', itemId: 'item-1', serial: null } })}
        onConfirm={noop}
        onLinkExisting={onLinkExisting}
        onDiscard={onDiscard}
        isPending={false}
        canWrite={true}
      />,
    );

    expect(screen.getByRole('button', { name: /marcar como ya instalado/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /descartar/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^confirmar$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /agregar/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /reemplazar/i })).toBeNull();
  });

  it('same_device → "Marcar como ya instalado" calls onLinkExisting with suggestionId', async () => {
    const user = userEvent.setup();
    const onLinkExisting = vi.fn();

    render(
      <SuggestionCard
        suggestion={makePendingDevice({ id: 'sug-link', match: { status: 'same_device', itemId: 'item-1', serial: null } })}
        onConfirm={noop}
        onLinkExisting={onLinkExisting}
        onDiscard={noop}
        isPending={false}
        canWrite={true}
      />,
    );

    await user.click(screen.getByRole('button', { name: /marcar como ya instalado/i }));
    expect(onLinkExisting).toHaveBeenCalledWith('sug-link');
  });

  it('same_type → shows "Agregar", "Reemplazar la actual" (with inventory.write), and "Descartar"', () => {
    render(
      <SuggestionCard
        suggestion={makePendingDevice({ match: { status: 'same_type', itemId: 'item-2', serial: null } })}
        onConfirm={noop}
        onReplace={vi.fn()}
        onDiscard={noop}
        isPending={false}
        canWrite={true}
      />,
    );

    expect(screen.getByRole('button', { name: /^agregar$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reemplazar la actual/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /descartar/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^confirmar$/i })).toBeNull();
  });

  it('same_type → "Agregar" calls onConfirm (resolution:add) with id+type', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <SuggestionCard
        suggestion={makePendingDevice({ id: 'sug-add', match: { status: 'same_type', itemId: 'item-2', serial: null } })}
        onConfirm={onConfirm}
        onReplace={vi.fn()}
        onDiscard={noop}
        isPending={false}
        canWrite={true}
      />,
    );

    await user.click(screen.getByRole('button', { name: /^agregar$/i }));
    expect(onConfirm).toHaveBeenCalledWith('sug-add', 'ONU');
  });

  it('same_type → "Reemplazar la actual" calls onReplace with id+type', async () => {
    const user = userEvent.setup();
    const onReplace = vi.fn();

    render(
      <SuggestionCard
        suggestion={makePendingDevice({ id: 'sug-replace', match: { status: 'same_type', itemId: 'item-2', serial: null } })}
        onConfirm={noop}
        onReplace={onReplace}
        onDiscard={noop}
        isPending={false}
        canWrite={true}
      />,
    );

    await user.click(screen.getByRole('button', { name: /reemplazar la actual/i }));
    expect(onReplace).toHaveBeenCalledWith('sug-replace', 'ONU');
  });

  it('same_type → "Reemplazar la actual" hidden when user lacks inventory.write', () => {
    vi.mocked(useMyPermissions).mockReturnValue({
      permissions: [],
      roles: [],
      user: null,
      isLoading: false,
      isError: false,
      can: () => false,
    });

    render(
      <SuggestionCard
        suggestion={makePendingDevice({ match: { status: 'same_type', itemId: 'item-2', serial: null } })}
        onConfirm={noop}
        onReplace={vi.fn()}
        onDiscard={noop}
        isPending={false}
        canWrite={false}
      />,
    );

    // "Reemplazar la actual" is hidden (no inventory.write)
    expect(screen.queryByRole('button', { name: /reemplazar la actual/i })).toBeNull();
    // "Agregar" also hidden (canWrite=false)
    expect(screen.queryByRole('button', { name: /^agregar$/i })).toBeNull();
  });

  it('no match (undefined) → shows "Confirmar" + "Descartar" (graceful degrade)', () => {
    const suggestion = makePendingDevice();
    delete (suggestion as Partial<typeof suggestion & { match?: unknown }>).match;

    render(
      <SuggestionCard
        suggestion={suggestion}
        onConfirm={noop}
        onDiscard={noop}
        isPending={false}
        canWrite={true}
      />,
    );

    expect(screen.getByRole('button', { name: /^confirmar$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /descartar/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /marcar como ya instalado/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /agregar/i })).toBeNull();
  });

  it('match=null → shows "Confirmar" + "Descartar" (graceful degrade)', () => {
    render(
      <SuggestionCard
        suggestion={makePendingDevice({ match: null })}
        onConfirm={noop}
        onDiscard={noop}
        isPending={false}
        canWrite={true}
      />,
    );

    expect(screen.getByRole('button', { name: /^confirmar$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /descartar/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /marcar como ya instalado/i })).toBeNull();
  });
});

// ── B5 — Match badge tests ────────────────────────────────────────────────────
describe('SuggestionCard — match badge (B5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useMyPermissions).mockReturnValue({
      permissions: ['*'],
      roles: [],
      user: null,
      isLoading: false,
      isError: false,
      can: () => true,
    });
  });

  it('same_device → warning badge "Ya instalado: el mismo equipo" visible', () => {
    const suggestion = makePendingDevice({
      match: { status: 'same_device', itemId: 'item-1', serial: null },
    });

    render(
      <SuggestionCard
        suggestion={suggestion}
        onConfirm={noop}
        onDiscard={noop}
        isPending={false}
        canWrite={true}
      />,
    );

    expect(screen.getByText(/Ya instalado: el mismo equipo/i)).toBeInTheDocument();
  });

  it('same_device with serial → badge includes serial number', () => {
    const suggestion = makePendingDevice({
      match: { status: 'same_device', itemId: 'item-1', serial: 'SN-ABC-123' },
    });

    render(
      <SuggestionCard
        suggestion={suggestion}
        onConfirm={noop}
        onDiscard={noop}
        isPending={false}
        canWrite={true}
      />,
    );

    expect(screen.getByText(/SN-ABC-123/)).toBeInTheDocument();
  });

  it('same_type with deviceType=ONU → info badge "Ya hay un/a ONU" visible', () => {
    const suggestion = makePendingDevice({
      deviceType: 'ONU',
      match: { status: 'same_type', itemId: 'item-2', serial: null },
    });

    render(
      <SuggestionCard
        suggestion={suggestion}
        onConfirm={noop}
        onDiscard={noop}
        isPending={false}
        canWrite={true}
      />,
    );

    expect(screen.getByText(/Ya hay un\/a ONU/i)).toBeInTheDocument();
  });

  it('match=null → no badge rendered', () => {
    const suggestion = makePendingDevice({ match: null });

    render(
      <SuggestionCard
        suggestion={suggestion}
        onConfirm={noop}
        onDiscard={noop}
        isPending={false}
        canWrite={true}
      />,
    );

    expect(screen.queryByText(/Ya instalado/i)).toBeNull();
    expect(screen.queryByText(/Ya hay un\/a/i)).toBeNull();
  });

  it('match field absent (undefined) → no badge (graceful degradation, spec CC-2)', () => {
    // TaskInventorySuggestion without match field (old BE response)
    const suggestion = makePendingDevice();
    // Ensure match is not set
    delete (suggestion as Partial<TaskInventorySuggestion & { match?: unknown }>).match;

    render(
      <SuggestionCard
        suggestion={suggestion}
        onConfirm={noop}
        onDiscard={noop}
        isPending={false}
        canWrite={true}
      />,
    );

    expect(screen.queryByText(/Ya instalado/i)).toBeNull();
    expect(screen.queryByText(/Ya hay un\/a/i)).toBeNull();
  });

  it('same_device badge also shows in the confirmed (resolved) variant', () => {
    const suggestion = makeConfirmedDevice({
      match: { status: 'same_device', itemId: 'item-1', serial: null },
    });

    render(
      <SuggestionCard
        suggestion={suggestion}
        onConfirm={noop}
        onDiscard={noop}
        isPending={false}
        canWrite={false}
      />,
    );

    expect(screen.getByText(/Ya instalado: el mismo equipo/i)).toBeInTheDocument();
  });
});
