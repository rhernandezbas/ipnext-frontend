import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';

// ── Dependencies mock ────────────────────────────────────────────────────────

vi.mock('@/api/recaptacion.api', () => ({
  importCsvLeads:      vi.fn(),
  downloadCsvTemplate: vi.fn(),
  ingestChurnedClients: vi.fn(),
  listRecaptureLeads:        vi.fn(),
  getRecaptureLead:          vi.fn(),
  updateRecaptureLeadStatus: vi.fn(),
  addRecaptureContact:       vi.fn(),
  assignRecaptureLead:       vi.fn(),
  assignBulkRecaptureLeads:  vi.fn(),
}));

vi.mock('@/hooks/useRecaptacion', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/hooks/useRecaptacion')>();
  return {
    ...original,
    useImportCsvLeads: vi.fn(() => ({
      mutateAsync: vi.fn().mockResolvedValue({ created: 2, errors: [] }),
      isPending: false,
    })),
    downloadRecaptureCsvTemplate: vi.fn(),
  };
});

import { ImportCsvModal } from '@/pages/customers/RecaptacionPage/components/ImportCsvModal';

describe('ImportCsvModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <ImportCsvModal open={false} onClose={vi.fn()} onSuccess={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows file input and "Descargar CSV de ejemplo" when open', () => {
    render(<ImportCsvModal open onClose={vi.fn()} onSuccess={vi.fn()} />);
    expect(screen.getByText(/Descargar CSV de ejemplo/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Importar/i })).toBeInTheDocument();
  });

  it('shows the selected filename when a file is picked', () => {
    render(<ImportCsvModal open onClose={vi.fn()} onSuccess={vi.fn()} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).not.toBeNull();

    const file = new File(['id,name'], 'leads.csv', { type: 'text/csv' });
    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText('leads.csv')).toBeInTheDocument();
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<ImportCsvModal open onClose={onClose} onSuccess={vi.fn()} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<ImportCsvModal open onClose={onClose} onSuccess={vi.fn()} />);
    // The backdrop is the outermost element with role="dialog"
    const backdrop = screen.getByRole('dialog');
    fireEvent.mouseDown(backdrop);
    expect(onClose).toHaveBeenCalled();
  });
});
