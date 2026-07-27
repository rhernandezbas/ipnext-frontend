/**
 * VerdictCard — la REGLA DE PRESENTACIÓN del change iclass-gps-audit.
 *
 * Este componente decide si se investiga a una PERSONA REAL. Los tests de acá
 * abajo no son cosmética: bloquean regresiones concretas.
 *
 *  1. ESTRUCTURA idéntica en los 4 veredictos (VC-1): mismo contenedor, mismo
 *     nivel de heading, las 10 filas de evidencia siempre presentes.
 *  2. PESO VISUAL idéntico en los 4 (VC-1b). Esto NO se puede verificar desde el
 *     DOM: el entorno de test no aplica los CSS modules (`classNameStrategy:
 *     'non-scoped'` en vite.config → los estilos no se inyectan), así que
 *     `getComputedStyle` devolvería lo mismo con o sin `opacity:.6`. Por eso el
 *     assert va sobre la FUENTE del CSS module: las reglas por veredicto sólo
 *     pueden setear custom properties `--verdict-*` (tono), nunca opacidad,
 *     tamaño de fuente ni filtros. Un test que prometía blindar esto mirando el
 *     DOM era exactamente el defecto que este change combate.
 *  3. El estado NUNCA es sólo-color: siempre hay etiqueta de texto.
 *  4. La evidencia va COMPLETA en los 4 veredictos (aunque valga "—"), y ningún
 *     texto imputa intención, dolo ni incumplimiento — incluido el `reason` que
 *     manda el servidor, que también se renderiza.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { VerdictCard } from '@/components/technicians/VerdictCard';
import type { ServiceOrderPresenceReport, PresenceVerdict } from '@/types/technicianLocation';

function report(overrides: Partial<ServiceOrderPresenceReport> = {}): ServiceOrderPresenceReport {
  return {
    verdict: 'EN_SITIO',
    reason: null,
    minDistanceMeters: 3,
    closestPointAt: '2026-07-26T21:18:00.000Z',
    closestAccuracyMeters: 12.4,
    pointsEvaluated: 16,
    largestCoverageGapMinutes: 7,
    window: { from: '2026-07-26T23:14:02.000Z', to: '2026-07-26T23:46:18.000Z' },
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=-34.6,-58.38',
    onSiteThresholdMeters: 150,
    serviceOrderCode: '4905',
    teamLogin: 'IPNXDENIC',
    teamTechnicianName: 'Denis C.',
    resultCodeName: 'Instalación OK',
    closureCoordinates: null,
    ...overrides,
  };
}

const ALL_VERDICTS: PresenceVerdict[] = [
  'EN_SITIO',
  'FUERA_DE_SITIO',
  'NO_CONCLUYENTE',
  'NO_AUDITABLE',
];

/** Las 10 filas de evidencia que TODO veredicto debe exponer, aunque valgan "—". */
const EVIDENCE_ROWS = [
  'evidence-distance',
  'evidence-closest-at',
  'evidence-accuracy',
  'evidence-points',
  'evidence-gap',
  'evidence-window',
  'evidence-threshold',
  'evidence-team',
  'evidence-result',
  'evidence-closure',
];

describe('VC-1: los cuatro veredictos tienen la MISMA estructura (igual peso visual)', () => {
  it.each(ALL_VERDICTS)('%s renderiza título, significado y la evidencia completa', (verdict) => {
    const { unmount } = render(<VerdictCard report={report({ verdict })} />);

    const card = screen.getByTestId('verdict-card');
    // Mismo contenedor, mismo nivel de heading, misma clase base para los 4.
    expect(card).toHaveAttribute('data-verdict', verdict);
    expect(card.className).toContain('card');
    expect(within(card).getByRole('heading', { level: 3 })).toBeInTheDocument();
    expect(within(card).getByTestId('verdict-meaning')).toBeInTheDocument();

    // La evidencia va SIEMPRE, con las mismas filas — ninguna se oculta.
    for (const row of EVIDENCE_ROWS) {
      expect(within(card).getByTestId(row)).toBeInTheDocument();
    }

    unmount();
  });

  it('ningún veredicto se marca como atenuado/secundario', () => {
    for (const verdict of ALL_VERDICTS) {
      const { unmount } = render(<VerdictCard report={report({ verdict })} />);
      const card = screen.getByTestId('verdict-card');
      expect(card.className).not.toMatch(/muted|dimmed|secondary|weak/i);
      unmount();
    }
  });
});

