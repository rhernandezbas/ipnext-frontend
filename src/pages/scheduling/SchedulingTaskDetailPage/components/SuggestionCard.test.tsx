import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SuggestionCard } from './SuggestionCard';
import type { TaskInventorySuggestion } from '@/types/serviceInventory';

// Mock useDeviceTypes so we control the available types
vi.mock('@/hooks/useDeviceTypes', () => ({
  useDeviceTypes: vi.fn(),
}));

import { useDeviceTypes } from '@/hooks/useDeviceTypes';
import type { DeviceType } from '@/types/deviceType';

const makeDeviceType = (name: string, sortOrder: number): DeviceType => ({
  id: `dt-${name}`,
  name,
  label: name,
  active: true,
  sortOrder,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
});

const DEFAULT_TYPES = ['ONU', 'ROUTER', 'ANTENA', 'REPETIDOR', 'OTROS'].map((n, i) =>
  makeDeviceType(n, i + 1),
);

function mockDeviceTypes(types: DeviceType[] = DEFAULT_TYPES) {
  vi.mocked(useDeviceTypes).mockReturnValue({
    data: types,
    isLoading: false,
    isSuccess: true,
  } as unknown as ReturnType<typeof useDeviceTypes>);
}

const sug = (over: Partial<TaskInventorySuggestion> = {}): TaskInventorySuggestion => ({
  id: 's1', taskId: 't1', kind: 'DEVICE', deviceType: 'ONU', qwenDeviceType: null,
  serialNumber: 'SN1', mac: 'AA:BB', materialDesc: null, quantity: null, unit: null,
  source: 'OCR', photoUrl: null, status: 'pending', confirmedItemId: null, ...over,
});

const noop = () => {};

beforeEach(() => {
  vi.clearAllMocks();
  mockDeviceTypes();
});

describe('SuggestionCard', () => {
  it('muestra SN/MAC y el dropdown con el deviceType del label por default', () => {
    render(<SuggestionCard suggestion={sug({ deviceType: 'ONU' })} onConfirm={noop} onDiscard={noop} isPending={false} canWrite />);
    expect(screen.getByText('SN1')).toBeInTheDocument();
    expect(screen.getByText('AA:BB')).toBeInTheDocument();
    expect((screen.getByLabelText('tipo de equipo') as HTMLSelectElement).value).toBe('ONU');
  });

  it('muestra el badge "qwen sugiere" cuando difiere del tipo seleccionado', () => {
    render(<SuggestionCard suggestion={sug({ deviceType: 'ONU', qwenDeviceType: 'ANTENA' })} onConfirm={noop} onDiscard={noop} isPending={false} canWrite />);
    expect(screen.getByText(/qwen sugiere: ANTENA/)).toBeInTheDocument();
  });

  it('oculta el badge cuando qwenDeviceType es igual al tipo', () => {
    render(<SuggestionCard suggestion={sug({ deviceType: 'ANTENA', qwenDeviceType: 'ANTENA' })} onConfirm={noop} onDiscard={noop} isPending={false} canWrite />);
    expect(screen.queryByText(/qwen sugiere/)).toBeNull();
  });

  it('confirma con el tipo elegido tras cambiar el dropdown', async () => {
    const onConfirm = vi.fn();
    render(<SuggestionCard suggestion={sug({ deviceType: 'ONU' })} onConfirm={onConfirm} onDiscard={noop} isPending={false} canWrite />);
    await userEvent.selectOptions(screen.getByLabelText('tipo de equipo'), 'ROUTER');
    await userEvent.click(screen.getByText('Confirmar'));
    expect(onConfirm).toHaveBeenCalledWith('s1', 'ROUTER');
  });

  it('confirma con el deviceType por default si no se cambia el dropdown', async () => {
    const onConfirm = vi.fn();
    render(<SuggestionCard suggestion={sug({ deviceType: 'ANTENA' })} onConfirm={onConfirm} onDiscard={noop} isPending={false} canWrite />);
    await userEvent.click(screen.getByText('Confirmar'));
    expect(onConfirm).toHaveBeenCalledWith('s1', 'ANTENA');
  });

  it('oculta los botones cuando canWrite es false', () => {
    render(<SuggestionCard suggestion={sug()} onConfirm={noop} onDiscard={noop} isPending={false} canWrite={false} />);
    expect(screen.queryByText('Confirmar')).toBeNull();
    expect(screen.queryByText('Descartar')).toBeNull();
  });

  it('falls back to OTROS when deviceType not in catalog and catalog is loaded', () => {
    render(<SuggestionCard suggestion={sug({ deviceType: 'DESCONOCIDO' })} onConfirm={noop} onDiscard={noop} isPending={false} canWrite />);
    // When DESCONOCIDO is not in the catalog, defaults to OTROS
    expect((screen.getByLabelText('tipo de equipo') as HTMLSelectElement).value).toBe('OTROS');
  });

  it('shows all catalog types as options in the dropdown', () => {
    mockDeviceTypes(DEFAULT_TYPES);
    render(<SuggestionCard suggestion={sug()} onConfirm={noop} onDiscard={noop} isPending={false} canWrite />);
    const select = screen.getByLabelText('tipo de equipo') as HTMLSelectElement;
    const options = Array.from(select.options).map(o => o.value);
    expect(options).toContain('ONU');
    expect(options).toContain('ROUTER');
    expect(options).toContain('ANTENA');
    expect(options).toContain('OTROS');
  });
});

