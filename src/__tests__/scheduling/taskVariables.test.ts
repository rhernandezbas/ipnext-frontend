import { describe, it, expect } from 'vitest';
import { applyTaskVariables } from '@/pages/scheduling/lib/taskVariables';

describe('applyTaskVariables', () => {
  const vars = {
    cliente: 'HERNANDEZ RONALD',
    telefono: '1178547218',
    servicio: '300MB',
    direccion: 'CALLE 52 NRO 661B',
  };

  it('replaces {{cliente}} with the client name', () => {
    expect(applyTaskVariables('Visita a {{cliente}}', vars)).toBe('Visita a HERNANDEZ RONALD');
  });

  it('replaces all four supported tokens', () => {
    const t = 'Cliente {{cliente}}, tel {{telefono}}, plan {{servicio}}, dir {{direccion}}';
    expect(applyTaskVariables(t, vars)).toBe(
      'Cliente HERNANDEZ RONALD, tel 1178547218, plan 300MB, dir CALLE 52 NRO 661B',
    );
  });

  it('is case-insensitive and tolerates inner spaces', () => {
    expect(applyTaskVariables('{{ Cliente }} y {{CLIENTE}}', vars)).toBe('HERNANDEZ RONALD y HERNANDEZ RONALD');
  });

  it('tolerates accents on telefono/direccion tokens', () => {
    expect(applyTaskVariables('{{teléfono}} - {{dirección}}', vars)).toBe('1178547218 - CALLE 52 NRO 661B');
  });

  it('replaces every occurrence (global)', () => {
    expect(applyTaskVariables('{{cliente}} {{cliente}}', vars)).toBe('HERNANDEZ RONALD HERNANDEZ RONALD');
  });

  it('leaves a token untouched when its value is missing/empty', () => {
    expect(applyTaskVariables('Hola {{cliente}}', { cliente: null })).toBe('Hola {{cliente}}');
    expect(applyTaskVariables('Hola {{cliente}}', { cliente: '' })).toBe('Hola {{cliente}}');
  });

  it('leaves unknown tokens untouched', () => {
    expect(applyTaskVariables('{{foo}} {{cliente}}', vars)).toBe('{{foo}} HERNANDEZ RONALD');
  });

  it('returns empty/whitespace input unchanged', () => {
    expect(applyTaskVariables('', vars)).toBe('');
  });

  // T08 — {{contrato}} alias
  describe('{{contrato}} alias', () => {
    it('replaces {{contrato}} with the contrato value', () => {
      expect(applyTaskVariables('Contrato: {{contrato}}', { ...vars, contrato: 'Plan FTTH - Av. Test' }))
        .toBe('Contrato: Plan FTTH - Av. Test');
    });

    it('keeps {{servicio}} working for backward compat when contrato is also set', () => {
      const allVars = { ...vars, contrato: 'Plan FTTH - Av. Test' };
      expect(applyTaskVariables('{{servicio}} / {{contrato}}', allVars))
        .toBe('300MB / Plan FTTH - Av. Test');
    });

    it('leaves {{contrato}} untouched when contrato value is null', () => {
      expect(applyTaskVariables('{{contrato}}', { ...vars, contrato: null }))
        .toBe('{{contrato}}');
    });
  });
});
