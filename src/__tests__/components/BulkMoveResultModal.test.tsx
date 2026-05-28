import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { BulkMoveResultModal } from '@/components/molecules/BulkMoveResultModal/BulkMoveResultModal';
import type { BulkStageResult } from '@/api/scheduling.api';

const results: BulkStageResult[] = [
  { taskId: 't1', ok: true },
  { taskId: 't2', ok: true },
  { taskId: 't3', ok: false, errorCode: 'MISSING_REQUIRED_FIELDS', missingFields: ['phone', 'address'] },
  { taskId: 't4', ok: false, errorCode: 'ICLASS_REJECTED', reason: 'ICLERR_DUPLICATE' },
  { taskId: 't5', ok: false, errorCode: 'ICLASS_NODE_NOT_FOUND' },
];
const summary = { total: 5, ok: 2, failed: 3 };

describe('BulkMoveResultModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <BulkMoveResultModal open={false} summary={summary} results={results} onRetryFailed={vi.fn()} onClose={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the summary "X de N"', () => {
    render(<BulkMoveResultModal open summary={summary} results={results} onRetryFailed={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/2 de 5/)).toBeInTheDocument();
  });

  it('lists only the failed tasks with a legible reason per error code', () => {
    render(<BulkMoveResultModal open summary={summary} results={results} onRetryFailed={vi.fn()} onClose={vi.fn()} />);

    // MISSING_REQUIRED_FIELDS → reusa los labels ES
    expect(screen.getByText(/Teléfono/)).toBeInTheDocument();
    expect(screen.getByText(/Dirección/)).toBeInTheDocument();
    // ICLASS_REJECTED → muestra el reason
    expect(screen.getByText(/ICLERR_DUPLICATE/)).toBeInTheDocument();
    // ICLASS_NODE_NOT_FOUND → texto por código
    expect(screen.getByText(/nodo de IClass/)).toBeInTheDocument();

    // las OK no se listan
    expect(screen.queryByText('t1')).not.toBeInTheDocument();
    expect(screen.queryByText('t2')).not.toBeInTheDocument();
  });

  it('uses labelForTask when provided', () => {
    render(
      <BulkMoveResultModal
        open
        summary={summary}
        results={results}
        labelForTask={(id) => `Tarea ${id.toUpperCase()}`}
        onRetryFailed={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Tarea T3')).toBeInTheDocument();
  });

  it('calls onRetryFailed with only the failed ids', () => {
    const onRetryFailed = vi.fn();
    render(<BulkMoveResultModal open summary={summary} results={results} onRetryFailed={onRetryFailed} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }));
    expect(onRetryFailed).toHaveBeenCalledWith(['t3', 't4', 't5']);
  });

  it('hides the retry button when there are no failures', () => {
    render(
      <BulkMoveResultModal
        open
        summary={{ total: 2, ok: 2, failed: 0 }}
        results={[{ taskId: 't1', ok: true }, { taskId: 't2', ok: true }]}
        onRetryFailed={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /Reintentar/ })).not.toBeInTheDocument();
  });

  it('calls onClose when "Cerrar" is clicked', () => {
    const onClose = vi.fn();
    render(<BulkMoveResultModal open summary={summary} results={results} onRetryFailed={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalled();
  });
});
