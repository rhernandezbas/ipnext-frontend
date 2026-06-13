# recaptacion-v2 — FE Proposal

## Intent

Extend the existing Recaptación module (RecaptacionPage + useRecaptacion hook + recaptacion.api) with three features:

1. **Ingest button** — triggers `POST /api/recapture/ingest-churned` via new `useIngestChurned()` mutation; shows result toast `{N} leads creados, {M} ya existían`.
2. **CSV import modal** — `ImportCsvModal` (portal, Esc/backdrop close, focus trap) with a template download button and a file picker that reads via `File.text()` and calls `POST /api/recapture/import-csv { csv }`.
3. **Sidebar order fix** — move "Recaptación" above "Configuración" in the Clientes children list.

## Scope

| File | Change |
|------|--------|
| `src/api/recaptacion.api.ts` | Add `importCsvLeads(csv)` and `downloadCsvTemplate()` |
| `src/hooks/useRecaptacion.ts` | Add `useIngestChurned()`, `useImportCsvLeads()`, `downloadRecaptureCsvTemplate()` |
| `src/pages/customers/RecaptacionPage.tsx` | Wire ingest + CSV import buttons in headerRight |
| `src/pages/customers/RecaptacionPage/components/ImportCsvModal.tsx` | New modal component |
| `src/pages/customers/RecaptacionPage/components/ImportCsvModal.module.css` | Modal styles |
| `src/pages/customers/RecaptacionPage.module.css` | Add `.btnSecondary` class |
| `src/components/organisms/Sidebar/Sidebar.tsx` | Move Recaptación before Configuración |

## Wire Contract (from BE)

- `POST /api/recapture/import-csv` body `{ csv: string }` → `{ created: number; errors: string[] }`
- `GET /api/recapture/import-csv/template` → `text/csv` blob
- `POST /api/recapture/ingest-churned` → `{ created: number; skipped: number }`

## Tests (Vitest, TDD — all GREEN)

- `useIngestChurned` — calls api + invalidates `['recaptacion']`
- `useImportCsvLeads` — posts `{ csv }` + invalidates on success
- `ImportCsvModal` — renders when open, file input, "Descargar CSV de ejemplo", Esc + backdrop close
- `SidebarRecaptacion` — asserts Recaptación appears before Configuración