/**
 * VC-1b — el "igual peso visual" verificado donde REALMENTE vive: el CSS.
 *
 * En el entorno de test los CSS modules no se inyectan, así que ningún assert
 * sobre el DOM puede detectar un `opacity:.6` en `[data-verdict='NO_CONCLUYENTE']`.
 * Este test lee la fuente del módulo y exige que las reglas por veredicto sólo
 * seteen el TONO (`--verdict-*`). Cualquier intento de apagar un veredicto —
 * opacidad, tamaño, peso, filtro, escala — cae acá.
 */
describe('VC-1b: el CSS no puede apagar un veredicto', () => {
  // La ruta se resuelve contra ESTE archivo, no contra el cwd: `readFileSync`
  // con ruta relativa asume que vitest corre desde la raíz del proyecto, y
  // cualquier invocación con otro cwd (`--root ..`, un runner desde `src/`)
  // reventaba con ENOENT y se llevaba puesto el archivo de tests ENTERO — 25
  // tests desaparecidos sin que nadie los declare rotos.
  const here = dirname(expect.getState().testPath as string);
  const css = readFileSync(
    resolve(here, '../../components/technicians/VerdictCard.module.css'),
    'utf8',
  );

  /** Reglas (selector + cuerpo) que discriminan por veredicto. */
  const verdictRules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map(([, selector, body]) => ({ selector: selector.trim(), body }))
    .filter((r) => r.selector.includes('[data-verdict='));

  /** Declaraciones `prop: value` de una regla, ya partidas y limpias. */
  const declarations = (body: string) =>
    body
      .split(';')
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => {
        const i = d.indexOf(':');
        return { prop: d.slice(0, i).trim(), value: d.slice(i + 1).trim() };
      });

  /** Valores que EXISTEN como declaración pero no pintan nada. */
  const INVISIBLE = /^(transparent|none|0|0px|initial|unset|revert|inherit|currentcolor)$/i;

  it('define una regla de tono para cada uno de los 4 veredictos', () => {
    for (const verdict of ALL_VERDICTS) {
      expect(
        verdictRules.some((r) => r.selector.includes(verdict)),
        `falta la regla de tono de ${verdict}`,
      ).toBe(true);
    }
  });

  it('las reglas por veredicto SÓLO setean custom properties --verdict-*', () => {
    expect(verdictRules.length).toBeGreaterThan(0);

    for (const { selector, body } of verdictRules) {
      const props = declarations(body).map((d) => d.prop);

      expect(props.length, `${selector} no declara nada`).toBeGreaterThan(0);
      for (const prop of props) {
        expect(
          prop,
          `${selector} toca "${prop}": el tono es lo ÚNICO que puede variar por veredicto`,
        ).toMatch(/^--verdict-/);
      }
    }
  });

  /**
   * Mirar sólo los NOMBRES de propiedad deja abierta la puerta grande: un
   * `--verdict-accent: transparent` en NO_CONCLUYENTE pasa los tres tests de
   * arriba y deja ese veredicto SIN barra de tono — apagado, que es justo lo
   * que la regla prohíbe. El valor también se audita.
   */
  it('cada veredicto declara un --verdict-accent que efectivamente PINTA', () => {
    for (const verdict of ALL_VERDICTS) {
      const rule = verdictRules.find((r) => r.selector.includes(verdict));
      expect(rule, `falta la regla de tono de ${verdict}`).toBeDefined();

      const accent = declarations(rule!.body).find((d) => d.prop === '--verdict-accent');
      expect(accent, `${verdict} no declara --verdict-accent: queda sin barra de tono`).toBeDefined();
      expect(
        accent!.value,
        `${verdict} declara --verdict-accent: ${accent!.value} — eso apaga la barra`,
      ).not.toMatch(INVISIBLE);
      expect(accent!.value.length, `${verdict} declara --verdict-accent vacío`).toBeGreaterThan(0);
    }
  });

  it('ningún valor de tono es invisible (transparent / none / 0)', () => {
    for (const { selector, body } of verdictRules) {
      for (const { prop, value } of declarations(body)) {
        expect(
          value,
          `${selector} setea "${prop}: ${value}" — un valor que no pinta apaga el veredicto`,
        ).not.toMatch(INVISIBLE);
      }
    }
  });

  it('el título y el card base no se redefinen por veredicto', () => {
    // Un `.card[data-verdict='X'] .title { font-size: … }` sería la puerta de
    // atrás para degradar NO_CONCLUYENTE sin tocar la regla de tono.
    for (const { selector } of verdictRules) {
      expect(selector).toMatch(/^\.card\[data-verdict='[A-Z_]+'\]$/);
    }
  });
});

