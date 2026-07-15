/**
 * templateBody — utilidades puras del body con placeholders `{{N}}` (Change 3).
 *
 *  TB-1 extractVariables: keys únicas en orden de primera aparición
 *  TB-2 extractVariables: body sin placeholders → []
 *  TB-3 splitTemplateBody: alterna texto/placeholder marcando isVar
 */
import { describe, it, expect } from 'vitest';
import { extractVariables, splitTemplateBody } from '@/pages/whatsapp/WhatsappTemplatesPage/templateBody';

describe('TB-1: extractVariables — únicas en orden', () => {
  it('deriva las keys, sin duplicar, en orden de aparición', () => {
    expect(extractVariables('Hola {{1}}, tu saldo de ${{2}} vence. Gracias {{1}}.')).toEqual(['1', '2']);
  });
});

describe('TB-2: extractVariables — sin placeholders', () => {
  it('devuelve [] cuando no hay {{N}}', () => {
    expect(extractVariables('Mensaje sin variables.')).toEqual([]);
  });
});

describe('TB-3: splitTemplateBody', () => {
  it('parte el body en segmentos texto/placeholder', () => {
    expect(splitTemplateBody('Hola {{1}}!')).toEqual([
      { text: 'Hola ', isVar: false },
      { text: '{{1}}', isVar: true },
      { text: '!', isVar: false },
    ]);
  });

  it('un body que arranca con placeholder no genera segmento vacío inicial', () => {
    expect(splitTemplateBody('{{1}} hola')).toEqual([
      { text: '{{1}}', isVar: true },
      { text: ' hola', isVar: false },
    ]);
  });
});
