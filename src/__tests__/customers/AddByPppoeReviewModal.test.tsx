/**
 * AddByPppoeReviewModal — TDD suite
 *
 * Covers:
 * 1. Renders antenna + router data from inspect result
 * 2. Antenna model is editable (pre-filled)
 * 3. Router brand/model is editable (pre-filled)
 * 4. Warnings are shown in a status banner
 * 5. router=null → shows "no se detectó router" note, only antenna addable
 * 6. model=null → empty editable field (no crash)
 * 7. Toggling antenna off excludes it from the add calls
 * 8. Toggling router off excludes it from the add calls
 * 9. "Agregar equipos" calls onCreate for each included device with {type, mac, model}
 * 10. Cancelar → no add calls
 * 11. Escape closes the modal (calls onClose)
 * 12. Backdrop click calls onClose
 */
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { InspectPppoeDevicesResult } from '@/types/serviceInventory';
import { AddByPppoeReviewModal } from '@/pages/customers/tabs/contracts/AddByPppoeReviewModal';

const fullResult: InspectPppoeDevicesResult = {
  antenna: { mac: 'AA:BB:CC:DD:EE:01', model: 'Mimosa C5x' },
  router: { mac: 'AA:BB:CC:DD:EE:02', brand: 'TP-Link' },
  warnings: [],
};

const resultWithWarnings: InspectPppoeDevicesResult = {
  antenna: { mac: 'AA:BB:CC:DD:EE:01', model: null },
  router: { mac: 'AA:BB:CC:DD:EE:02', brand: 'Mikrotik' },
  warnings: ['No se pudo entrar a la antena (offline)'],
};

const noRouterResult: InspectPppoeDevicesResult = {
  antenna: { mac: 'AA:BB:CC:DD:EE:01', model: 'Mimosa' },
  router: null,
  warnings: [],
};

function renderModal(props: Partial<Parameters<typeof AddByPppoeReviewModal>[0]> = {}) {
  const defaults = {
    contractId: 'ctr-1',
    result: fullResult,
    onClose: vi.fn(),
    onCreate: vi.fn().mockResolvedValue(undefined),
  };
  return render(<AddByPppoeReviewModal {...defaults} {...props} />);
}

describe('AddByPppoeReviewModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders as a dialog with antenna mac visible', () => {
    renderModal();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('AA:BB:CC:DD:EE:01')).toBeInTheDocument();
  });

  it('renders router mac visible', () => {
    renderModal();
    expect(screen.getByText('AA:BB:CC:DD:EE:02')).toBeInTheDocument();
  });

  it('antenna model is pre-filled and editable', async () => {
    const user = userEvent.setup();
    renderModal();
    const modelInput = screen.getByLabelText(/modelo.*antena/i);
    expect(modelInput).toHaveValue('Mimosa C5x');
    await user.clear(modelInput);
    await user.type(modelInput, 'Cambio');
    expect(modelInput).toHaveValue('Cambio');
  });

  it('router brand/model is pre-filled and editable', async () => {
    const user = userEvent.setup();
    renderModal();
    const brandInput = screen.getByLabelText(/modelo.*router/i);
    expect(brandInput).toHaveValue('TP-Link');
    await user.clear(brandInput);
    await user.type(brandInput, 'Huawei');
    expect(brandInput).toHaveValue('Huawei');
  });

  it('shows warnings in a status banner', () => {
    renderModal({ result: resultWithWarnings });
    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent('No se pudo entrar a la antena (offline)');
  });

  it('does NOT show a warnings banner when warnings is empty', () => {
    renderModal();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('model=null → empty editable field, no crash', () => {
    renderModal({ result: resultWithWarnings });
    // antenna model is null in resultWithWarnings
    const modelInput = screen.getByLabelText(/modelo.*antena/i);
    expect(modelInput).toHaveValue('');
  });

  it('router=null → shows "no se detectó router" note', () => {
    renderModal({ result: noRouterResult });
    expect(screen.getByText(/no se detectó router/i)).toBeInTheDocument();
  });

  it('router=null → router toggle/fields are not present', () => {
    renderModal({ result: noRouterResult });
    expect(screen.queryByLabelText(/modelo.*router/i)).not.toBeInTheDocument();
  });

  it('"Agregar equipos" calls onCreate for antenna and router with correct type/mac/model', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);
    renderModal({ onCreate });
    await user.click(screen.getByRole('button', { name: /agregar equipos/i }));
    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith({ type: 'ANTENA', mac: 'AA:BB:CC:DD:EE:01', model: 'Mimosa C5x' });
      expect(onCreate).toHaveBeenCalledWith({ type: 'ROUTER', mac: 'AA:BB:CC:DD:EE:02', model: 'TP-Link' });
    });
  });

  it('toggling antenna off excludes it from add calls', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);
    renderModal({ onCreate });
    // Uncheck antenna
    const antennaCheckbox = screen.getByRole('checkbox', { name: /antena/i });
    await user.click(antennaCheckbox);
    await user.click(screen.getByRole('button', { name: /agregar equipos/i }));
    await waitFor(() => {
      expect(onCreate).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'ANTENA' }));
      expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ type: 'ROUTER' }));
    });
  });

  it('toggling router off excludes it from add calls', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);
    renderModal({ onCreate });
    const routerCheckbox = screen.getByRole('checkbox', { name: /router/i });
    await user.click(routerCheckbox);
    await user.click(screen.getByRole('button', { name: /agregar equipos/i }));
    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ type: 'ANTENA' }));
      expect(onCreate).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'ROUTER' }));
    });
  });

  it('uses the edited model value when confirming', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);
    renderModal({ onCreate });
    const modelInput = screen.getByLabelText(/modelo.*antena/i);
    await user.clear(modelInput);
    await user.type(modelInput, 'Rocket M5');
    await user.click(screen.getByRole('button', { name: /agregar equipos/i }));
    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith({ type: 'ANTENA', mac: 'AA:BB:CC:DD:EE:01', model: 'Rocket M5' });
    });
  });

  it('Cancelar calls onClose without calling onCreate', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onCreate = vi.fn();
    renderModal({ onClose, onCreate });
    await user.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('Escape key calls onClose', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking the backdrop calls onClose', async () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    const dialog = screen.getByRole('dialog');
    fireEvent.mouseDown(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('router=null + only antenna included → only one onCreate call', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);
    renderModal({ result: noRouterResult, onCreate });
    await user.click(screen.getByRole('button', { name: /agregar equipos/i }));
    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledTimes(1);
      expect(onCreate).toHaveBeenCalledWith({ type: 'ANTENA', mac: 'AA:BB:CC:DD:EE:01', model: 'Mimosa' });
    });
  });
});
