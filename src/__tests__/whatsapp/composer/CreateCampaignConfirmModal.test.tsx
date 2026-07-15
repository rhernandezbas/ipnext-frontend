/**
 * CreateCampaignConfirmModal (bulk-composer-polish #5) — modal de
 * doble-confirmación al CREAR una campaña. Muestra el resumen de impacto
 * (nombre + template + total + desglose por estado + excluidos) y deja
 * EXPLÍCITO que esto sólo CREA la campaña (pending) — el envío es otro paso.
 *
 * Shell de a11y calcado del patrón `ConfirmModal`/`PreviewModal` (portal a
 * document.body, foco inicial + focus-trap cíclico, Esc/backdrop cancelan,
 * restauración de foco, scroll-lock). Contenido 100% por props (data ya en
 * memoria del composer — cero fetch).
 *
 *  CCM-1  open=false → no renderiza nada
 *  CCM-2  muestra nombre de campaña + template + total + desglose por estado
 *  CCM-3  estado desconocido (fuera del badge) → texto plano (nunca solo color)
 *  CCM-4  excluidos (skipped) sólo si hay; ocultos si todo es 0
 *  CCM-5  el copy aclara que CREA y que todavía NO se envía nada
 *  CCM-6  Confirmar → onConfirm; Cancelar → onCancel
 *  CCM-7  Esc y click en el backdrop → onCancel
 *  CCM-8  a11y: role=dialog + aria-modal + foco inicial DENTRO del diálogo
 *  CCM-10 focus-trap cíclico (Tab en el último → primero; Shift+Tab en el primero → último)
 */
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { CreateCampaignConfirmModal } from '@/pages/whatsapp/BulkMessagingPage/components/composer/CreateCampaignConfirmModal';
import type { PreviewSegmentOutput } from '@/types/messagingBulk';

type Skipped = PreviewSegmentOutput['skipped'];

const NO_SKIPPED: Skipped = { optedOut: 0, duplicatePhone: 0, invalidPhone: 0 };

function renderModal(
  props: Partial<{
    open: boolean;
    campaignName: string;
    templateName: string;
    total: number;
    manualCount: number;
    statusCounts: Record<string, number>;
    skipped: Skipped;
    onConfirm: () => void;
    onCancel: () => void;
  }> = {},
) {
  const onConfirm = props.onConfirm ?? vi.fn();
  const onCancel = props.onCancel ?? vi.fn();
  const utils = render(
    <CreateCampaignConfirmModal
      open={props.open ?? true}
      campaignName={props.campaignName ?? 'Recordatorio julio'}
      templateName={props.templateName ?? 'Recordatorio de pago'}
      total={props.total ?? 42}
      manualCount={props.manualCount}
      statusCounts={props.statusCounts ?? { late: 30, blocked: 12 }}
      skipped={'skipped' in props ? props.skipped : NO_SKIPPED}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  );
  return { ...utils, onConfirm, onCancel };
}