describe('VC-2: el estado no depende sólo del color', () => {
  it.each([
    ['EN_SITIO', /en sitio/i],
    ['FUERA_DE_SITIO', /fuera de sitio/i],
    ['NO_CONCLUYENTE', /no concluyente/i],
    ['NO_AUDITABLE', /no auditable/i],
  ] as const)('%s muestra su etiqueta en texto', (verdict, label) => {
    const { unmount } = render(<VerdictCard report={report({ verdict })} />);
    expect(screen.getByRole('heading', { level: 3, name: label })).toBeInTheDocument();
    unmount();
  });
});

describe('VC-3: NO_CONCLUYENTE dice explícitamente que NO es ausencia', () => {
  it('aclara que la falta de datos no implica que la cuadrilla no haya ido', () => {
    render(<VerdictCard report={report({ verdict: 'NO_CONCLUYENTE', pointsEvaluated: 0 })} />);
    expect(screen.getByTestId('verdict-meaning').textContent ?? '').toMatch(
      /no significa que la cuadrilla no haya ido/i,
    );
  });

  it('expone los puntos evaluados para que se pueda juzgar la solidez', () => {
    render(<VerdictCard report={report({ verdict: 'NO_CONCLUYENTE', pointsEvaluated: 0 })} />);
    expect(screen.getByTestId('evidence-points')).toHaveTextContent('0');
  });
});

describe('VC-4: la evidencia va completa', () => {
  it('muestra distancia, hora, precisión, puntos, hueco, ventana, umbral y link a Maps', () => {
    render(<VerdictCard report={report({ verdict: 'FUERA_DE_SITIO', minDistanceMeters: 12867 })} />);

    expect(screen.getByTestId('evidence-distance')).toHaveTextContent(/12,?9 km|12867/);
    expect(screen.getByTestId('evidence-closest-at')).not.toHaveTextContent('—');
    expect(screen.getByTestId('evidence-accuracy')).toHaveTextContent('12');
    expect(screen.getByTestId('evidence-points')).toHaveTextContent('16');
    expect(screen.getByTestId('evidence-gap')).toHaveTextContent('7');
    expect(screen.getByTestId('evidence-window')).not.toHaveTextContent('—');
    expect(screen.getByTestId('evidence-threshold')).toHaveTextContent('150');
    expect(screen.getByRole('link', { name: /maps/i })).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query=-34.6,-58.38',
    );
  });

  it('degrada a "—" sin ocultar la fila cuando el dato no existe', () => {
    render(
      <VerdictCard
        report={report({
          verdict: 'NO_AUDITABLE',
          reason: 'La orden no tiene domicilio geolocalizado',
          minDistanceMeters: null,
          closestPointAt: null,
          closestAccuracyMeters: null,
          largestCoverageGapMinutes: null,
          window: null,
          mapsUrl: null,
          pointsEvaluated: 0,
        })}
      />,
    );

    expect(screen.getByTestId('evidence-distance')).toHaveTextContent('—');
    expect(screen.getByTestId('evidence-window')).toHaveTextContent('—');
    expect(screen.queryByRole('link', { name: /maps/i })).not.toBeInTheDocument();
    expect(screen.getByText(/no tiene domicilio geolocalizado/i)).toBeInTheDocument();
  });
});

