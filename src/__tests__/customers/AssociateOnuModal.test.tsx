/**
 * AssociateOnuModal — "Asociar ONU" flow (wifi-staff-panel #2).
 *
 * Cubre:
 *  1. Verificar consulta GET /wifi/onu/:serial y muestra el equipo ANTES de confirmar
 *  2. Confirmar POSTea {type:'ONU', serialNumber}
 *  3. 409 SAME_TYPE_NEEDS_DECISION muestra la decisión (completar / agregar como nuevo)
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';
import { InventoryConflictError } from '@/api/serviceInventory.api';
import type { AddInstalledItemInput, AddInstalledItemResult, SameTypeCandidate } from '@/types/serviceInventory';
import type { OnuWifiStatus } from '@/types/wifi';
import { AssociateOnuModal } from '@/pages/customers/tabs/contracts/AssociateOnuModal';

function foundStatus(over: Partial<OnuWifiStatus> = {}): OnuWifiStatus {
  return {
    sn: 'HWTC12345678',
    found: true,
    onuType: 'HG8145V5',
    online: true,
    tr069Enabled: true,
    bands: [],
    hosts: [],
    ...over,
  };
}

const createdResult: AddInstalledItemResult = {
  outcome: 'created',
  item: {
    id: 'new-onu-1', serviceId: 'svc-1', type: 'ONU', serialNumber: 'HWTC12345678', mac: null,
    model: null, source: 'MANUAL', sourceTaskId: null, addedByUserId: null, addedByUserName: null,
    confirmedAt: null, status: 'active', notes: null, createdAt: '2026-01-01T00:00:00.000Z',
  },
};

const candidates: SameTypeCandidate[] = [
  { id: 'cand-1', type: 'ONU', serialNumber: null, mac: null, model: 'HG8145V5' },
];

describe('AssociateOnuModal', () => {
  it('verifies the serial via onVerify (GET) and shows the equipment before confirming', async () => {
    const user = userEvent.setup();
    const onVerify = vi.fn().mockResolvedValue(foundStatus());
    const onCreate = vi.fn().mockResolvedValue(createdResult);

    render(
      <AssociateOnuModal
        onVerify={onVerify}
        verifying={false}
        onCreate={onCreate}
        onAssociated={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    // "Confirmar y asociar" is not enabled until verified.
    expect(screen.getByRole('button', { name: /Confirmar y asociar/i })).toBeDisabled();

    await user.type(screen.getByLabelText(/Serial/i), 'HWTC12345678');
    await user.click(screen.getByRole('button', { name: /^Verificar$/i }));

    expect(onVerify).toHaveBeenCalledWith('HWTC12345678');
    await screen.findByText(/HG8145V5/);
    expect(screen.getByText('En línea')).toBeInTheDocument();

    // Only NOW is confirm enabled — the operator saw the equipment first.
    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Confirmar y asociar/i })).not.toBeDisabled();
  });

  it('POSTs {type: "ONU", serialNumber} on confirm', async () => {
    const user = userEvent.setup();
    const onVerify = vi.fn().mockResolvedValue(foundStatus());
    const onCreate = vi.fn().mockResolvedValue(createdResult);
    const onAssociated = vi.fn();

    render(
      <AssociateOnuModal
        onVerify={onVerify}
        verifying={false}
        onCreate={onCreate}
        onAssociated={onAssociated}
        onClose={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText(/Serial/i), 'HWTC12345678');
    await user.click(screen.getByRole('button', { name: /^Verificar$/i }));
    await screen.findByText(/HG8145V5/);
    await user.click(screen.getByRole('button', { name: /Confirmar y asociar/i }));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith({ type: 'ONU', serialNumber: 'HWTC12345678' } satisfies AddInstalledItemInput);
    });
    await screen.findByRole('button', { name: /Listo/i });
  });

  it('shows the "el serial no existe en SmartOLT" message when found:false, and disables confirm', async () => {
    const user = userEvent.setup();
    const onVerify = vi.fn().mockResolvedValue({ ...foundStatus(), found: false, onuType: null });

    render(
      <AssociateOnuModal
        onVerify={onVerify}
        verifying={false}
        onCreate={vi.fn()}
        onAssociated={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText(/Serial/i), 'BADSERIAL');
    await user.click(screen.getByRole('button', { name: /^Verificar$/i }));

    await screen.findByText(/no existe en SmartOLT/i);
    expect(screen.getByRole('button', { name: /Confirmar y asociar/i })).toBeDisabled();
  });

  it('409 SAME_TYPE_NEEDS_DECISION shows the decision step (complete existing / add as new)', async () => {
    const user = userEvent.setup();
    const onVerify = vi.fn().mockResolvedValue(foundStatus());
    const conflict = new InventoryConflictError({ code: 'SAME_TYPE_NEEDS_DECISION', message: '', candidates });
    const onCreate = vi.fn()
      .mockRejectedValueOnce(conflict)
      .mockResolvedValueOnce(createdResult);

    render(
      <AssociateOnuModal
        onVerify={onVerify}
        verifying={false}
        onCreate={onCreate}
        onAssociated={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText(/Serial/i), 'HWTC12345678');
    await user.click(screen.getByRole('button', { name: /^Verificar$/i }));
    await screen.findByText(/HG8145V5/);
    await user.click(screen.getByRole('button', { name: /Confirmar y asociar/i }));

    await screen.findByRole('button', { name: /Completar equipo existente/i });
    expect(screen.getByRole('button', { name: /Agregar como nuevo/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Completar equipo existente/i }));

    await waitFor(() => {
      expect(onCreate).toHaveBeenLastCalledWith({
        type: 'ONU',
        serialNumber: 'HWTC12345678',
        completeItemId: 'cand-1',
      });
    });
  });
});