describe('CCM-1: open=false', () => {
  it('no renderiza nada', () => {
    renderModal({ open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('CCM-2: resumen de impacto', () => {
  it('muestra el nombre de la campaña, el template, el total y el desglose por estado', () => {
    renderModal();

    // Nombre de la campaña + template.
    expect(screen.getByText('Recordatorio julio')).toBeInTheDocument();
    expect(screen.getByText('Recordatorio de pago')).toBeInTheDocument();

    // Total.
    expect(screen.getByText('42')).toBeInTheDocument();

    // Desglose por estado — labels de StatusBadge + counts.
    expect(screen.getByText('Atrasado')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('Bloqueado')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });
});

describe('CCM-3: estado desconocido', () => {
  it('se muestra como texto plano (fallback, no solo color)', () => {
    renderModal({ statusCounts: { 'vip-custom': 5 } });
    expect(screen.getByText('vip-custom')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });
});

describe('CCM-4: excluidos (skipped)', () => {
  it('muestra los excluidos cuando hay', () => {
    renderModal({ skipped: { optedOut: 1, duplicatePhone: 2, invalidPhone: 3 } });
    expect(screen.getByText(/no recibir mensajes/i)).toHaveTextContent('1');
    expect(screen.getByText(/duplicado/i)).toHaveTextContent('2');
    expect(screen.getByText(/inválido/i)).toHaveTextContent('3');
  });

  it('no muestra la sección de excluidos si todo es 0', () => {
    renderModal({ skipped: NO_SKIPPED });
    expect(screen.queryByText(/no recibir mensajes/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/excluidos/i)).not.toBeInTheDocument();
  });
});

describe('CCM-5: copy — crea, NO envía', () => {
  it('deja explícito que la acción CREA la campaña y todavía NO envía nada', () => {
    renderModal();
    // "crear" como término resaltado.
    expect(screen.getByText('crear')).toBeInTheDocument();
    // "todavía no se envía nada" — el envío es un paso aparte.
    expect(screen.getByText(/no se env[ií]a nada/i)).toBeInTheDocument();
  });
});

describe('CCM-6: confirmar / cancelar', () => {
  it('Confirmar llama a onConfirm', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderModal();
    await user.click(screen.getByRole('button', { name: /confirmar y crear/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('Cancelar llama a onCancel (no a onConfirm)', async () => {
    const user = userEvent.setup();
    const { onConfirm, onCancel } = renderModal();
    await user.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('CCM-7: Esc y backdrop', () => {
  it('Esc llama a onCancel', () => {
    const { onConfirm, onCancel } = renderModal();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('click en el backdrop llama a onCancel', () => {
    const { onCancel } = renderModal();
    const dialog = screen.getByRole('dialog');
    fireEvent.mouseDown(dialog);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('CCM-8: a11y', () => {
  it('es un dialog modal con nombre accesible y el foco cae dentro', () => {
    renderModal();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    // El foco inicial está DENTRO del diálogo.
    expect(dialog.contains(document.activeElement)).toBe(true);
  });
});

describe('CCM-10: focus-trap cíclico', () => {
  it('Tab en el último foco-able cicla al primero', () => {
    renderModal();
    const cancel = screen.getByRole('button', { name: /cancelar/i });
    const confirm = screen.getByRole('button', { name: /confirmar y crear/i });

    confirm.focus();
    expect(confirm).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(cancel).toHaveFocus();
  });

  it('Shift+Tab en el primero cicla al último', () => {
    renderModal();
    const cancel = screen.getByRole('button', { name: /cancelar/i });
    const confirm = screen.getByRole('button', { name: /confirmar y crear/i });

    cancel.focus();
    expect(cancel).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(confirm).toHaveFocus();
  });
});

// FIX 8 (fix wave) — `manualCount` es el largo CRUDO de la lista FE; `total` es
// la unión dedup del BE (descuenta overlap/opt-out/inexistentes) → puede ser
// MENOR que manualCount. El copy no debe contradecir ("2 clientes (incluye 3
// agregados manualmente)"): usa "hasta N" para dejar claro que el total ya está
// deduplicado/validado.
describe('CONF-1: nota de destinatarios manuales (FIX 8 — copy no contradice el total)', () => {
  it('con manualCount > total usa "hasta N" (el total ya está deduplicado)', () => {
    renderModal({ total: 2, manualCount: 3 });
    expect(screen.getByText(/incluye hasta 3 agregados manualmente/i)).toBeInTheDocument();
  });

  it('singular: "hasta 1 agregado manualmente"', () => {
    renderModal({ total: 5, manualCount: 1 });
    expect(screen.getByText(/incluye hasta 1 agregado manualmente/i)).toBeInTheDocument();
  });

  it('sin manuales (manualCount 0/omitido) no muestra la nota', () => {
    renderModal();
    expect(screen.queryByText(/agregad. manualmente/i)).not.toBeInTheDocument();
  });
});

describe('CCM-13: subtítulos del desglose como headings (fix wave #5)', () => {
  it('"Desglose por estado" es un heading', () => {
    renderModal();
    expect(screen.getByRole('heading', { name: /desglose por estado/i })).toBeInTheDocument();
  });

  it('"Excluidos del envío" es un heading cuando hay excluidos', () => {
    renderModal({ skipped: { optedOut: 1, duplicatePhone: 0, invalidPhone: 0 } });
    expect(screen.getByRole('heading', { name: /excluidos del envío/i })).toBeInTheDocument();
  });
});
