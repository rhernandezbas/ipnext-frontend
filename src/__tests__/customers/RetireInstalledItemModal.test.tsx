/**
 * RetireInstalledItemModal — TDD suite
 *
 * Covers:
 * 1. Renders as a dialog with the 5 disposition radios (Spanish labels)
 * 2. "Depósito" is selected by default; submit enabled
 * 3. Each disposition submits the right `disposition` in the POST body
 * 4. "Con un técnico" reveals a technician dropdown
 * 5. Submit is disabled until a technician is chosen (TECNICO only)
 * 6. Choosing a technician → submit sends technicianId
 * 7. The optional `note` flows through
 * 8. The 409 ASSET_NOT_INSTALLED shows the clear message + does not close
 * 9. On success → calls onClose
 * 10. Escape / backdrop / Cancelar close without submitting
 */
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ServiceInstalledItem, RetireInstalledItemInput } from '@/types/serviceInventory';
import type { TechnicianListItemDTO } from '@/types/technicianList';
import { AssetNotInstalledError } from '@/api/serviceInventory.api';

// Mock the technician picker hook (reused inventory technician list)
vi.mock('@/hooks/useServiceInventory', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useServiceInventory')>();
  return { ...actual, useInventoryTechnicians: vi.fn() };
});

import { useInventoryTechnicians } from '@/hooks/useServiceInventory';
import { RetireInstalledItemModal } from '@/pages/customers/tabs/contracts/RetireInstalledItemModal';

const item: ServiceInstalledItem = {
  id: 'item-1',
  serviceId: 'ctr-1',
  type: 'ANTENA',
  serialNumber: 'SN-001',
  mac: null,
  model: null,
  source: 'MANUAL',
  sourceTaskId: null,
  addedByUserId: null,
  addedByUserName: null,
  confirmedAt: null,
  status: 'active',
  notes: null,
  createdAt: '2026-06-01T00:00:00.000Z',
};

const technicians: TechnicianListItemDTO[] = [
  { id: 'tech-1', name: 'Ana Técnica', assetCount: 3, materialQty: 12 },
  { id: 'tech-2', name: 'Beto Operario', assetCount: 0, materialQty: 0 },
];

function mockTechs(data: TechnicianListItemDTO[] = technicians, isLoading = false) {
  vi.mocked(useInventoryTechnicians).mockReturnValue({
    data,
    isLoading,
  } as unknown as ReturnType<typeof useInventoryTechnicians>);
}

function renderModal(props: Partial<Parameters<typeof RetireInstalledItemModal>[0]> = {}) {
  const defaults = {
    item,
    saving: false,
    error: null as string | null,
    onRetire: vi.fn().mockResolvedValue(undefined) as (input: RetireInstalledItemInput) => Promise<void>,
    onClose: vi.fn(),
  };
  const merged = { ...defaults, ...props };
  render(<RetireInstalledItemModal {...merged} />);
  return merged;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTechs();
});

