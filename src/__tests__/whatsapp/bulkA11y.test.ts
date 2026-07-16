/**
 * Fix wave — verificación de accesibilidad del Bulk Messaging (F2), atada a
 * los ARCHIVOS reales (no a hex hardcodeados sueltos): parsea las CSS Modules
 * + `tokens/variables.css`, resuelve los `var(--token)` y calcula el contraste
 * WCAG 2.1 de cada notice/hint sobre su fondo tintado.
 *
 *  FIX-6a  notices/hints del bulk sobre `--color-surface-hover` >= 4.5:1
 *  FIX-6b  StatusBadge `.inactive` (fg/bg) >= 4.5:1 (token compartido)
 *  FIX-7b  CampaignsTable `.nameLink` tap target >= 44px
 *  FIX-8c  ConfirmModal `.cancel`/`.confirm` con anillo :focus-visible
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../../..');

function readCss(relPath: string): string {
  return readFileSync(resolve(ROOT, relPath), 'utf8');
}

/** Mapa token→hex leído de tokens/variables.css. */
function loadTokens(): Record<string, string> {
  const css = readCss('src/tokens/variables.css');
  const map: Record<string, string> = {};
  for (const m of css.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    map[m[1]] = m[2];
  }
  return map;
}

/** Extrae los tokens de `color` y `background(-color)` de una clase de una CSS Module. */
function ruleTokens(relPath: string, className: string): { color?: string; background?: string } {
  const css = readCss(relPath);
  const body = css.match(new RegExp(`\\.${className}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
  const color = body.match(/(?<!-)color:\s*var\((--[\w-]+)\)/)?.[1];
  const background = body.match(/background(?:-color)?:\s*var\((--[\w-]+)\)/)?.[1];
  return { color, background };
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

const tokens = loadTokens();

/** Resuelve el contraste de una clase (fg del rule, bg = del rule o forzado por el contenedor). */
function ruleContrast(relPath: string, className: string, forcedBgToken?: string): number {
  const { color, background } = ruleTokens(relPath, className);
  const fg = tokens[color ?? ''];
  const bg = tokens[(forcedBgToken ?? background) ?? ''];
  expect(fg, `fg token ${color} en .${className}`).toBeTruthy();
  expect(bg, `bg token ${forcedBgToken ?? background} en .${className}`).toBeTruthy();
  return contrastRatio(fg, bg);
}

const COMPOSER = 'src/pages/whatsapp/BulkMessagingPage/components/composer';

describe('FIX-6a: notices/hints del bulk sobre fondo tintado >= 4.5:1', () => {
  it('SegmentPreviewPanel .notice', () => {
    expect(ruleContrast(`${COMPOSER}/SegmentPreviewPanel.module.css`, 'notice')).toBeGreaterThanOrEqual(4.5);
  });

  it('SegmentBuilder .hint', () => {
    expect(ruleContrast(`${COMPOSER}/SegmentBuilder.module.css`, 'hint')).toBeGreaterThanOrEqual(4.5);
  });

  it('TemplateSelector .notice', () => {
    expect(ruleContrast(`${COMPOSER}/TemplateSelector.module.css`, 'notice')).toBeGreaterThanOrEqual(4.5);
  });

  it('TemplateSelector .variablesList (sobre el .details tintado)', () => {
    // .variablesList no declara bg propio: hereda el surface-hover de .details.
    expect(
      ruleContrast(`${COMPOSER}/TemplateSelector.module.css`, 'variablesList', '--color-surface-hover'),
    ).toBeGreaterThanOrEqual(4.5);
  });
});

describe('Rediseño C: stat tiles del detalle sobre fondo tintado >= 4.5:1', () => {
  it('CampaignHeader .counter dt (labels sobre el surface-hover del tile)', () => {
    // El rediseño le dio fondo --color-surface-hover al .counter: los labels
    // (dt) ya no se apoyan sobre surface blanco — mismo pairing que FIX-6a.
    expect(
      ruleContrast(
        'src/pages/whatsapp/BulkMessagingPage/components/detail/CampaignHeader.module.css',
        'counter dt',
        '--color-surface-hover',
      ),
    ).toBeGreaterThanOrEqual(4.5);
  });
});

describe('FIX-6b: StatusBadge .inactive >= 4.5:1 (token compartido)', () => {
  it('badge-inactive-fg sobre badge-inactive-bg', () => {
    expect(
      ruleContrast('src/components/atoms/StatusBadge/StatusBadge.module.css', 'inactive'),
    ).toBeGreaterThanOrEqual(4.5);
  });
});

describe('FIX-7b: CampaignsTable .nameLink tap target >= 44px', () => {
  it('el link "ver detalle" tiene min-height de 44px', () => {
    const css = readCss('src/pages/whatsapp/BulkMessagingPage/components/history/CampaignsTable.module.css');
    const body = css.match(/\.nameLink\s*\{([^}]*)\}/)?.[1] ?? '';
    const minHeight = body.match(/min-height:\s*([^;]+);/)?.[1]?.trim();
    expect(minHeight, '.nameLink min-height').toBeTruthy();
    const px = minHeight === 'var(--space-11)' ? 44 : parseInt(minHeight ?? '0', 10);
    expect(px).toBeGreaterThanOrEqual(44);
  });
});

describe('FIX-8c: ConfirmModal :focus-visible en cancel/confirm', () => {
  it('declara un anillo de foco para los botones', () => {
    const css = readCss('src/components/molecules/ConfirmModal/ConfirmModal.module.css');
    expect(css).toMatch(/\.(cancel|confirm)[^{]*:focus-visible/);
  });
});

/**
 * HOTFIX bulk-dropdown-z (EN PROD, screenshot del usuario) — en
 * `/admin/whatsapp/bulk`, al abrir el `Select` de Template el dropdown
 * quedaba SUPERPUESTO con la card "Segmento de destinatarios": el título se
 * dibujaba ENCIMA/entre las opciones abiertas.
 *
 * Causa raíz CONFIRMADA: el rediseño (b84869a9) le puso a cada card del
 * composer una entrada `cardIn ... both` cuyo keyframe final deja
 * `transform: translateY(0)` — con `fill-mode: both` ese valor NO se limpia
 * al terminar la animación (a diferencia del fill-mode `none` default), así
 * que la card queda con un `transform` != `none` PARA SIEMPRE. Cualquier
 * `transform` != `none` crea un stacking context (CSS Position L3 §Creating
 * a stacking context), aunque `position: relative` + `z-index: auto` por sí
 * solos NO lo hacen. Con la card1 (TemplateSelector) atrapada en su propio
 * stacking context permanente, el `z-index: 30` de su `.listbox` (Select) ya
 * no compite al nivel de la raíz: se compara SOLO contra hermanos DENTRO de
 * esa card. La card2 siguiente (SegmentBuilder), al no tener z-index propio
 * pero SER un hermano posterior en el mismo stacking context padre, se
 * pinta ENCIMA de la card1 completa (con su dropdown adentro) — de ahí el
 * solapamiento reportado. Mismo bug, segunda instancia real confirmada:
 * `ManualRecipientsPicker` envuelve a `CustomerPicker` (dropdown propio,
 * `position: absolute; z-index: 20`, SIN portal) bajo la MISMA animación
 * `cardIn ... both`.
 *
 * Fix (robusto, no parche puntual):
 *  1) Todo keyframe de entrada de card con fill-mode `both` debe terminar en
 *     `transform: none` (no `translateY(0)`) — visualmente IDÉNTICO en reposo
 *     (translateY(0) y none son la misma matriz identidad), pero el valor
 *     RETENIDO tras `both` ya no crea un stacking context permanente.
 *  2) Cinturón y tirantes: la card que contiene un combobox propio (trigger
 *     enfocable) sube su propia prioridad de apilado con
 *     `:focus-within { position: relative; z-index: 1 }` — cubre el caso
 *     "dropdown abierto DURANTE los ~220ms de la animación de entrada"
 *     (un transform no-`none` en un frame intermedio TAMBIÉN crea stacking
 *     context, fix #1 no alcanza a cubrir ese instante) y cualquier otro
 *     stacking context que aparezca a futuro (ej. una lib nueva que agregue
 *     `transform`/`filter`/`will-change` a la card).
 */

/** Extrae el bloque completo de un `@keyframes` por nombre, contando llaves
 * anidadas (`from { … } to { … }`) — el `[^}]*` de `ruleTokens`/`readCss`
 * de arriba NO alcanza acá porque el bloque tiene sub-reglas con sus propias
 * llaves. */
function keyframesBlock(relPath: string, name: string): string {
  const css = readCss(relPath);
  const marker = `@keyframes ${name}`;
  const start = css.indexOf(marker);
  expect(start, `@keyframes ${name} en ${relPath}`).toBeGreaterThanOrEqual(0);
  const braceStart = css.indexOf('{', start);
  let depth = 0;
  let i = braceStart;
  for (; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
  }
  return css.slice(braceStart, i);
}

const MOLECULES = 'src/components/molecules';

describe('HOTFIX bulk-dropdown-z: animation-fill-mode "both" nunca retiene un transform residual', () => {
  // Cada archivo del rediseño del composer (+ ManualRecipientsPicker, molecule
  // consumido EXCLUSIVAMENTE por el composer) que declara al menos una
  // `animation: <keyframe> … both`.
  const filesToScan = [
    `${COMPOSER}/CampaignComposer.module.css`,
    `${COMPOSER}/TemplateSelector.module.css`,
    `${COMPOSER}/SegmentBuilder.module.css`,
    `${COMPOSER}/VariablesMapForm.module.css`,
    `${COMPOSER}/CsvRecipientsUploader.module.css`,
    `${COMPOSER}/SegmentPreviewPanel.module.css`,
    'src/pages/whatsapp/BulkMessagingPage/components/detail/CampaignDetail.module.css',
    'src/pages/whatsapp/BulkMessagingPage/components/detail/SendCampaignButton.module.css',
    `${MOLECULES}/ManualRecipientsPicker/ManualRecipientsPicker.module.css`,
  ];

  it.each(filesToScan)('%s', (relPath) => {
    const css = readCss(relPath);
    const usedWithBoth = [...css.matchAll(/animation:\s*([\w-]+)\s+[^;]*\bboth\b/g)].map((m) => m[1]);
    expect(usedWithBoth.length, `esperaba >=1 "animation: … both" en ${relPath}`).toBeGreaterThan(0);

    for (const name of new Set(usedWithBoth)) {
      const block = keyframesBlock(relPath, name);
      const toBlock = block.match(/(?:to|100%)\s*\{([^}]*)\}/)?.[1] ?? '';
      if (/transform\s*:/.test(toBlock)) {
        expect(toBlock, `@keyframes ${name} (${relPath}) — el estado final NO debe retener transform != none`).toMatch(
          /transform:\s*none\s*;/,
        );
      }
    }
  });
});

describe('HOTFIX bulk-dropdown-z: :focus-within sube la prioridad de apilado de la card con combobox propio', () => {
  it('TemplateSelector .section — contiene el Select de Template', () => {
    const css = readCss(`${COMPOSER}/TemplateSelector.module.css`);
    expect(css).toMatch(/\.section:focus-within\s*\{[^}]*z-index/);
  });

  it('ManualRecipientsPicker .wrap — contiene el CustomerPicker (dropdown propio, sin portal)', () => {
    const css = readCss(`${MOLECULES}/ManualRecipientsPicker/ManualRecipientsPicker.module.css`);
    expect(css).toMatch(/\.wrap:focus-within\s*\{[^}]*z-index/);
  });
});
