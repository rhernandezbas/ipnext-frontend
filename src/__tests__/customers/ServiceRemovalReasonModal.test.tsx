/**
 * #127 — ServiceRemovalReasonModal
 *
 * Tests:
 * 1. Render: shows the service name in the title/description.
 * 2. Confirm button is DISABLED when textarea is empty.
 * 3. Confirm button ENABLES after typing a reason.
 * 4. Confirming calls onConfirm with the typed reason.
 * 5. Cancelling calls onCancel without calling onConfirm.
 * 6. Escape key calls onCancel.
 * 7. Clicking the backdrop calls onCancel.
 * 8. Not rendered when open=false.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServiceRemovalReasonModal } from '../../components/molecules/ServiceRemovalReasonModal/ServiceRemovalReasonModal';

describe('ServiceRemovalReasonModal — #127', () => {
  const defaultProps = {
    open: true,
    serviceName: 'Internet Fibra',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => vi.clearAllMocks());

  it('does not render when open=false', () => {
    render(<ServiceRemovalReasonModal {...defaultProps} open={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the service name in the dialog', () => {
    render(<ServiceRemovalReasonModal {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Internet Fibra/)).toBeInTheDocument();
  });

  it('confirm button is DISABLED when textarea is empty', () => {
    render(<ServiceRemovalReasonModal {...defaultProps} />);
    const btn = screen.getByRole('button', { name: /dar de baja/i });
    expect(btn).toBeDisabled();
  });

  it('confirm button ENABLES after typing a reason', async () => {
    const user = userEvent.setup();
    render(<ServiceRemovalReasonModal {...defaultProps} />);
    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Motivo de prueba');
    const btn = screen.getByRole('button', { name: /dar de baja/i });
    expect(btn).not.toBeDisabled();
  });

  it('confirm button is DISABLED when textarea has only whitespace', async () => {
    const user = userEvent.setup();
    render(<ServiceRemovalReasonModal {...defaultProps} />);
    const textarea = screen.getByRole('textbox');
    await user.type(textarea, '   ');
    const btn = screen.getByRole('button', { name: /dar de baja/i });
    expect(btn).toBeDisabled();
  });

  it('calling confirm invokes onConfirm with the trimmed reason', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ServiceRemovalReasonModal {...defaultProps} onConfirm={onConfirm} />);
    const textarea = screen.getByRole('textbox');
    await user.type(textarea, '  Equipo retirado  ');
    await user.click(screen.getByRole('button', { name: /dar de baja/i }));
    expect(onConfirm).toHaveBeenCalledWith('Equipo retirado');
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('clicking Cancelar calls onCancel without calling onConfirm', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ServiceRemovalReasonModal {...defaultProps} onConfirm={onConfirm} onCancel={onCancel} />,
    );
    await user.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('Escape key calls onCancel', () => {
    const onCancel = vi.fn();
    render(<ServiceRemovalReasonModal {...defaultProps} onCancel={onCancel} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('clicking the backdrop calls onCancel', async () => {
    const onCancel = vi.fn();
    render(<ServiceRemovalReasonModal {...defaultProps} onCancel={onCancel} />);
    const backdrop = screen.getByRole('dialog').parentElement!;
    fireEvent.mouseDown(backdrop);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
