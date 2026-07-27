/**
 * AlertsPage.module.css — contratos estructurales (review adversarial,
 * change `noc-alerts-dashboard`, hallazgos A1/M7/M8). jsdom no aplica layout
 * real (no hay motor de paint), así que el `width`/`height` computado de un
 * `<span>` no es observable vía RTL — el contrato se valida leyendo el `.css`
 * crudo, mismo patrón que `AlertsPage.contrast.test.tsx`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const cssPath = join(__dirname, 'AlertsPage.module.css');
const css = readFileSync(cssPath, 'utf-8');

function extractRule(source: string, selector: string): string {
  const start = source.indexOf(selector);
  if (start === -1) throw new Error(`Selector "${selector}" no encontrado en el CSS.`);
  const open = source.indexOf('{', start);
  const close = source.indexOf('}', open);
  return source.slice(open + 1, close);
}

describe('AlertsPage.module.css — A1 (el dot de los tiles del resumen tiene tamaño propio)', () => {
  it('.kpiTop .dot define width/height (antes: 0x0, dependía por error de .badge .dot / .streamBadge .dot)', () => {
    const block = extractRule(css, '.kpiTop .dot {');
    expect(block).toMatch(/width:\s*\d+px/);
    expect(block).toMatch(/height:\s*\d+px/);
  });

  it('.badge .dot y .streamBadge .dot (las reglas preexistentes) NO contienen a .kpiTop — confirma que eran selectores distintos', () => {
    // El bug original: alguien podía asumir que el dot del tile heredaba
    // tamaño de una de estas dos reglas descendant-scoped. Ninguna matchea
    // un <span class="dot"> dentro de <span class="kpiTop">.
    expect(css).not.toMatch(/\.badge\s+\.kpiTop\s+\.dot/);
    expect(css).not.toMatch(/\.streamBadge\s+\.kpiTop\s+\.dot/);
  });
});

describe('AlertsPage.module.css — M7/M8 (estado activo distinguible de hover, severidad preservada)', () => {
  it('.kpiTile:hover y .kpiTile[aria-pressed="true"] usan background-color DISTINTO (no ambos --color-surface-hover)', () => {
    const hoverBlock = extractRule(css, '.kpiTile:hover {');
    const pressedBlock = extractRule(css, ".kpiTile[aria-pressed='true'] {");
    const hoverBg = hoverBlock.match(/background-color:\s*([^;]+);/)?.[1]?.trim();
    const pressedBg = pressedBlock.match(/background-color:\s*([^;]+);/)?.[1]?.trim();
    expect(hoverBg).toBeTruthy();
    expect(pressedBg).toBeTruthy();
    expect(pressedBg).not.toBe(hoverBg);
  });

  it('.kpiTile[aria-pressed="true"] NO declara border-color (evita pisar el borde de .kpiTile_critical a igual especificidad)', () => {
    const pressedBlock = extractRule(css, ".kpiTile[aria-pressed='true'] {");
    expect(pressedBlock).not.toMatch(/border-color:/);
  });

  it('.kpiTile_critical SÍ sigue fijando su propio border-color (el acento de severidad no se tocó)', () => {
    const criticalBlock = extractRule(css, '.kpiTile_critical {');
    expect(criticalBlock).toMatch(/border-color:\s*var\(--alert-critical-dot\)/);
  });

  it('.kpiTile[aria-pressed="true"] comunica "activo" por otra vía (box-shadow) ya que no toca border-color', () => {
    const pressedBlock = extractRule(css, ".kpiTile[aria-pressed='true'] {");
    expect(pressedBlock).toMatch(/box-shadow:/);
  });
});
