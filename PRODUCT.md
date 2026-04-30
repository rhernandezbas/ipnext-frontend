# IPNEXT Backoffice — Product Context

## What

Replica del panel administrativo de Splynx, adaptado para IPNEXT. SPA React que gestiona clientes, scheduling, finanzas, networking, tickets, inventario y configuración del sistema.

## Stack

- React 18 + TypeScript + Vite
- React Router v6 (layout `AdminLayout` con sidebar + navbar)
- TanStack Query (server state)
- CSS Modules con tokens globales en `src/tokens/`
- Atomic design: atoms → molecules → organisms → templates → pages

## Layout

- Sidebar fijo izquierdo: 240px, luz blanca, nav indigo activo
- Navbar top: 60px
- Contenido principal: `margin-left: 240px`, fondo `--color-gray-50`

## Color Strategy

**Dual system:**

1. **HSL/Hex (Bootstrap-compatible)** — sistema base global en `src/tokens/variables.css`
   - Brand accent: `#6f42c1` (purple CRM)
   - Primary action: `#0d6efd` (blue)
   - Superficie: `#ffffff`
   - Borde: `#dee2e6`
   - Texto primario: `#212529`
   - Texto secundario: `#6c757d`

2. **OKLCH perceptual** — sistema avanzado en páginas modernas (ej. SchedulingPage)
   - Brand terracotta: `oklch(56% 0.2 25)`
   - Fondos cálidos: `oklch(97.5% 0.006 60)`
   - Textos jerárquicos: `oklch(17-62% 0.01-0.015 25)`

Cuando un page usa OKLCH, **todos sus tokens se definen en `.page {}` y se consumen localmente**. No mezclar OKLCH con hex en la misma página.

## Component Rules

- **Nunca** inline styles salvo overrides de colores dinámicos en JSX (ej. dot color en kanban)
- **Siempre** CSS Module por componente/página
- **No** Tailwind, no utility classes externas
- Dropdowns/tooltips/modales → React portal (`createPortal`) para escapar `overflow: hidden`
- Formularios en modal → sticky header con `position: sticky; top: 0`
