# IPNEXT Design System

## Tokens (`src/tokens/variables.css`)

### Spacing — base 4px
```
--space-1: 4px    --space-5: 20px   --space-9:  36px
--space-2: 8px    --space-6: 24px   --space-10: 40px
--space-3: 12px   --space-7: 28px   --space-11: 44px
--space-4: 16px   --space-8: 32px   --space-12: 48px
```

### Typography — Inter
```
--font-size-xs: 12px  --font-weight-normal:   400
--font-size-sm: 14px  --font-weight-medium:   500
--font-size-md: 16px  --font-weight-semibold: 600
--font-size-lg: 18px  --font-weight-bold:     700
--font-size-xl: 20px
--font-size-2xl: 24px
```

Page titles: 20–24px / 600–700  
Section headings: 18–20px / 600  
Body: 14px / 400  
Table headers: 12px / 500–600 / uppercase / letter-spacing 0.03em  
Labels de form: 12px / 500 / uppercase

### Border Radius
```
--radius-sm:   4px    --radius-xl:   16px
--radius-md:   8px    --radius-full: 9999px
--radius-lg:   12px
```

### Shadows
```
--shadow-sm: 0 1px 2px rgba(0,0,0,.05)
--shadow-md: 0 4px 6px -1px rgba(0,0,0,.1), 0 2px 4px -1px rgba(0,0,0,.06)
--shadow-lg: 0 10px 15px -3px rgba(0,0,0,.1), 0 4px 6px -2px rgba(0,0,0,.05)
```

### Transitions
```
--transition-fast:   100ms ease
--transition-normal: 200ms ease
--transition-slow:   300ms ease
```

---

## Buttons

| Variante    | Background                       | Border                          | Text    |
|-------------|----------------------------------|---------------------------------|---------|
| Primary     | `var(--color-primary)` #0d6efd   | none                            | white   |
| Secondary   | white                            | `1px solid var(--color-border)` | #212529 |
| Danger      | transparent                      | `1px solid #dc3545`             | #dc3545 |
| Ghost       | transparent                      | none                            | #6c757d |

Altura estándar: 36px. Padding: `0 16px`. Border-radius: 8px. Font-size: 13–14px / 500.  
Hover: oscurece fondo 10%. Focus: `outline: 2px solid var(--color-accent); outline-offset: 2px`.

---

## Badges / Status

### Sistema HSL (páginas estándar)
```css
.statusActive:   background #dbeafe; color #1e40af  (blue)
.statusInactive: background #f3f4f6; color #6b7280  (gray)
.roleSuperadmin: background #fef3c7; color #92400e  (amber)
.roleAdmin:      background #dbeafe; color #1e40af  (blue)
```

### Sistema OKLCH (páginas modernas)
```css
/* Task status */
pending:    bg oklch(96% .07 80),    fg oklch(44% .17 72)    /* yellow-brown */
in_progress: bg oklch(93% .08 230), fg oklch(38% .18 230)   /* blue */
completed:  bg oklch(93% .08 148),  fg oklch(34% .15 148)   /* green */
cancelled:  bg oklch(94.5% .006 25),fg oklch(52% .01 25)    /* neutral */

/* Priority */
urgent: bg oklch(95% .1 25),   fg oklch(40% .22 25)  /* red */
high:   bg oklch(96% .1 52),   fg oklch(46% .2 52)   /* orange */
normal: bg oklch(93% .07 230), fg oklch(40% .15 230) /* blue */
low:    bg oklch(95% .006 60), fg oklch(52% .008 60) /* gray */
```

Padding: `3px 8px`. Border-radius: 100px (pill). Font-size: 12px / 500.

---

## Cards

```css
background: var(--color-surface);       /* white */
border: 1px solid var(--color-border);  /* #dee2e6 */
border-radius: var(--radius-md);        /* 8–12px */
padding: 20–24px;
box-shadow: none o --shadow-sm;
```

Stats bar: flex row, `border-right` entre items, sin gap.

---

## Tables

```css
/* Wrapper */
border: 1px solid var(--color-border);
border-radius: var(--radius-lg);    /* 12px */
overflow: hidden;                   /* clip border-radius */

/* IMPORTANTE: overflow:hidden clipea dropdowns */
/* → Usar React portal para KebabMenu y demás dropdowns */

/* Header */
background: var(--bg-surface);
th: padding 11px 14px; font-size 12px; font-weight 600; uppercase; letter-spacing .03em

/* Body */
td: padding 12px 14px; font-size 13.5px; border-bottom 1px solid var(--border)
tr:hover: background var(--bg-hover); transition 100ms
```

---

## Modals

```css
/* Overlay */
position: fixed; inset: 0; z-index: 100;
background: oklch(0% 0 0 / .35);   /* o rgba(0,0,0,.4) */
backdrop-filter: blur(2px);
display: flex; align-items: center; justify-content: center;

/* Modal box */
background: var(--bg-card);
border-radius: 16px;
width: 480–580px; max-width: 100%; max-height: 90vh;
overflow-y: auto;
box-shadow: 0 24px 48px oklch(0% 0 0 / .18), 0 8px 16px oklch(0% 0 0 / .08);

/* Header — sticky */
position: sticky; top: 0; background: var(--bg-card); z-index: 1;
padding: 20px 24px 16px;
border-bottom: 1px solid var(--border);
```

---

## Forms

```css
/* Control */
height: 36px; padding: 0 10px;
border: 1px solid var(--border-strong);
border-radius: 8px; font-size: 13.5px;

focus:
  border-color: var(--brand);
  box-shadow: 0 0 0 3px oklch(56% .2 25 / .1);

/* textarea */
min-height: 72px; padding: 8px 10px; resize: vertical;

/* Grupos */
.formGroup: display flex; flex-direction column; gap 4px
.formRow:   display grid; grid-template-columns 1fr 1fr; gap 12px
label:      font-size 12px; font-weight 500; color var(--text-2); uppercase
```

---

## Navigation (Sidebar)

- Fondo: `#ffffff`, borde derecho: `1px solid #e5e7eb`
- Nav link activo: `background #6366f1` (indigo), texto blanco
- Nav link hover: `background #f3f4f6`, texto `#111827`
- Section titles: 10px / 700 / uppercase / color indigo `#6366f1`
- Padding link: `7px 16px`, border-radius: 6px, margin: `1px 8px`

---

## Reglas críticas

1. **Dropdowns dentro de tablas** → siempre React portal (`createPortal`) por el `overflow:hidden` del wrapper
2. **OKLCH vs HSL** → no mezclar en la misma página; si empezás con OKLCH, seguís con OKLCH
3. **Sin clases utilitarias** → todo en CSS Module del componente
4. **Tokens primero** → usar `var(--space-*)`, `var(--radius-*)`, `var(--shadow-*)` antes que valores hardcodeados
5. **Estado hover/focus/disabled** → siempre definidos; sin estados interactivos huérfanos
