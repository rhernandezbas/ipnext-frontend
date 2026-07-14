/**
 * TemplateSelector — composer del Bulk Messaging (F2 apply chunk 2, TPL-1/
 * TPL-2). Presentacional puro: recibe la lista YA fetcheada + estados
 * loading/error (el fetch/gate de permiso vive en `CampaignComposer`).
 *
 *  TS-1 loading → mensaje de carga, sin <select>
 *  TS-2 error → mensaje role=alert, sin <select>
 *  TS-3 vacío (sin templates, sin loading/error) → mensaje "no hay templates"
 *  TS-4 lista → <select> nativo con label asociado; templates NO sendable
 *       aparecen DISABLED con nota "(no aprobado)"
 *  TS-5 elegir un template sendable dispara onSelect con el objeto completo
 *  TS-6 con un template elegido, muestra su nombre + sus variables
 *  TS-7 template sin variables → nota "no tiene variables"
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { TemplateSelector } from '@/pages/whatsapp/BulkMessagingPage/components/composer/TemplateSelector';
import type { TemplateSummaryDto } from '@/types/messagingBulk';

const APPROVED: TemplateSummaryDto = {
  contentSid: 'HX123',
  friendlyName: 'Recordatorio de pago',
  language: 'es',
  variables: ['1', '2'],
  approvalStatus: 'approved',
  sendable: true,
};

const PENDING: TemplateSummaryDto = {
  contentSid: 'HX999',
  friendlyName: 'Template en revisión',
  language: 'es',
  variables: [],
  approvalStatus: 'pending',
  sendable: false,
};

describe('TS-1: loading', () => {
  it('muestra mensaje de carga y NO renderiza el select', () => {
    render(<TemplateSelector templates={[]} isLoading isError={false} selected={null} onSelect={vi.fn()} />);
    expect(screen.getByText(/cargando templates/i)).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});

describe('TS-2: error', () => {
  it('muestra un mensaje role=alert y NO renderiza el select', () => {
    render(<TemplateSelector templates={[]} isLoading={false} isError selected={null} onSelect={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/no se pudieron cargar/i);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});

describe('TS-3: vacío', () => {
  it('sin templates (ni loading ni error) muestra un aviso', () => {
    render(<TemplateSelector templates={[]} isLoading={false} isError={false} selected={null} onSelect={vi.fn()} />);
    expect(screen.getByText(/no hay templates disponibles/i)).toBeInTheDocument();
  });
});

describe('TS-4: lista con templates', () => {
  it('renderiza un <select> con label asociado', () => {
    render(<TemplateSelector templates={[APPROVED]} isLoading={false} isError={false} selected={null} onSelect={vi.fn()} />);
    expect(screen.getByRole('combobox', { name: /template/i })).toBeInTheDocument();
  });

  it('un template NO sendable aparece disabled con nota "(no aprobado)"', () => {
    render(
      <TemplateSelector templates={[APPROVED, PENDING]} isLoading={false} isError={false} selected={null} onSelect={vi.fn()} />,
    );
    const option = screen.getByRole('option', { name: /template en revisión.*no aprobado/i }) as HTMLOptionElement;
    expect(option.disabled).toBe(true);
  });
});

describe('TS-5: seleccionar un template', () => {
  it('elegir un template sendable llama a onSelect con el objeto completo', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<TemplateSelector templates={[APPROVED]} isLoading={false} isError={false} selected={null} onSelect={onSelect} />);

    await user.selectOptions(screen.getByRole('combobox', { name: /template/i }), 'HX123');

    expect(onSelect).toHaveBeenCalledWith(APPROVED);
  });
});

describe('TS-6: template elegido', () => {
  it('muestra el nombre del template y sus variables', () => {
    render(<TemplateSelector templates={[APPROVED]} isLoading={false} isError={false} selected={APPROVED} onSelect={vi.fn()} />);
    expect(screen.getByText('Recordatorio de pago', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText(/\{\{1\}\}.*\{\{2\}\}/)).toBeInTheDocument();
  });
});

describe('TS-7: template sin variables', () => {
  it('muestra una nota de "no tiene variables"', () => {
    const noVars: TemplateSummaryDto = { ...APPROVED, variables: [] };
    render(<TemplateSelector templates={[noVars]} isLoading={false} isError={false} selected={noVars} onSelect={vi.fn()} />);
    expect(screen.getByText(/no tiene variables/i)).toBeInTheDocument();
  });
});
