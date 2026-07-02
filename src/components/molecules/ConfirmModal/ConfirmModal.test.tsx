import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { ConfirmModal } from './ConfirmModal';

const baseProps = {
  open: true,
  title: 'Título',
  message: 'Mensaje de prueba',
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

describe('ConfirmModal', () => {
  it('renders title, message and confirm button when open', () => {
    render(<ConfirmModal {...baseProps} confirmLabel="Aceptar" />);
    expect(screen.getByText('Título')).toBeInTheDocument();
    expect(screen.getByText('Mensaje de prueba')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /aceptar/i })).toBeInTheDocument();
  });

  it('renders nothing when open=false', () => {
    render(<ConfirmModal {...baseProps} open={false} />);
    expect(screen.queryByText('Título')).not.toBeInTheDocument();
  });

  // Default behaviour (retrocompatible): el botón cancelar SIEMPRE se muestra
  // salvo que se pida lo contrario. Esto fija el contrato existente.
  it('shows the cancel button by default (back-compat)', () => {
    render(<ConfirmModal {...baseProps} />);
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument();
  });

  it('shows the cancel button with a custom cancelLabel by default', () => {
    render(<ConfirmModal {...baseProps} cancelLabel="Volver" />);
    expect(screen.getByRole('button', { name: /volver/i })).toBeInTheDocument();
  });

  // ── WARNING #3 — hideCancel para avisos de UNA sola acción ────────────────
  // El modal informativo de #122 ("Entendido") no debe mostrar el botón
  // Cancelar. Cambio aditivo/retrocompatible: default sigue mostrando cancel.
  it('hides the cancel button when hideCancel is true (#122 WARNING-3)', () => {
    render(<ConfirmModal {...baseProps} confirmLabel="Entendido" hideCancel />);
    // El botón de confirmación sigue presente.
    expect(screen.getByRole('button', { name: /entendido/i })).toBeInTheDocument();
    // El de cancelar NO.
    expect(screen.queryByRole('button', { name: /cancelar/i })).not.toBeInTheDocument();
  });

  it('still shows cancel when hideCancel is false (explicit) (#122 WARNING-3)', () => {
    render(<ConfirmModal {...baseProps} hideCancel={false} />);
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument();
  });

  // ── Foco inicial seguro en danger ──────────────────────────────────────────
  // danger = acción destructiva/irreversible: si el foco inicial cae en
  // CONFIRMAR, un doble-Space/Enter apurado acepta sin leer. En danger el foco
  // inicial va a Cancelar (safe default); los demás tonos conservan el
  // contrato previo (foco en confirmar), pinneado abajo.

  it('focuses the CANCEL button on open when tone is danger', () => {
    render(<ConfirmModal {...baseProps} tone="danger" />);
    expect(screen.getByRole('button', { name: /cancelar/i })).toHaveFocus();
  });

  it('keeps initial focus on the confirm button for default tone (pin)', () => {
    render(<ConfirmModal {...baseProps} confirmLabel="Aceptar" />);
    expect(screen.getByRole('button', { name: /aceptar/i })).toHaveFocus();
  });

  it('falls back to confirm focus when danger has no cancel button (hideCancel)', () => {
    render(<ConfirmModal {...baseProps} tone="danger" hideCancel confirmLabel="Entendido" />);
    expect(screen.getByRole('button', { name: /entendido/i })).toHaveFocus();
  });
});