describe('RetireInstalledItemModal', () => {
  it('renders as a dialog with the 5 disposition options', () => {
    renderModal();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /depósito/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /con un técnico/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /se lo queda el cliente/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /dañado/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /baja definitiva/i })).toBeInTheDocument();
  });

  it('does NOT show the technician dropdown until "Con un técnico" is selected', () => {
    renderModal();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('submits DEPOSITO by default (no technician, no note)', async () => {
    const user = userEvent.setup();
    const onRetire = vi.fn().mockResolvedValue(undefined);
    renderModal({ onRetire });
    await user.click(screen.getByRole('button', { name: /quitar/i }));
    await waitFor(() => expect(onRetire).toHaveBeenCalledWith({ disposition: 'DEPOSITO' }));
  });

  it('submits CLIENTE when that radio is picked', async () => {
    const user = userEvent.setup();
    const onRetire = vi.fn().mockResolvedValue(undefined);
    renderModal({ onRetire });
    await user.click(screen.getByRole('radio', { name: /se lo queda el cliente/i }));
    await user.click(screen.getByRole('button', { name: /quitar/i }));
    await waitFor(() => expect(onRetire).toHaveBeenCalledWith({ disposition: 'CLIENTE' }));
  });

  it('submits DAMAGED when "Dañado" is picked', async () => {
    const user = userEvent.setup();
    const onRetire = vi.fn().mockResolvedValue(undefined);
    renderModal({ onRetire });
    await user.click(screen.getByRole('radio', { name: /dañado/i }));
    await user.click(screen.getByRole('button', { name: /quitar/i }));
    await waitFor(() => expect(onRetire).toHaveBeenCalledWith({ disposition: 'DAMAGED' }));
  });

  it('submits RETIRED when "Baja definitiva" is picked', async () => {
    const user = userEvent.setup();
    const onRetire = vi.fn().mockResolvedValue(undefined);
    renderModal({ onRetire });
    await user.click(screen.getByRole('radio', { name: /baja definitiva/i }));
    await user.click(screen.getByRole('button', { name: /quitar/i }));
    await waitFor(() => expect(onRetire).toHaveBeenCalledWith({ disposition: 'RETIRED' }));
  });

  it('"Con un técnico" reveals a technician dropdown', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole('radio', { name: /con un técnico/i }));
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /ana técnica/i })).toBeInTheDocument();
  });

  it('submit is DISABLED while TECNICO is selected but no technician chosen', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole('radio', { name: /con un técnico/i }));
    expect(screen.getByRole('button', { name: /quitar/i })).toBeDisabled();
  });

  it('submit becomes ENABLED once a technician is chosen, and sends technicianId', async () => {
    const user = userEvent.setup();
    const onRetire = vi.fn().mockResolvedValue(undefined);
    renderModal({ onRetire });
    await user.click(screen.getByRole('radio', { name: /con un técnico/i }));
    await user.selectOptions(screen.getByRole('combobox'), 'tech-2');
    const submit = screen.getByRole('button', { name: /quitar/i });
    expect(submit).toBeEnabled();
    await user.click(submit);
    await waitFor(() =>
      expect(onRetire).toHaveBeenCalledWith({ disposition: 'TECNICO', technicianId: 'tech-2' }),
    );
  });

  it('does NOT send technicianId when switching away from TECNICO', async () => {
    const user = userEvent.setup();
    const onRetire = vi.fn().mockResolvedValue(undefined);
    renderModal({ onRetire });
    await user.click(screen.getByRole('radio', { name: /con un técnico/i }));
    await user.selectOptions(screen.getByRole('combobox'), 'tech-1');
    await user.click(screen.getByRole('radio', { name: /depósito/i }));
    await user.click(screen.getByRole('button', { name: /quitar/i }));
    await waitFor(() => expect(onRetire).toHaveBeenCalledWith({ disposition: 'DEPOSITO' }));
    const lastCall = onRetire.mock.calls.at(-1)?.[0];
    expect(lastCall).not.toHaveProperty('technicianId');
  });

  it('flows the optional note through', async () => {
    const user = userEvent.setup();
    const onRetire = vi.fn().mockResolvedValue(undefined);
    renderModal({ onRetire });
    await user.type(screen.getByRole('textbox', { name: /nota/i }), 'lo lleva el técnico mañana');
    await user.click(screen.getByRole('button', { name: /quitar/i }));
    await waitFor(() =>
      expect(onRetire).toHaveBeenCalledWith({ disposition: 'DEPOSITO', note: 'lo lleva el técnico mañana' }),
    );
  });

  it('omits an empty/whitespace note', async () => {
    const user = userEvent.setup();
    const onRetire = vi.fn().mockResolvedValue(undefined);
    renderModal({ onRetire });
    await user.type(screen.getByRole('textbox', { name: /nota/i }), '   ');
    await user.click(screen.getByRole('button', { name: /quitar/i }));
    await waitFor(() => expect(onRetire).toHaveBeenCalledWith({ disposition: 'DEPOSITO' }));
    const lastCall = onRetire.mock.calls.at(-1)?.[0];
    expect(lastCall).not.toHaveProperty('note');
  });

  it('on success calls onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal({ onRetire: vi.fn().mockResolvedValue(undefined), onClose });
    await user.click(screen.getByRole('button', { name: /quitar/i }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('on a 409 ASSET_NOT_INSTALLED shows the clear message and does NOT close', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onRetire = vi.fn().mockRejectedValue(new AssetNotInstalledError());
    renderModal({ onRetire, onClose });
    await user.click(screen.getByRole('button', { name: /quitar/i }));
    expect(await screen.findByText(/ya no figura instalado/i)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows a generic message on a non-409 failure', async () => {
    const user = userEvent.setup();
    const onRetire = vi.fn().mockRejectedValue(new Error('boom'));
    renderModal({ onRetire });
    await user.click(screen.getByRole('button', { name: /quitar/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('renders the `error` prop in an alert banner', () => {
    renderModal({ error: 'No se pudo quitar el equipo.' });
    expect(screen.getByRole('alert')).toHaveTextContent(/no se pudo quitar/i);
  });

  it('Cancelar closes without submitting', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onRetire = vi.fn();
    renderModal({ onClose, onRetire });
    await user.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onRetire).not.toHaveBeenCalled();
  });

  it('Escape closes the modal', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('backdrop click closes the modal', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('disables submit while saving', () => {
    renderModal({ saving: true });
    expect(screen.getByRole('button', { name: /quitando|quitar/i })).toBeDisabled();
  });
});
