/**
 * VariablesMapForm — composer del Bulk Messaging (F2 apply chunk 2). Por cada
 * variable del template elegido, un <select> de fuente (name/balanceDue/
 * literal) + input de texto SOLO cuando la fuente es 'literal'.
 *
 *  VMF-1 sin variables → no renderiza nada
 *  VMF-2 una fila por variable, con label asociado
 *  VMF-3 elegir 'name'/'balanceDue' llama a onChange con esa fuente, SIN `value`
 *  VMF-4 elegir 'literal' muestra el input de texto
 *  VMF-5 tipear en el input de literal llama a onChange con `{source:'literal',value}`
 *  VMF-6 volver a "Elegí una fuente…" (source vacío) saca la entrada del map
 *  VMF-7 `missingVariables` (422 MISSING_TEMPLATE_VARIABLES) resalta esa fila con role=alert
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { VariablesMapForm } from '@/pages/whatsapp/BulkMessagingPage/components/composer/VariablesMapForm';
import type { CampaignVariableSpec } from '@/types/messagingBulk';

describe('VMF-1: sin variables', () => {
  it('no renderiza nada', () => {
    const { container } = render(<VariablesMapForm variables={[]} value={{}} onChange={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('VMF-2: una fila por variable', () => {
  it('renderiza un select por variable, con label asociado', () => {
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

    await user.selectOptions(screen.getByRole('combobox', { name: '{{1}}' }), 'name');

    expect(onChange).toHaveBeenCalledWith({ '1': { source: 'name', value: undefined } });
  });

  it('elegir "balanceDue" llama a onChange con esa fuente', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<VariablesMapForm variables={['1']} value={{}} onChange={onChange} />);

    await user.selectOptions(screen.getByRole('combobox', { name: '{{1}}' }), 'balanceDue');

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

    await user.selectOptions(screen.getByRole('combobox', { name: '{{1}}' }), '');

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
