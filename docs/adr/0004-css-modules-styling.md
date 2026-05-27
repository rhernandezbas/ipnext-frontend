# ADR 0004 — CSS Modules + design tokens para estilos

**Status:** Aceptado (vigente)

## Contexto

Se necesita estilado con scope local (sin colisiones de clases globales) pero sin agregar una
runtime de CSS-in-JS ni una dependencia de framework de utilidades. El equipo viene de Splynx
(CSS clásico) y prioriza simplicidad y peso de bundle.

## Decisión

- **CSS Modules** colocados junto a cada componente: `Componente.tsx` + `Componente.module.css`.
  Las clases se importan como `styles` y se componen con helpers tipo
  `[styles.btn, styles[variant]].filter(Boolean).join(' ')` (ver
  [`Button.tsx`](../../src/components/atoms/Button/Button.tsx)).
- **Design tokens** globales como custom properties CSS en `:root`, en
  [`src/tokens/variables.css`](../../src/tokens/variables.css), importadas una vez en
  [`main.tsx`](../../src/main.tsx) junto con [`reset.css`](../../src/tokens/reset.css).
- Los módulos consumen tokens vía `var(--color-primary)`, `var(--space-4)`, etc. — nunca colores
  hardcodeados (esa es la regla; ver deuda).

## Consecuencias

**Positivas**
- Scope local automático: cero colisiones de nombres de clase entre features.
- Tema centralizado: cambiar un token en `variables.css` propaga a toda la app.
- Sin runtime CSS-in-JS → bundle más liviano, sin costo de render.
- En Vitest, `css.modules.classNameStrategy: 'non-scoped'` permite testear por nombre de clase
  legible (ver [`vite.config.ts`](../../vite.config.ts)).

**Negativas / deuda**
- ⚠ **Tokens no siempre respetados.** Conviven los tokens semánticos de `variables.css` con
  hardcodeos en componentes (ej. los colores de badge en `GestionRealSyncBadge.module.css` o
  estados que usan hex directos). Hay además dos familias de color de estado: las semánticas
  (`--color-status-*`) y las de badge (`--badge-*-bg/fg`), que no están unificadas.
- ⚠ No hay modo oscuro ni theming por tenant pese a usar custom properties (que lo facilitarían).
- ⚠ Headers/toolbars de page se reescriben en CSS por feature en vez de un componente de layout
  compartido → CSS duplicado.