describe('VC-5: el texto no imputa intención ni incumplimiento', () => {
  const FORBIDDEN = /mintió|mentira|incumpl|fraude|dolo|culpab|sanci|falseó|engañ/i;

  /**
   * El `reason` lo escribe el SERVIDOR y se renderiza tal cual: es la parte del
   * card más expuesta a colar vocabulario acusatorio. Los fixtures lo dejaban en
   * `null`, así que el barrido nunca lo tocaba — el test decía cubrir algo que
   * no cubría. Acá va poblado y además se verifica que efectivamente se pinta.
   */
  const REASON = 'Sin puntos GPS de la cuadrilla dentro de la ventana evaluada';

  it.each(ALL_VERDICTS)('%s no contiene vocabulario acusatorio', (verdict) => {
    const { container, unmount } = render(
      <VerdictCard report={report({ verdict, reason: REASON })} />,
    );
    expect(container.textContent ?? '').toContain(REASON);
    expect(container.textContent ?? '').not.toMatch(FORBIDDEN);
    unmount();
  });

  it('aclara que la evidencia habla del dispositivo, no de quién lo operaba', () => {
    render(<VerdictCard report={report()} />);
    expect(screen.getByTestId('verdict-disclaimer').textContent ?? '').toMatch(
      /no establece quién lo operaba/i,
    );
  });
});

/**
 * VC-6 — la ventana evaluada no puede perder el cambio de día.
 *
 * Rendir el extremo `to` como sólo hora convierte "26 jul 23:35 → 27 jul 00:20"
 * en "26 jul - 23:35 → 00:20": se lee como una ventana que corre 23 h HACIA
 * ATRÁS. Con una orden abierta el lunes 18:00 y cerrada el martes 09:00 el
 * lector cree que se evaluaron 30 min cuando fueron 15 h — y eso cambia por
 * completo el peso de `pointsEvaluated`.
 */
describe('VC-6: la ventana evaluada muestra la fecha cuando cruza el día', () => {
  it('mismo día argentino → fecha una sola vez, el cierre es sólo hora', () => {
    render(<VerdictCard report={report()} />);
    // 23:14 UTC del 26 = 20:14 ART del 26; 23:46 UTC = 20:46 ART del mismo día.
    expect(screen.getByTestId('evidence-window')).toHaveTextContent(
      '26 jul 2026 - 20:14 → 20:46',
    );
  });

  it('cruce de medianoche → el extremo "to" lleva su propia fecha', () => {
    render(
      <VerdictCard
        report={report({
          // 23:50 ART del 26 → 00:05 ART del 27.
          window: { from: '2026-07-27T02:50:00.000Z', to: '2026-07-27T03:05:00.000Z' },
        })}
      />,
    );
    expect(screen.getByTestId('evidence-window')).toHaveTextContent(
      '26 jul 2026 - 23:50 → 27 jul 2026 - 00:05',
    );
  });

  it('ventana de 15 h a caballo de dos días → se ven los dos días', () => {
    render(
      <VerdictCard
        report={report({
          // Lunes 18:00 ART → martes 09:00 ART.
          window: { from: '2026-07-27T21:00:00.000Z', to: '2026-07-28T12:00:00.000Z' },
        })}
      />,
    );
    const text = screen.getByTestId('evidence-window').textContent ?? '';
    expect(text).toContain('27 jul 2026 - 18:00');
    expect(text).toContain('28 jul 2026 - 09:00');
  });
});
