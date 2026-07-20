/**
 * parseRecipientNumbers (bulk-granular-perms FE) — parser PURO del tab
 * "Números" de la card Destinatarios. Molde `parseRecipientsCsv`, pero mucho
 * más liviano: el operador pega números sueltos (uno por línea), opcionalmente
 * `número, nombre`. La AUTORIDAD del formato AR es el BE (`toWhatsAppE164`) —
 * acá sólo se valida PRESENCIA de al menos un dígito y se arma `{name, phone}`.
 *
 *  PN-1 una línea con sólo número → `{ name: phone, phone }` (nombre default = número)
 *  PN-2 una línea `número, nombre` → toma el nombre después de la coma
 *  PN-3 varias líneas → varios contactos, en orden
 *  PN-4 líneas vacías / sólo espacios se ignoran
 *  PN-5 una línea sin ningún dígito se descarta (no es un número)
 *  PN-6 respeta CRLF y espacios alrededor
 */
import { describe, it, expect } from 'vitest';
import { parseRecipientNumbers } from '@/pages/whatsapp/BulkMessagingPage/components/composer/parseRecipientNumbers';

describe('PN-1: una línea con sólo número', () => {
  it('usa el número como nombre por default', () => {
    expect(parseRecipientNumbers('1123456789')).toEqual([{ name: '1123456789', phone: '1123456789' }]);
  });
});

describe('PN-2: línea `número, nombre`', () => {
  it('toma el nombre después de la primera coma', () => {
    expect(parseRecipientNumbers('1123456789, Ana Gómez')).toEqual([
      { name: 'Ana Gómez', phone: '1123456789' },
    ]);
  });
});

describe('PN-3: varias líneas', () => {
  it('devuelve un contacto por línea, en orden', () => {
    expect(parseRecipientNumbers('1123456789, Ana\n1198765432')).toEqual([
      { name: 'Ana', phone: '1123456789' },
      { name: '1198765432', phone: '1198765432' },
    ]);
  });
});

describe('PN-4: líneas vacías o de sólo espacios', () => {
  it('se ignoran', () => {
    expect(parseRecipientNumbers('\n  \n1123456789\n\n')).toEqual([
      { name: '1123456789', phone: '1123456789' },
    ]);
  });
});

describe('PN-5: línea sin dígitos', () => {
  it('se descarta (no es un número)', () => {
    expect(parseRecipientNumbers('Ana Gómez\n1123456789')).toEqual([
      { name: '1123456789', phone: '1123456789' },
    ]);
  });
});

describe('PN-6: CRLF y espacios alrededor', () => {
  it('trimea la línea y respeta \\r\\n', () => {
    expect(parseRecipientNumbers('  1123456789 , Ana \r\n 1198765432 ')).toEqual([
      { name: 'Ana', phone: '1123456789' },
      { name: '1198765432', phone: '1198765432' },
    ]);
  });
});
