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
import type {
  InspectPppoeDevicesResult,
  ServiceInstalledItem,
  AddInstalledItemResult,
} from '@/types/serviceInventory';
import { InventoryConflictError } from '@/api/serviceInventory.api';
import { AddByPppoeReviewModal } from '@/pages/customers/tabs/contracts/AddByPppoeReviewModal';

/** Build a `created` result from an add input so the default onCreate resolves a valid shape. */
function createdResult(item: Partial<ServiceInstalledItem> = {}): AddInstalledItemResult {
  return {
    outcome: 'created',
    item: {
      id: 'new-1',
      serviceId: 'ctr-1',
      type: 'ANTENA',
      serialNumber: null,
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
      ...item,
    },
  };
}

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
    onCreate: vi.fn().mockResolvedValue(createdResult()),
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
    const onCreate = vi.fn().mockResolvedValue(createdResult());
    renderModal({ onCreate });
    await user.click(screen.getByRole('button', { name: /agregar equipos/i }));
    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith({ type: 'ANTENA', mac: 'AA:BB:CC:DD:EE:01', model: 'Mimosa C5x' });
      expect(onCreate).toHaveBeenCalledWith({ type: 'ROUTER', mac: 'AA:BB:CC:DD:EE:02', model: 'TP-Link' });
    });
  });

  it('toggling antenna off excludes it from add calls', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(createdResult());
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
    const onCreate = vi.fn().mockResolvedValue(createdResult());
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
    const onCreate = vi.fn().mockResolvedValue(createdResult());
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
    const onCreate = vi.fn().mockResolvedValue(createdResult());
    renderModal({ result: noRouterResult, onCreate });
    await user.click(screen.getByRole('button', { name: /agregar equipos/i }));
    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledTimes(1);
      expect(onCreate).toHaveBeenCalledWith({ type: 'ANTENA', mac: 'AA:BB:CC:DD:EE:01', model: 'Mimosa' });
    });
  });

  // ── Dedup-aware outcomes ───────────────────────────────────────────────────

  it('201 created → summary says "agregado" (not enriched)', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(createdResult());
    renderModal({ result: noRouterResult, onCreate });
    await user.click(screen.getByRole('button', { name: /agregar equipos/i }));
    // Stays open on a summary step
    expect(await screen.findByText(/agregad[oa]/i)).toBeInTheDocument();
    expect(screen.queryByText(/datos completados/i)).not.toBeInTheDocument();
  });

  it('200 enriched → summary says "datos completados" on the existing item, NOT "agregado nuevo"', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue({
      outcome: 'enriched',
      item: createdResult({ id: 'existing-1' }).item,
    } satisfies AddInstalledItemResult);
    renderModal({ result: noRouterResult, onCreate });
    await user.click(screen.getByRole('button', { name: /agregar equipos/i }));
    expect(await screen.findByText(/datos completados/i)).toBeInTheDocument();
  });

  it('does not close itself after a successful add (shows a result the operator dismisses)', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onCreate = vi.fn().mockResolvedValue(createdResult());
    renderModal({ result: noRouterResult, onClose, onCreate });
    await user.click(screen.getByRole('button', { name: /agregar equipos/i }));
    await screen.findByText(/agregad[oa]/i);
    expect(onClose).not.toHaveBeenCalled();
    // The operator closes the summary explicitly
    await user.click(screen.getByRole('button', { name: /^listo$/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── 409 SAME_TYPE_NEEDS_DECISION ───────────────────────────────────────────

  const sameTypeConflict = (candidates: Array<{ id: string; type: string; serialNumber: string | null; mac: string | null; model: string | null }>) =>
    new InventoryConflictError({ code: 'SAME_TYPE_NEEDS_DECISION', message: 'decidir', candidates });

  it('409 SAME_TYPE → shows a decision step listing the candidate, never auto-decides', async () => {
    const user = userEvent.setup();
    const onCreate = vi
      .fn()
      .mockRejectedValueOnce(
        sameTypeConflict([{ id: 'ant', type: 'ANTENA', serialNumber: 'SN-001', mac: null, model: null }]),
      );
    renderModal({ result: noRouterResult, onCreate });
    await user.click(screen.getByRole('button', { name: /agregar equipos/i }));

    // Decision UI appears with the candidate's SN
    expect(await screen.findByText(/SN-001/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /completar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /agregar como nuevo/i })).toBeInTheDocument();
    // It only called onCreate once — it did NOT auto re-POST a decision
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('409 SAME_TYPE → "Completar" re-POSTs the same device with completeItemId', async () => {
    const user = userEvent.setup();
    const onCreate = vi
      .fn()
      .mockRejectedValueOnce(
        sameTypeConflict([{ id: 'ant-9', type: 'ANTENA', serialNumber: 'SN-001', mac: null, model: null }]),
      )
      .mockResolvedValueOnce({ outcome: 'enriched', item: createdResult({ id: 'ant-9' }).item } satisfies AddInstalledItemResult);
    renderModal({ result: noRouterResult, onCreate });
    await user.click(screen.getByRole('button', { name: /agregar equipos/i }));
    await screen.findByRole('button', { name: /completar/i });
    await user.click(screen.getByRole('button', { name: /completar/i }));
    await waitFor(() =>
      expect(onCreate).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: 'ANTENA', mac: 'AA:BB:CC:DD:EE:01', completeItemId: 'ant-9' }),
      ),
    );
  });

  it('409 SAME_TYPE → "Agregar como nuevo" re-POSTs the same device with force:true', async () => {
    const user = userEvent.setup();
    const onCreate = vi
      .fn()
      .mockRejectedValueOnce(
        sameTypeConflict([{ id: 'ant-9', type: 'ANTENA', serialNumber: 'SN-001', mac: null, model: null }]),
      )
      .mockResolvedValueOnce(createdResult());
    renderModal({ result: noRouterResult, onCreate });
    await user.click(screen.getByRole('button', { name: /agregar equipos/i }));
    await screen.findByRole('button', { name: /agregar como nuevo/i });
    await user.click(screen.getByRole('button', { name: /agregar como nuevo/i }));
    await waitFor(() =>
      expect(onCreate).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: 'ANTENA', mac: 'AA:BB:CC:DD:EE:01', force: true }),
      ),
    );
    // It must NOT send completeItemId when forcing new
    const lastCall = onCreate.mock.calls.at(-1)?.[0];
    expect(lastCall).not.toHaveProperty('completeItemId');
  });

  it('409 SAME_TYPE with multiple candidates → operator picks which to complete', async () => {
    const user = userEvent.setup();
    const onCreate = vi
      .fn()
      .mockRejectedValueOnce(
        sameTypeConflict([
          { id: 'a1', type: 'ANTENA', serialNumber: 'SN-AAA', mac: null, model: null },
          { id: 'a2', type: 'ANTENA', serialNumber: 'SN-BBB', mac: null, model: null },
        ]),
      )
      .mockResolvedValueOnce({ outcome: 'enriched', item: createdResult({ id: 'a2' }).item } satisfies AddInstalledItemResult);
    renderModal({ result: noRouterResult, onCreate });
    await user.click(screen.getByRole('button', { name: /agregar equipos/i }));
    // Both candidates listed
    expect(await screen.findByText(/SN-AAA/)).toBeInTheDocument();
    expect(screen.getByText(/SN-BBB/)).toBeInTheDocument();
    // Pick the second candidate (radio), then Completar
    const secondRadio = screen.getByRole('radio', { name: /SN-BBB/i });
    await user.click(secondRadio);
    await user.click(screen.getByRole('button', { name: /completar/i }));
    await waitFor(() =>
      expect(onCreate).toHaveBeenLastCalledWith(
        expect.objectContaining({ completeItemId: 'a2' }),
      ),
    );
  });

  // ── 409 ASSET_NOT_REVIVABLE ────────────────────────────────────────────────

  it('409 ASSET_NOT_REVIVABLE → shows a clear non-crashing message', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockRejectedValueOnce(
      new InventoryConflictError({
        code: 'ASSET_NOT_REVIVABLE',
        message: 'Asset "SN-DMG-1" is damaged and cannot be revived',
        candidates: [],
      }),
    );
    renderModal({ result: noRouterResult, onCreate });
    await user.click(screen.getByRole('button', { name: /agregar equipos/i }));
    expect(await screen.findByText(/baja|dañad|no se puede reactivar/i)).toBeInTheDocument();
    // No decision buttons for a non-revivable asset
    expect(screen.queryByRole('button', { name: /completar/i })).not.toBeInTheDocument();
  });
});
