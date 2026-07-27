/**
 * VerdictCard — la REGLA DE PRESENTACIÓN del change iclass-gps-audit.
 *
 * Este componente decide si se investiga a una PERSONA REAL. Los tests de acá
 * abajo no son cosmética: bloquean tres regresiones concretas.
 *
 *  1. `NO_CONCLUYENTE` / `NO_AUDITABLE` con IGUAL peso visual que los otros dos.
 *     Si alguien los degrada a "variante apagada de no estuvo", el card pierde
 *     estructura y el test cae.
 *  2. El estado NUNCA es sólo-color: siempre hay etiqueta de texto.
 *  3. La evidencia va COMPLETA en los 4 veredictos (aunque valga "—"), y ningún
 *     texto imputa intención, dolo ni incumplimiento.
 */
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

  it.each(ALL_VERDICTS)('%s no contiene vocabulario acusatorio', (verdict) => {
    const { container, unmount } = render(<VerdictCard report={report({ verdict })} />);
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
