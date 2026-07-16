/**
 * parseRecipientsCsv (bulk-csv-recipients FE, CSV-FE-1..CSV-FE-3) — parser CSV
 * PROPIO, puro, sin dependencias (D8 — sin papaparse). Contrato:
 * `{ok:true, contacts, invalidRows, headerSkipped}` o `{ok:false, error:{code,
 * line?}}` (rechazo TOTAL del archivo).
 *
 *  CSV-1  3 columnas en una fila → rechazo total (ESTRUCTURA, línea)
 *  CSV-2  separador ; (Excel es-AR)
 *  CSV-3  BOM + CRLF no contaminan el parseo
 *  CSV-4  comillas con separador adentro + "" escapado
 *  CSV-5  header detectado por heurística (ambas ramas)
 *  CSV-6  filas inválidas visibles, válidas entran (sin_nombre/sin_telefono)
 *  CSV-7  archivo vacío / solo header → VACIO
 *  CSV-8  más de 5000 filas de datos → DEMASIADAS_FILAS
 *  CSV-9  más de 1MB → rechazo (validado antes de parsear)
 *  CSV-10 comilla sin cerrar → COMILLAS con línea
 *  CSV-11 línea vacía en el medio → inválida, no rompe el archivo; vacías al
 *         final → ignoradas
 *  CSV-12 separador coma / tab
 *  CSV-13 ningún separador produce 2 columnas → rechazo total
 */
import { describe, it, expect } from 'vitest';
import { parseRecipientsCsv, MAX_CSV_ROWS } from '@/pages/whatsapp/BulkMessagingPage/components/composer/parseRecipientsCsv';

describe('CSV-1: 3 columnas en una fila → rechazo total', () => {
  it('reporta ESTRUCTURA con la línea exacta, ninguna fila entra', () => {
    const lines = ['nombre;telefono'];
    for (let i = 1; i <= 6; i++) lines.push(`Cliente ${i};111100000${i}`);
    lines.push('Cliente Malo;1111000007;dato-extra');
    for (let i = 8; i <= 10; i++) lines.push(`Cliente ${i};111100000${i}`);
    const csv = lines.join('\n');

    const result = parseRecipientsCsv(csv);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('ESTRUCTURA');
      expect(result.error.line).toBe(8); // header=1 + 6 filas ok = línea 8
    }
  });
});

describe('CSV-2: separador punto y coma (Excel es-AR)', () => {
  it('parsea 1 contacto y salta el header', () => {
    const result = parseRecipientsCsv('nombre;telefono\nAna;11 2345-6789');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.contacts).toEqual([{ name: 'Ana', phone: '11 2345-6789' }]);
      expect(result.headerSkipped).toBe(true);
    }
  });
});

describe('CSV-3: BOM + CRLF', () => {
  it('el BOM no contamina la primera celda y las filas se separan bien', () => {
    const csv = '﻿nombre;telefono\r\nAna;1123456789\r\nJuan;1122334455\r\n';

    const result = parseRecipientsCsv(csv);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.contacts).toEqual([
        { name: 'Ana', phone: '1123456789' },
        { name: 'Juan', phone: '1122334455' },
      ]);
      expect(result.headerSkipped).toBe(true);
    }
  });
});

describe('CSV-4: comillas con separador adentro y "" escapado', () => {
  it('separador ; — nombre con coma adentro entre comillas', () => {
    const result = parseRecipientsCsv('nombre;telefono\n"Perez, Ana";"11 2345-6789"');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.contacts).toEqual([{ name: 'Perez, Ana', phone: '11 2345-6789' }]);
    }
  });

  it('separador , — comillas escapadas "" dentro del campo', () => {
    const result = parseRecipientsCsv('nombre,telefono\n"Juan ""Chueco"" Lopez",1134567890');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.contacts).toEqual([{ name: 'Juan "Chueco" Lopez', phone: '1134567890' }]);
    }
  });
});

describe('CSV-5: header detectado por heurística', () => {
  it('fila 1 sin dígitos en la 2da columna → se salta como header', () => {
    const result = parseRecipientsCsv('nombre,numero\nAna,1123456789');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.headerSkipped).toBe(true);
      expect(result.contacts).toEqual([{ name: 'Ana', phone: '1123456789' }]);
    }
  });

  it('fila 1 con dígitos en la 2da columna → se trata como dato (sin header)', () => {
    const result = parseRecipientsCsv('Ana,1123456789');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.headerSkipped).toBe(false);
      expect(result.contacts).toEqual([{ name: 'Ana', phone: '1123456789' }]);
    }
  });
});

