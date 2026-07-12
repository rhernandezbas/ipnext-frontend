/**
 * ImageLightbox.module.css — contrato CSS de motion + a11y (fix wave
 * post-review-adversarial de messaging-inbox-v2-media). Se lee el `.css`
 * crudo vía `fs.readFileSync` (mismo patrón que
 * `MessageThread.contract.test.tsx`/`Composer.contract.test.tsx`).
 *
 * #10 (MEDIUM, fidelidad de la extracción): `.lightboxImage` en el original
 * (`TaskPhotosGallery.module.css`, pre-extracción, commit `cbf156a5`) NO
 * tenía `animation` — la extracción a este módulo AGREGÓ un scale-in
 * (`lightboxImageIn`, 0.96→1) que no existía, cambiando el comportamiento
 * visual de las fotos de tareas ya en prod. La extracción debe ser fiel: se
 * confirma que `.lightboxImage` ya NO declara ninguna animación propia — el
 * fade-in del OVERLAY original (`.lightboxOverlay`/`overlayIn`) sí se
 * mantiene, ese SÍ es del original.
 *
 * #8 (LOW, touch target): `.lightboxClose` es 40×40 (< 44px, WCAG 2.5.5).
 * Mismo patrón ya usado en el repo para `.mediaFileDownload::before`
 * (`Media.module.css`) y `.tileDelete::before` (`TaskPhotosGallery.module.css`):
 * un `::before` invisible extiende el área clickeable a 44×44 sin agrandar
 * el botón visible.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const cssPath = join(__dirname, 'ImageLightbox.module.css');
const css = readFileSync(cssPath, 'utf-8');

function extractRule(source: string, selector: string): string {
  const start = source.indexOf(selector);
  if (start === -1) throw new Error(`Selector "${selector}" no encontrado en el CSS.`);
  const open = source.indexOf('{', start);
  const close = source.indexOf('}', open);
  return source.slice(open + 1, close);
}

describe('ImageLightbox.module.css — bug MEDIUM #10 (fidelidad: sin scale-in agregado en la imagen)', () => {
  it('.lightboxImage NO declara animation (el original, pre-extracción, tampoco lo hacía)', () => {
    const block = extractRule(css, '.lightboxImage {');
    expect(block).not.toMatch(/animation:/);
  });

  it('ya no existe @keyframes lightboxImageIn (huérfano tras sacar el scale-in agregado)', () => {
    expect(css).not.toMatch(/@keyframes lightboxImageIn/);
  });

  it('.lightboxOverlay conserva su propio fade de entrada (overlayIn) — eso SÍ es del original', () => {
    const block = extractRule(css, '.lightboxOverlay {');
    expect(block).toMatch(/animation:\s*overlayIn\s+0\.18s\s+ease-out/);
  });

  it('el bloque reduced-motion ya no referencia .lightboxImage (no le queda animación que matar)', () => {
    const start = css.indexOf('@media (prefers-reduced-motion: reduce)');
    const block = css.slice(start);
    expect(block).not.toMatch(/\.lightboxImage/);
  });
});

describe('ImageLightbox.module.css — bug LOW #8 (touch target del botón cerrar, WCAG 2.5.5)', () => {
  it('.lightboxClose::before extiende el área clickeable a >=44px sin agrandar el botón visible (40px + 2px×2)', () => {
    const block = extractRule(css, '.lightboxClose::before {');
    expect(block).toMatch(/content:\s*['"]{2}/);
    expect(block).toMatch(/position:\s*absolute/);
    expect(block).toMatch(/inset:\s*-2px/);
  });
});
