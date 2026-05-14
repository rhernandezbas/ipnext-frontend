# IPNEXT Frontend — Claude Context

SPA del backoffice de IPNEXT (réplica de Splynx). Antes de tocar UI o tokens, leer:

- `PRODUCT.md` — qué es el producto, layout, color strategy, reglas de componente
- `DESIGN.md` — sistema de diseño (spacing, tipografía, badges, botones, tablas, etc.)

## Stack

React 18 + TS + Vite · React Router v6 · TanStack Query · CSS Modules + tokens · Vitest + Testing Library · axios

## Scripts

```
npm run dev         # vite dev server
npm run test        # vitest run
npm run test:watch  # vitest watch
npm run typecheck   # tsc --noEmit
npm run build       # vite build (NO correr salvo que el user pida)
```

No correr `build` después de cambios (regla global del user). Para verificar cambios, usar `typecheck` y tests.

## Estructura

```
src/
  api/         # un archivo por dominio: clients.api.ts, scheduling.api.ts, ...
  hooks/       # un useX.ts por dominio, envuelve TanStack Query sobre api/
  components/  # atomic: atoms → molecules → organisms → templates
  pages/       # por dominio: clientes/, scheduling/, finanzas/, tickets/, ...
  context/     # AuthContext, etc.
  tokens/      # variables.css (HSL base) + reset.css
  types/
  __tests__/   # mirror de src/ — tests por dominio
```

Alias: `@/` → `src/`.

## Convenciones críticas

- **CSS Modules siempre**, un módulo por componente/página. Nada de Tailwind ni utility classes externas.
- **Tokens primero**: consumir `var(--color-*)`, `var(--space-*)`, `var(--font-size-*)` de `src/tokens/variables.css`. No hardcodear colores/spacing.
- **Dual color system**: HSL/hex global (Bootstrap-compat) vs OKLCH local en páginas modernas (ej. SchedulingPage). No mezclar dentro de la misma página — si la page usa OKLCH, definir todos sus tokens en `.page {}`.
- **Atomic design estricto**: atoms no conocen molecules, molecules no conocen organisms, etc.
- **API + hook por dominio**: nuevo recurso → `src/api/foo.api.ts` (axios) + `src/hooks/useFoo.ts` (TanStack Query). Las pages consumen el hook, nunca axios directo.
- **Lazy-loaded pages**: rutas en `App.tsx` usan `lazy()`. Mantener el patrón al agregar páginas.
- **Portales** para dropdowns/tooltips/modales (`createPortal`) — el repo ya tuvo bugs por `overflow: hidden` en cards.
- **Form en modal**: sticky header (`position: sticky; top: 0`).
- Inline styles: prohibidos salvo overrides dinámicos justificados (ej. color computado en JSX).

## Testing

- Vitest + Testing Library + jsdom.
- Tests viven en `src/__tests__/` espejando la estructura de `src/`.
- Mockear axios al nivel de `src/api/*` o usar `__mocks__/`.

## Git

Conventional commits, sin co-author de IA. Branch principal: `main`.
