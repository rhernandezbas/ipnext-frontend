/**
 * gigared-tv-cic-reuse (FE) — contrato del mapeo de errores del alta de TV.
 *
 * Los primeros tests son de CARACTERIZACIÓN: fijan verbatim el comportamiento que ya existía
 * inline en `GigaredPanel.tsx` (y que no tenía NI UN test). Si alguno se pone rojo, la
 * extracción cambió algo que no debía.
 *
 * Los últimos cubren los dos códigos NUEVOS del backend. Antes caían al fallback genérico
 * "No se pudo registrar la cuenta. Reintentá." — que frente a un 422 es MENTIRA: reintentar
 * no puede funcionar nunca. Es la misma deuda de copy deshonesto anotada el 2026-07-27.
 */
import { describe, it, expect } from 'vitest';
import { registerErrorView } from '@/pages/customers/tabs/contracts/registerErrorView';

describe('registerErrorView — caracterización de lo que YA existía', () => {
  it('NO_CIC_AVAILABLE → modal dedicado, sin banner', () => {
    const v = registerErrorView('NO_CIC_AVAILABLE');
    expect(v.poolExhaustedModal).toBe(true);
    expect(v.message).toBe('');
  });

  it('TV_POOL_POISONED → error duro, SIN reintentar', () => {
    const v = registerErrorView('TV_POOL_POISONED');
    expect(v.message).toBe(
      'No hay CICs limpios en el pool de Gigared; hace falta limpiar el pool antes de dar altas.',
    );
    expect(v.tone).toBe('error');
    expect(v.action).toBeNull();
  });

  it('TV_IDENTITY_UNVERIFIED → warning CON reintentar (transitorio)', () => {
    const v = registerErrorView('TV_IDENTITY_UNVERIFIED');
    expect(v.message).toBe('No se pudo verificar la identidad en Gigared. Reintentá.');
    expect(v.tone).toBe('warning');
    expect(v.action).toBe('retry');
  });

  it('TV_EMAIL_OWNED_BY_OTHER → warning con CTA de vincular', () => {
    const v = registerErrorView('TV_EMAIL_OWNED_BY_OTHER');
    expect(v.message).toBe('Ya existe una cuenta de TV con este email, vinculada a otro cliente.');
    expect(v.tone).toBe('warning');
    expect(v.action).toBe('link');
  });

  it('GIGARED_REJECTED → muestra el detail del partner verbatim', () => {
    expect(registerErrorView('GIGARED_REJECTED', 'Email ya utilizado').message).toBe(
      'Email ya utilizado',
    );
  });

  it('GIGARED_REJECTED sin detail → fallback propio', () => {
    expect(registerErrorView('GIGARED_REJECTED', null).message).toBe(
      'Gigared rechazó el registro. Revisá los datos.',
    );
  });

  it('código desconocido CON detail → lo prefija', () => {
    expect(registerErrorView('LO_QUE_SEA', 'boom').message).toBe('No se pudo registrar: boom');
  });

  it('código desconocido SIN detail → fallback genérico', () => {
    expect(registerErrorView(null).message).toBe('No se pudo registrar la cuenta. Reintentá.');
    expect(registerErrorView(undefined).message).toBe('No se pudo registrar la cuenta. Reintentá.');
  });
});

describe('registerErrorView — códigos NUEVOS de gigared-tv-cic-reuse', () => {
  it('TV_NO_USABLE_CIC (422, de DATOS) → SIN botón de reintentar', () => {
    const v = registerErrorView('TV_NO_USABLE_CIC');
    expect(v.action).toBeNull();
    expect(v.tone).toBe('error');
  });

  it('TV_NO_USABLE_CIC NO le dice al operador que reintente (el copy no puede mentir)', () => {
    const { message } = registerErrorView('TV_NO_USABLE_CIC');
    // No debe existir una INVITACIÓN a reintentar; sí puede explicar que no sirve.
    expect(message).not.toMatch(/\bReintentá\b/);
    expect(message).toContain('reintentar no va a cambiar el resultado');
    // Y debe decir qué hacer DE VERDAD.
    expect(message).toContain('Gigared');
  });

  it('TV_POOL_UNAVAILABLE (503, TRANSITORIO) → warning CON reintentar', () => {
    const v = registerErrorView('TV_POOL_UNAVAILABLE');
    expect(v.tone).toBe('warning');
    expect(v.action).toBe('retry');
    expect(v.message).toMatch(/Reintentá/);
  });

  it('TV_POOL_UNAVAILABLE NO filtra el detail crudo del upstream al operador', () => {
    const v = registerErrorView('TV_POOL_UNAVAILABLE', 'Request failed with status code 500');
    expect(v.message).not.toContain('status code');
    expect(v.message).not.toContain('Request failed');
  });

  it('ninguno de los dos cae al fallback genérico (era el bug)', () => {
    for (const code of ['TV_NO_USABLE_CIC', 'TV_POOL_UNAVAILABLE']) {
      expect(registerErrorView(code).message).not.toBe('No se pudo registrar la cuenta. Reintentá.');
    }
  });
});

describe('registerErrorView — invariante transversal', () => {
  it('TODO código que ofrece "retry" es transitorio, y ninguno de DATOS lo ofrece', () => {
    const transitorios = ['TV_IDENTITY_UNVERIFIED', 'TV_POOL_UNAVAILABLE'];
    const deDatos = ['TV_POOL_POISONED', 'TV_NO_USABLE_CIC'];

    for (const c of transitorios) expect(registerErrorView(c).action).toBe('retry');
    for (const c of deDatos) expect(registerErrorView(c).action).toBeNull();
  });

  it('es PURA: dos llamadas con los mismos inputs dan el mismo resultado', () => {
    expect(registerErrorView('TV_NO_USABLE_CIC')).toEqual(registerErrorView('TV_NO_USABLE_CIC'));
  });
});
