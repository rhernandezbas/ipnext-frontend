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

describe('VMF-8: mensaje completo del template (rediseño #4, templateBody)', () => {
  it('renderiza el mensaje COMPLETO una sola vez, con los tokens en su lugar real (sin truncar)', () => {
    const { container } = render(
      <VariablesMapForm variables={['1', '2']} value={{}} onChange={vi.fn()} templateBody={TEMPLATE_BODY} />,
    );

    const highlight = container.querySelector('.highlight');
    expect(highlight).not.toBeNull();
    const messageEl = highlight!.closest('p');
    expect(messageEl).not.toBeNull();
    // El body ENTERO reconstruido con los {{N}} en su lugar — sin fragmentos cortados.
    expect(messageEl!.textContent).toBe(TEMPLATE_BODY);
  });

  it('resalta cada {{N}} con una clase tokenizada en un <span>, NO con el <mark> pelado del navegador', () => {
    const { container } = render(
      <VariablesMapForm variables={['1', '2']} value={{}} onChange={vi.fn()} templateBody={TEMPLATE_BODY} />,
    );

    // El <mark> nativo se pinta amarillo por default del browser: no se usa.
    expect(container.querySelector('mark')).not.toBeInTheDocument();

    const highlights = Array.from(container.querySelectorAll('.highlight'));
    expect(highlights.map((el) => el.textContent)).toEqual(['{{1}}', '{{2}}']);
    highlights.forEach((el) => expect(el.tagName.toLowerCase()).toBe('span'));
  });
});

describe('VMF-9: sin templateBody', () => {
  it('no renderiza el mensaje ni ningún resaltado, y el mapeo sigue funcionando', () => {
    const { container } = render(<VariablesMapForm variables={['1']} value={{}} onChange={vi.fn()} />);
    expect(container.querySelector('mark')).not.toBeInTheDocument();
    expect(container.querySelector('.highlight')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '{{1}}' })).toBeInTheDocument();
  });
});

describe('VMF-10: label sr-only del input de valor fijo', () => {
  it('el input literal tiene un label accesible que referencia su {{N}}', () => {
    const value: CampaignVariableSpec = { '2': { source: 'literal', value: '' } };
    render(<VariablesMapForm variables={['2']} value={value} onChange={vi.fn()} templateBody={TEMPLATE_BODY} />);

    expect(screen.getByLabelText(/valor fijo.*\{\{2\}\}/i)).toBeInTheDocument();
  });

  it('sin templateBody, el label sigue siendo claro (Valor fijo para {{N}})', () => {
    const value: CampaignVariableSpec = { '1': { source: 'literal', value: '' } };
    render(<VariablesMapForm variables={['1']} value={value} onChange={vi.fn()} />);

    expect(screen.getByLabelText(/valor fijo.*\{\{1\}\}/i)).toBeInTheDocument();
  });
});

describe('VMF-11: sin repetición del contexto por variable (rediseño #4)', () => {
  it('el mensaje se renderiza UNA sola vez (todos los tokens en el mismo párrafo), no un fragmento por fila', () => {
    const { container } = render(
      <VariablesMapForm variables={['1', '2']} value={{}} onChange={vi.fn()} templateBody={TEMPLATE_BODY} />,
    );

    const paragraphs = new Set(
      Array.from(container.querySelectorAll('.highlight')).map((el) => el.closest('p')),
    );
    expect(paragraphs.size).toBe(1);
  });
});

const FALLBACK_LABEL = /valor por defecto \(sin cliente\)/i;

describe('VMF-12: fallback para números sin cliente (campaign-var-fallback)', () => {
  it('con fuente "name", aparece el input "Valor por defecto (sin cliente)" debajo del selector', () => {
    const value: CampaignVariableSpec = { '1': { source: 'name' } };
    render(<VariablesMapForm variables={['1']} value={value} onChange={vi.fn()} />);

    expect(screen.getByLabelText(FALLBACK_LABEL)).toBeInTheDocument();
  });

  it('con fuente "balanceDue", también aparece el input de fallback', () => {
    const value: CampaignVariableSpec = { '1': { source: 'balanceDue' } };
    render(<VariablesMapForm variables={['1']} value={value} onChange={vi.fn()} />);

    expect(screen.getByLabelText(FALLBACK_LABEL)).toBeInTheDocument();
  });

  it('muestra el hint explicando que solo aplica a los números sueltos', () => {
    const value: CampaignVariableSpec = { '1': { source: 'name' } };
    render(<VariablesMapForm variables={['1']} value={value} onChange={vi.fn()} />);

    expect(screen.getByText(/destinatarios sin cliente/i)).toBeInTheDocument();
    expect(screen.getByText(/clientes usan su dato real/i)).toBeInTheDocument();
  });

  it('con fuente "literal", NO aparece el input de fallback', () => {
    const value: CampaignVariableSpec = { '1': { source: 'literal', value: '' } };
    render(<VariablesMapForm variables={['1']} value={value} onChange={vi.fn()} />);

    expect(screen.queryByLabelText(FALLBACK_LABEL)).not.toBeInTheDocument();
  });

  it('sin fuente elegida, NO aparece el input de fallback', () => {
    render(<VariablesMapForm variables={['1']} value={{}} onChange={vi.fn()} />);

    expect(screen.queryByLabelText(FALLBACK_LABEL)).not.toBeInTheDocument();
  });

  it('tipear en el fallback llama a onChange preservando la fuente + el fallback tipeado', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const value: CampaignVariableSpec = { '1': { source: 'name' } };
    render(<VariablesMapForm variables={['1']} value={value} onChange={onChange} />);

    await user.type(screen.getByLabelText(FALLBACK_LABEL), 'x');

    expect(onChange).toHaveBeenCalledWith({ '1': { source: 'name', fallback: 'x' } });
  });

  it('vaciar el fallback guarda la entrada SIN `fallback` (undefined, nunca "")', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const value: CampaignVariableSpec = { '1': { source: 'name', fallback: 'A' } };
    render(<VariablesMapForm variables={['1']} value={value} onChange={onChange} />);

    await user.clear(screen.getByLabelText(FALLBACK_LABEL));

    // toEqual ignora `undefined`, así que esto matchea `{source:'name', fallback:undefined}`
    // pero NO matchearía `{source:'name', fallback:''}` — pinea el "no mandes ''".
    expect(onChange).toHaveBeenCalledWith({ '1': { source: 'name' } });
  });
});