describe('SuggestionCard — resuelta (read-only)', () => {
  it('#4 confirmada: mantiene foto + diseño, muestra el tipo confirmado como texto y un badge, sin select ni acciones', () => {
    render(
      <SuggestionCard
        suggestion={sug({ status: 'confirmed', deviceType: 'ANTENA', photoUrl: 'http://x/p.jpg' })}
        onConfirm={noop} onDiscard={noop} isPending={false} canWrite
      />,
    );
    // tipo confirmado como TEXTO (no el ONU original, no un <select>)
    expect(screen.getByText('ANTENA')).toBeInTheDocument();
    expect(screen.queryByLabelText('tipo de equipo')).toBeNull();
    // mantiene la foto/diseño rico
    expect(screen.getByAltText('foto del equipo')).toBeInTheDocument();
    // SN/MAC siguen visibles
    expect(screen.getByText('SN1')).toBeInTheDocument();
    // badge de estado, sin acciones
    expect(screen.getByText(/Confirmado/)).toBeInTheDocument();
    expect(screen.queryByText('Confirmar')).toBeNull();
    expect(screen.queryByText('Descartar')).toBeNull();
  });

  it('#4 confirmada: NO muestra el badge "qwen sugiere" (ya está resuelta)', () => {
    render(
      <SuggestionCard
        suggestion={sug({ status: 'confirmed', deviceType: 'ANTENA', qwenDeviceType: 'ONU' })}
        onConfirm={noop} onDiscard={noop} isPending={false} canWrite
      />,
    );
    expect(screen.queryByText(/qwen sugiere/)).toBeNull();
  });

  it('descartada: muestra badge Descartado y ninguna acción', () => {
    render(
      <SuggestionCard
        suggestion={sug({ status: 'discarded', deviceType: 'ONU' })}
        onConfirm={noop} onDiscard={noop} isPending={false} canWrite
      />,
    );
    expect(screen.getByText(/Descartado/)).toBeInTheDocument();
    expect(screen.queryByText('Confirmar')).toBeNull();
  });

  it('resolved: shows device type from catalog even if originally inactive (legacy data)', () => {
    // Simulate a resolved card with a type that is not in the active catalog
    render(
      <SuggestionCard
        suggestion={sug({ status: 'confirmed', deviceType: 'LEGACY_TYPE' })}
        onConfirm={noop} onDiscard={noop} isPending={false} canWrite
      />,
    );
    // The resolved card renders the raw deviceType string, not looked up in catalog
    expect(screen.getByText('LEGACY_TYPE')).toBeInTheDocument();
  });
});

describe('SuggestionCard — min-data guard (#18)', () => {
  it('DEVICE sin SN ni MAC → "Confirmar" deshabilitado + hint, "Descartar" habilitado', () => {
    render(<SuggestionCard suggestion={sug({ serialNumber: null, mac: null })} onConfirm={noop} onDiscard={noop} isPending={false} canWrite />);
    expect(screen.getByText('Confirmar')).toBeDisabled();
    expect(screen.getByText(/falta sn o mac/i)).toBeInTheDocument();
    expect(screen.getByText('Descartar')).toBeEnabled();
  });

  it('DEVICE con solo MAC → "Confirmar" habilitado', () => {
    render(<SuggestionCard suggestion={sug({ serialNumber: null, mac: 'AABBCCDDEEFF' })} onConfirm={noop} onDiscard={noop} isPending={false} canWrite />);
    expect(screen.getByText('Confirmar')).toBeEnabled();
  });

  it('MATERIAL sin descripción → "Confirmar" deshabilitado + hint', () => {
    render(<SuggestionCard suggestion={sug({ kind: 'MATERIAL', deviceType: null, serialNumber: null, mac: null, materialDesc: null })} onConfirm={noop} onDiscard={noop} isPending={false} canWrite />);
    expect(screen.getByText('Confirmar')).toBeDisabled();
    expect(screen.getByText(/falta.*descripci/i)).toBeInTheDocument();
  });
});
