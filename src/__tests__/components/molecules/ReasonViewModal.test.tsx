/**
 * TDD — ReasonViewModal (#132 / #133-FE)
 *
 * Read-only modal that displays a reason string.
 * Contract:
 *   - renders the reason text when open
 *   - renders a title "Motivo de la baja"
 *   - has a "Cerrar" button that calls onClose
 *   - Escape key calls onClose
 *   - backdrop click calls onClose
 *   - role=dialog, aria-modal=true
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReasonViewModal } from '@/components/molecules/ReasonViewModal/ReasonViewModal';

function renderModal(props: { open?: boolean; reason?: string; onClose?: () => void } = {}) {
  const { open = true, reason = 'Motivo de prueba', onClose = vi.fn() } = props;
  return render(<ReasonViewModal open={open} reason={reason} onClose={onClose} />);
}

describe('ReasonViewModal', () => {
  it('open=false → does not render the dialog', () => {
    renderModal({ open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('open=true → renders dialog with role=dialog', () => {
    renderModal();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders the title "Motivo de la baja"', () => {
    renderModal();
    expect(screen.getByText('Motivo de la baja')).toBeInTheDocument();
  });

  it('renders the reason text', () => {
    renderModal({ reason: 'Cliente solicitó baja por mudanza' });
    expect(screen.getByText('Cliente solicitó baja por mudanza')).toBeInTheDocument();
  });

  it('renders a different reason text (triangulation)', () => {
    renderModal({ reason: 'Falta de pago recurrente' });
    expect(screen.getByText('Falta de pago recurrente')).toBeInTheDocument();
  });

  it('has aria-modal="true" on the dialog', () => {
    renderModal();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('clicking the "Cerrar" button calls onClose', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByRole('button', { name: /cerrar/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape key calls onClose', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('backdrop click calls onClose', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    const dialog = screen.getByRole('dialog');
    const backdrop = dialog.parentElement!;
    fireEvent.mouseDown(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
