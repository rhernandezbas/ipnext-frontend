/**
 * Guard: no-dead-balance-fields
 *
 * `Customer.balanceOverdue` y `Customer.invoicesQty` NUNCA existieron en el
 * payload real de `GET /api/clients/:id` — el `toCustomer()` del BE no los
 * emite. El FE los declaraba igual, `InfoTab` tenía ramas de UI que sólo se
 * alcanzaban con props fabricadas a mano, y los tests las bendecían. El change
 * `combo-balance-honesto` los borró (tarea FA1).
 *
 * Este guard existe porque la verificación de aquel borrado fue un `rg` MANUAL
 * en la task list (1.1 / 1.6 / G.5): un `rg` que nadie vuelve a correr no
 * protege nada. Si alguien reintroduce el campo (copy/paste de un fixture
 * viejo, un merge, un "lo necesito por las dudas"), este test lo caza.
 *
 * Ocurrencias en COMENTARIOS están permitidas a propósito: el historial de por
 * qué se borraron es documentación útil. Lo que se prohíbe es código VIVO.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC_ROOT = join(__dirname, '..', '..');

const DEAD_FIELDS = /balanceOverdue|invoicesQty/;

/**
 * Saca comentarios de bloque (`/* … *\/`, TS y CSS) y de línea (`// …`) para
 * que el match sea sobre código vivo. Sin este filtro el propio comentario
 * que explica el borrado dispararía el guard (el mismo error que ya se
 * cometió una vez en el contrast test del CSS).
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function collectSrcFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      // `__tests__` se saltea: este guard nombra los campos y los fixtures
      // históricos pueden citarlos en una descripción.
      if (entry === '__tests__' || entry === 'node_modules') continue;
      results.push(...collectSrcFiles(full));
    } else if (/\.(ts|tsx|css)$/.test(entry)) {
      results.push(full);
    }
  }
  return results;
}

describe('guard no-dead-balance-fields — balanceOverdue / invoicesQty no vuelven a src/', () => {
  const files = collectSrcFiles(SRC_ROOT);

  it('recorre efectivamente el árbol de src/ (si esto es 0, el guard no está mirando nada)', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('cero ocurrencias VIVAS (fuera de comentarios) en todo src/', () => {
    const violations: string[] = [];

    for (const absPath of files) {
      const rel = relative(SRC_ROOT, absPath).replace(/\\/g, '/');
      // Los tests quedan fuera del árbol recorrido, pero este archivo vive en
      // __tests__/guards — belt-and-suspenders por si el collector cambia.
      if (rel.startsWith('__tests__/')) continue;

      const code = stripComments(readFileSync(absPath, 'utf8'));
      code.split('\n').forEach((line, idx) => {
        if (DEAD_FIELDS.test(line)) violations.push(`${rel}:${idx + 1}\n    ↳ ${line.trim()}`);
      });
    }

    if (violations.length > 0) {
      throw new Error(
        [
          '',
          `no-dead-balance-fields: ${violations.length} ocurrencia(s) viva(s)`,
          '',
          '  `balanceOverdue` / `invoicesQty` NO existen en el payload de',
          '  GET /api/clients/:id — el BE nunca los emitió. Cualquier rama de UI',
          '  que dependa de ellos es código inalcanzable en producción.',
          '  Usá `balanceDue` (+ `balanceState()`) o `ClientInvoice` del tab de',
          '  Facturación.',
          '',
        ].join('\n') + violations.join('\n\n') + '\n',
      );
    }

    expect(violations).toEqual([]);
  });
});
