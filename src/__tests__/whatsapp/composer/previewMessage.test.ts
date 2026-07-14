/**
 * renderPreviewMessage (messaging-bulk-v11 FE apply chunk 2, PreviewModal) —
 * arma el mensaje REAL que se va a enviar: `template.body` con cada `{{N}}`
 * reemplazado por un placeholder legible según `CampaignVariableSpec`
 * (mismo shape que `VariablesMapForm`/`CampaignComposer`).
 *
 *  PM-1 source 'name'       -> "[Nombre del cliente]"
 *  PM-2 source 'balanceDue' -> "[Monto de deuda]"
 *  PM-3 source 'literal' con value -> el valor tal cual
 *  PM-4 source 'literal' sin value (vacío/undefined) -> "[valor vacío]"
 *  PM-5 variable sin entry en el map -> "[sin mapear: {{N}}]"
 *  PM-6 varias variables mezcladas en un solo body
 *  PM-7 body sin placeholders se devuelve intacto
 *  PM-8 el mismo {{N}} repetido dos veces se reemplaza en ambas apariciones
 */
import { describe, it, expect } from 'vitest';
import { renderPreviewMessage } from '@/pages/whatsapp/BulkMessagingPage/components/composer/previewMessage';
import type { CampaignVariableSpec } from '@/types/messagingBulk';

describe('PM-1: source name', () => {
  it('reemplaza {{1}} por el placeholder de nombre', () => {
    const map: CampaignVariableSpec = { '1': { source: 'name' } };
    expect(renderPreviewMessage('Hola {{1}}!', map)).toBe('Hola [Nombre del cliente]!');
  });
});

describe('PM-2: source balanceDue', () => {
  it('reemplaza {{2}} por el placeholder de deuda', () => {
    const map: CampaignVariableSpec = { '2': { source: 'balanceDue' } };
    expect(renderPreviewMessage('Debés ${{2}}.', map)).toBe('Debés $[Monto de deuda].');
  });
});

describe('PM-3: source literal con valor', () => {
  it('reemplaza por el valor literal cargado', () => {
    const map: CampaignVariableSpec = { '3': { source: 'literal', value: 'Sucursal Centro' } };
    expect(renderPreviewMessage('Te esperamos en {{3}}.', map)).toBe('Te esperamos en Sucursal Centro.');
  });
});

describe('PM-4: source literal sin valor', () => {
  it('sin value muestra "[valor vacío]"', () => {
    const map: CampaignVariableSpec = { '3': { source: 'literal', value: '' } };
    expect(renderPreviewMessage('Te esperamos en {{3}}.', map)).toBe('Te esperamos en [valor vacío].');
  });

  it('con value undefined también muestra "[valor vacío]"', () => {
    const map: CampaignVariableSpec = { '3': { source: 'literal' } };
    expect(renderPreviewMessage('Te esperamos en {{3}}.', map)).toBe('Te esperamos en [valor vacío].');
  });

  it('con value en blanco (solo espacios) también muestra "[valor vacío]"', () => {
    const map: CampaignVariableSpec = { '3': { source: 'literal', value: '   ' } };
    expect(renderPreviewMessage('Te esperamos en {{3}}.', map)).toBe('Te esperamos en [valor vacío].');
  });
});

describe('PM-5: variable sin mapear', () => {
  it('sin entry en el map muestra "[sin mapear: {{N}}]"', () => {
    expect(renderPreviewMessage('Hola {{1}}!', {})).toBe('Hola [sin mapear: {{1}}]!');
  });
});

describe('PM-6: varias variables mezcladas', () => {
  it('combina name + balanceDue + literal en un solo body', () => {
    const map: CampaignVariableSpec = {
      '1': { source: 'name' },
      '2': { source: 'balanceDue' },
      '3': { source: 'literal', value: 'jueves' },
    };
    expect(renderPreviewMessage('Hola {{1}}, debés ${{2}}. Vencé el {{3}}.', map)).toBe(
      'Hola [Nombre del cliente], debés $[Monto de deuda]. Vencé el jueves.',
    );
  });
});

describe('PM-7: body sin placeholders', () => {
  it('se devuelve intacto', () => {
    expect(renderPreviewMessage('Mensaje fijo sin variables.', {})).toBe('Mensaje fijo sin variables.');
  });
});

describe('PM-8: la misma variable repetida', () => {
  it('reemplaza TODAS las apariciones de {{N}}', () => {
    const map: CampaignVariableSpec = { '1': { source: 'name' } };
    expect(renderPreviewMessage('{{1}}, sí, vos {{1}}!', map)).toBe(
      '[Nombre del cliente], sí, vos [Nombre del cliente]!',
    );
  });
});
