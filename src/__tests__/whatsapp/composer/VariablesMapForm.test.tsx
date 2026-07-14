/**
 * VariablesMapForm — composer del Bulk Messaging (F2 apply chunk 2; migrado
 * al `Select` propio + descripciones de contexto en messaging-bulk-v11 FE
 * apply chunk 1). Por cada variable del template elegido, un combobox de
 * fuente (name/balanceDue/literal) + input de texto SOLO cuando la fuente es
 * 'literal'. Con `templateBody` (contrato v1.1, BE en PROD), además muestra
 * el texto del template con cada `{{N}}` resaltado EN SU CONTEXTO real —
 * anti-error humano: el operador ve QUÉ es cada variable antes de mapearla.
 *
 *  VMF-1 sin variables → no renderiza nada
 *  VMF-2 una fila por variable, con combobox de fuente (label = `{{N}}`)
 *  VMF-3 elegir 'name'/'balanceDue' llama a onChange con esa fuente, SIN `value`
 *  VMF-4 elegir 'literal' muestra el input de texto
 *  VMF-5 tipear en el input de literal llama a onChange con `{source:'literal',value}`
 *  VMF-6 volver a "Elegí una fuente…" (source vacío) saca la entrada del map
 *  VMF-7 `missingVariables` (422 MISSING_TEMPLATE_VARIABLES) resalta esa fila con role=alert
 *  VMF-8 con `templateBody`, muestra el texto del template con `{{N}}` resaltado en contexto
 *  VMF-9 sin `templateBody`, NO rompe (no renderiza contexto, resto funciona igual)
 *  VMF-10 el input de valor fijo referencia el contexto de su variable en el label
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { VariablesMapForm } from '@/pages/whatsapp/BulkMessagingPage/components/composer/VariablesMapForm';
import type { CampaignVariableSpec } from '@/types/messagingBulk';

const TEMPLATE_BODY = 'Hola {{1}}, tu saldo de ${{2}} vence pronto.';

describe('VMF-1: sin variables', () => {
  it('no renderiza nada', () => {
    const { container } = render(<VariablesMapForm variables={[]} value={{}} onChange={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('VMF-2: una fila por variable', () => {
  it('renderiza un combobox por variable, con nombre accesible {{N}}', () => {
    render(<VariablesMapForm variables={['1', '2']} value={{}} onChange={vi.fn()} />);
    expect(screen.getByRole('combobox', { name: '{{1}}' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '{{2}}' })).toBeInTheDocument();
  });
});

describe('VMF-3: elegir name/balanceDue', () => {
  it('elegir "name" llama a onChange con esa fuente sin `value`', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<VariablesMapForm variables={['1']} value={{}} onChange={onChange} />);

    await user.click(screen.getByRole('combobox', { name: '{{1}}' }));
    await user.click(screen.getByRole('option', { name: /nombre del cliente/i }));

    expect(onChange).toHaveBeenCalledWith({ '1': { source: 'name', value: undefined } });
  });

  it('elegir "balanceDue" llama a onChange con esa fuente', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<VariablesMapForm variables={['1']} value={{}} onChange={onChange} />);

    await user.click(screen.getByRole('combobox', { name: '{{1}}' }));
    await user.click(screen.getByRole('option', { name: /monto de deuda/i }));

    expect(onChange).toHaveBeenCalledWith({ '1': { source: 'balanceDue', value: undefined } });
  });
});

describe('VMF-4: elegir literal', () => {
  it('muestra un input de texto para el valor fijo', () => {
    const value: CampaignVariableSpec = { '1': { source: 'literal', value: '' } };
    render(<VariablesMapForm variables={['1']} value={value} onChange={vi.fn()} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('SIN elegir literal, no hay ningún input de texto', () => {
    render(<VariablesMapForm variables={['1']} value={{}} onChange={vi.fn()} />);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});

describe('VMF-5: tipear el valor literal', () => {
  it('llama a onChange con {source:"literal", value: texto}', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const value: CampaignVariableSpec = { '1': { source: 'literal', value: '' } };
    render(<VariablesMapForm variables={['1']} value={value} onChange={onChange} />);

    await user.type(screen.getByRole('textbox'), 'x');

    expect(onChange).toHaveBeenCalledWith({ '1': { source: 'literal', value: 'x' } });
  });
});

describe('VMF-6: volver a "sin fuente"', () => {
  it('elegir la opción vacía saca la entrada del map', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const value: CampaignVariableSpec = { '1': { source: 'name' } };
    render(<VariablesMapForm variables={['1']} value={value} onChange={onChange} />);

    await user.click(screen.getByRole('combobox', { name: '{{1}}' }));
    await user.click(screen.getByRole('option', { name: /elegí una fuente/i }));

    expect(onChange).toHaveBeenCalledWith({});
  });
});

describe('VMF-7: variables faltantes (422 MISSING_TEMPLATE_VARIABLES)', () => {
  it('resalta la fila de la variable faltante con role=alert', () => {
    render(<VariablesMapForm variables={['1', '2']} value={{ '1': { source: 'name' } }} onChange={vi.fn()} missingVariables={['2']} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/falta mapear/i);
  });

  it('sin missingVariables, no hay ningún role=alert', () => {
    render(<VariablesMapForm variables={['1']} value={{ '1': { source: 'name' } }} onChange={vi.fn()} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('VMF-8: contexto del template (v1.1, templateBody)', () => {
  it('muestra {{1}} resaltado con el texto que lo rodea', () => {
    render(<VariablesMapForm variables={['1', '2']} value={{}} onChange={vi.fn()} templateBody={TEMPLATE_BODY} />);

    const highlighted1 = screen.getAllByText('{{1}}').find((el) => el.tagName.toLowerCase() === 'mark');
    expect(highlighted1).toBeDefined();
    expect(highlighted1!.closest('p')).toHaveTextContent(/hola.*\{\{1\}\}.*saldo/i);
  });

  it('muestra {{2}} resaltado con el texto que lo rodea', () => {
    render(<VariablesMapForm variables={['1', '2']} value={{}} onChange={vi.fn()} templateBody={TEMPLATE_BODY} />);

    const highlighted2 = screen.getAllByText('{{2}}').find((el) => el.tagName.toLowerCase() === 'mark');
    expect(highlighted2).toBeDefined();
    expect(highlighted2!.closest('p')).toHaveTextContent(/saldo de.*\{\{2\}\}.*vence/i);
  });
});

describe('VMF-9: sin templateBody', () => {
  it('no renderiza ningún <mark> de contexto y el resto sigue funcionando', () => {
    render(<VariablesMapForm variables={['1']} value={{}} onChange={vi.fn()} />);
    expect(document.querySelector('mark')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '{{1}}' })).toBeInTheDocument();
  });
});

describe('VMF-10: label del input de valor fijo referencia el contexto', () => {
  it('el label del input literal incluye el contexto de esa variable', () => {
    const value: CampaignVariableSpec = { '2': { source: 'literal', value: '' } };
    render(<VariablesMapForm variables={['2']} value={value} onChange={vi.fn()} templateBody={TEMPLATE_BODY} />);

    expect(screen.getByLabelText(/valor fijo.*\{\{2\}\}.*saldo/i)).toBeInTheDocument();
  });

  it('sin templateBody, el label sigue siendo claro (solo {{N}})', () => {
    const value: CampaignVariableSpec = { '1': { source: 'literal', value: '' } };
    render(<VariablesMapForm variables={['1']} value={value} onChange={vi.fn()} />);

    expect(screen.getByLabelText(/valor fijo.*\{\{1\}\}/i)).toBeInTheDocument();
  });
});
