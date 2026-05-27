# Sistema de diseño — tokens

Todos los tokens son custom properties CSS en `:root`, definidas en
[`src/tokens/variables.css`](../../src/tokens/variables.css). Los componentes los consumen con
`var(--token)`. Fuente única de verdad para color, espaciado y tipografía.

## Color

### Semánticos
| Token | Valor | Uso |
|---|---|---|
| `--color-accent` | `#6f42c1` | Acento (morado de marca) |
| `--color-primary` | `#0d6efd` | Acción primaria / azul |
| `--color-surface` | `#ffffff` | Fondo de superficie |
| `--color-surface-hover` | `#f0f0f5` | Hover de superficie |
| `--color-text-primary` | `#212529` | Texto principal |
| `--color-text-secondary` | `#6c757d` | Texto secundario |
| `--color-border` | `#dee2e6` | Bordes |

### Marca
| Token | Valor | Uso |
|---|---|---|
| `--color-sidebar-bg` | `#2c2c3e` | Fondo del sidebar (oscuro) |
| `--color-crm-purple` | `#6f42c1` | Sección CRM |
| `--color-company-green` | `#28a745` | Sección Empresa |

### Estado
| Token | Valor | Significado |
|---|---|---|
| `--color-status-active` | `#0d6efd` | Activo |
| `--color-status-late` | `#dc3545` | Atrasado |
| `--color-status-blocked` | `#fd7e14` | Bloqueado |
| `--color-status-inactive` | `#6c757d` | Inactivo |

### Neutros
Escala de grises `--color-gray-50` … `--color-gray-900`, más `--color-white` / `--color-black`.

### Badges (familia aparte)
`--badge-{active,late,blocked,inactive}-{bg,fg}` — pares fondo/texto para badges suaves
(ej. `--badge-active-bg: #dbeafe` / `--badge-active-fg: #1e40af`).

> ⚠ **Dos familias de color de estado** (`--color-status-*` sólidos y `--badge-*` suaves) que no
> están unificadas. Un componente de estado nuevo debe elegir conscientemente cuál usar.

## Espaciado — escala base 4px

`--space-1` (4px) … `--space-12` (48px), en pasos de 4px. Usar tokens, no px crudos.

## Tipografía

- **Familia**: `--font-family: 'Inter', sans-serif`.
- **Tamaños**: `--font-size-xs` (12px) … `--font-size-3xl` (30px).
- **Pesos**: `normal` 400, `medium` 500, `semibold` 600, `bold` 700.
- **Line-height**: `tight` 1.25, `normal` 1.5, `relaxed` 1.75.

## Layout

- `--sidebar-width: 240px`
- `--navbar-height: 60px`

## Sombras y radios

- Sombras: `--shadow-sm` … `--shadow-xl` (escala de elevación).
- Radios: `--radius-sm` (4px) … `--radius-xl` (16px), `--radius-full` (pill). `--radius-button` (8px).

## Transiciones

`--transition-fast` (100ms), `--transition-normal` (200ms), `--transition-slow` (300ms), todas `ease`.

## Deuda

> ⚠ No hay tema oscuro ni theming por tenant pese a que las custom properties lo facilitarían.
> Algunos componentes hardcodean hex en vez de usar tokens (ver ADR 0004). El sidebar es oscuro
> pero el resto de la app es claro fijo.