describe('CSV-6: filas inválidas visibles, válidas entran', () => {
  it('4 filas: válida / sin nombre / sin teléfono / válida', () => {
    const csv = ['nombre;telefono', 'Ana;1123456789', ';1122334455', 'Juan;', 'Maria;1155667788'].join('\n');

    const result = parseRecipientsCsv(csv);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.contacts).toEqual([
        { name: 'Ana', phone: '1123456789' },
        { name: 'Maria', phone: '1155667788' },
      ]);
      expect(result.invalidRows).toEqual([
        { line: 3, phone: '1122334455', reason: 'sin_nombre' },
        { line: 4, name: 'Juan', reason: 'sin_telefono' },
      ]);
    }
  });
});

describe('CSV-7: archivo vacío / solo header', () => {
  it('archivo completamente vacío → VACIO', () => {
    const result = parseRecipientsCsv('');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VACIO');
  });

  it('archivo con solo espacios/whitespace → VACIO', () => {
    const result = parseRecipientsCsv('   \n  \n');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VACIO');
  });

  it('archivo con solo el header → VACIO', () => {
    const result = parseRecipientsCsv('nombre;telefono');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VACIO');
  });
});

describe('CSV-8: más de 5000 filas de datos → DEMASIADAS_FILAS', () => {
  it('rechaza el archivo entero', () => {
    const lines = ['nombre;telefono'];
    for (let i = 0; i < MAX_CSV_ROWS + 1; i++) lines.push(`Cliente ${i};1100000${i}`);
    const csv = lines.join('\n');

    const result = parseRecipientsCsv(csv);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('DEMASIADAS_FILAS');
  });

  it('exactamente 5000 filas de datos SÍ entra', () => {
    const lines = ['nombre;telefono'];
    for (let i = 0; i < MAX_CSV_ROWS; i++) lines.push(`Cliente ${i};1100000${i}`);
    const csv = lines.join('\n');

    const result = parseRecipientsCsv(csv);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.contacts.length).toBe(MAX_CSV_ROWS);
  });
});

describe('CSV-9: más de 1MB → rechazo (validado antes de parsear)', () => {
  it('rechaza sin intentar parsear', () => {
    const bigField = 'x'.repeat(1024 * 1024 + 10);
    const csv = `nombre;telefono\nAna;${bigField}`;

    const result = parseRecipientsCsv(csv);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('DEMASIADAS_FILAS');
  });
});

describe('CSV-10: comilla sin cerrar', () => {
  it('reporta COMILLAS con la línea', () => {
    const csv = 'nombre;telefono\n"Ana;1123456789\nJuan;1122334455';

    const result = parseRecipientsCsv(csv);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('COMILLAS');
      expect(result.error.line).toBe(2);
    }
  });
});

describe('CSV-11: líneas vacías', () => {
  it('línea vacía en el medio → inválida, no rompe el archivo', () => {
    const csv = ['nombre;telefono', 'Ana;1123456789', '', 'Juan;1122334455'].join('\n');

    const result = parseRecipientsCsv(csv);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.contacts).toEqual([
        { name: 'Ana', phone: '1123456789' },
        { name: 'Juan', phone: '1122334455' },
      ]);
      expect(result.invalidRows).toEqual([{ line: 3, reason: 'sin_nombre' }]);
    }
  });

  it('líneas vacías al final se ignoran (no generan invalidRows)', () => {
    const csv = ['nombre;telefono', 'Ana;1123456789', '', '', ''].join('\n');

    const result = parseRecipientsCsv(csv);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.contacts).toEqual([{ name: 'Ana', phone: '1123456789' }]);
      expect(result.invalidRows).toEqual([]);
    }
  });
});

describe('CSV-12: separador coma / tab', () => {
  it('separador coma', () => {
    const result = parseRecipientsCsv('nombre,telefono\nAna,1123456789');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.contacts).toEqual([{ name: 'Ana', phone: '1123456789' }]);
  });

  it('separador TAB', () => {
    const result = parseRecipientsCsv('nombre\ttelefono\nAna\t1123456789');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.contacts).toEqual([{ name: 'Ana', phone: '1123456789' }]);
  });
});

describe('CSV-13: ningún separador produce 2 columnas', () => {
  it('rechazo total (ESTRUCTURA, línea 1)', () => {
    const result = parseRecipientsCsv('nombre solo una columna\notra linea');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('ESTRUCTURA');
      expect(result.error.line).toBe(1);
    }
  });
});
