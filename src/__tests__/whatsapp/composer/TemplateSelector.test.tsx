/**
 * TemplateSelector — composer del Bulk Messaging (F2 apply chunk 2, TPL-1/
 * TPL-2; migrado al `Select` propio en messaging-bulk-v11 FE apply chunk 1 —
 * PROHIBIDO el `<select>` nativo de cara al operador). Presentacional puro:
 * recibe la lista YA fetcheada + estados loading/error (el fetch/gate de
 * permiso vive en `CampaignComposer`).
 *
 *  TS-1 loading → mensaje de carga, sin combobox
 *  TS-2 error → mensaje role=alert, sin combobox
 *  TS-3 vacío (sin templates, sin loading/error) → mensaje "no hay templates"
 *  TS-4 lista → combobox (Select) con label asociado; templates NO sendable
 *       aparecen disabled (aria-disabled) con nota "(no aprobado)"
 *  TS-5 elegir un template sendable dispara onSelect con el objeto completo
 *  TS-6 con un template elegido, muestra su nombre + sus variables
 *  TS-7 template sin variables → nota "no tiene variables"
 *  TS-8 elegir un template NO sendable (disabled) NO dispara onSelect
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
  body: 'Hola {{1}}, tu saldo de ${{2}} vence pronto.',
};

const PENDING: TemplateSummaryDto = {
  contentSid: 'HX999',
  friendlyName: 'Template en revisión',
  language: 'es',
  variables: [],
  approvalStatus: 'pending',
  sendable: false,
  body: 'Texto pendiente de aprobación.',
};

describe('TS-1: loading', () => {
  it('muestra mensaje de carga y NO renderiza el combobox', () => {
    render(<TemplateSelector templates={[]} isLoading isError={false} selected={null} onSelect={vi.fn()} />);
    expect(screen.getByText(/cargando templates/i)).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});

describe('TS-2: error', () => {
  it('muestra un mensaje role=alert y NO renderiza el combobox', () => {
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
  it('renderiza un combobox con label asociado', () => {
    render(<TemplateSelector templates={[APPROVED]} isLoading={false} isError={false} selected={null} onSelect={vi.fn()} />);
    expect(screen.getByRole('combobox', { name: /template/i })).toBeInTheDocument();
  });

  it('un template NO sendable aparece aria-disabled con nota "(no aprobado)"', async () => {
    const user = userEvent.setup();
    render(
      <TemplateSelector templates={[APPROVED, PENDING]} isLoading={false} isError={false} selected={null} onSelect={vi.fn()} />,
    );
    await user.click(screen.getByRole('combobox', { name: /template/i }));

    const option = screen.getByRole('option', { name: /template en revisión.*no aprobado/i });
    expect(option).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('TS-5: seleccionar un template', () => {
  it('elegir un template sendable llama a onSelect con el objeto completo', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<TemplateSelector templates={[APPROVED]} isLoading={false} isError={false} selected={null} onSelect={onSelect} />);

    await user.click(screen.getByRole('combobox', { name: /template/i }));
    await user.click(screen.getByRole('option', { name: /recordatorio de pago/i }));

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

describe('TS-8: elegir un template no sendable', () => {
  it('clickear la opción disabled NO dispara onSelect', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <TemplateSelector templates={[APPROVED, PENDING]} isLoading={false} isError={false} selected={null} onSelect={onSelect} />,
    );
    await user.click(screen.getByRole('combobox', { name: /template/i }));

    await user.click(screen.getByRole('option', { name: /template en revisión.*no aprobado/i }));

    expect(onSelect).not.toHaveBeenCalled();
  });
});
