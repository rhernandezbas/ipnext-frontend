# Design — recapture-drawer-live

## The pattern

```ts
// After `if (!lead) return null;`
const view = detail ?? lead;
```

`detail` is `RecaptureLeadDetailDto | undefined`, returned by `useRecaptacionLead`. `lead` is `RecaptureLeadDto`, the frozen snapshot prop. Every display binding in the JSX reads from `view`; every mutation call keeps `lead.id`.

## Why it is type-safe

`RecaptureLeadDetailDto extends RecaptureLeadDto` and only adds `contacts: RecaptureContactDto[]`. So `detail` has every field `lead` has, plus `contacts`. The union `detail ?? lead` collapses to `RecaptureLeadDto` (the common base), which is exactly what the JSX needs. No field that exists only on the prop is missing from `detail`.

## Why the prop stays as the render gate

`if (!lead) return null;` is the gate for rendering at all — it fires before `view` is derived and must stay on the raw prop. The drawer should never render if there is no selected lead; that decision belongs to the prop (controlled by the page), not to the async detail fetch.

## Why we fall back to the prop during load

When the drawer first opens, `detail` is `undefined` until the first fetch resolves. Without the fallback, all display fields would be `undefined` on the first frame. `detail ?? lead` gives the immediately-available prop data for the first render, then switches to the fresh detail as soon as it arrives — the same pattern used by optimistic UIs.

## Decision: render from the re-fetched detail rather than lifting state up

Alternative considered: lift `selectedLead` up to the page and update it when the mutation settles (via `onSuccess` callback). Rejected because:
1. TanStack Query already owns the source of truth via query invalidation. Duplicating that in page state creates two sources of truth that can drift.
2. The invalidation on `recaptacionLeadKey(id)` already re-fetches `detail` fresh. There is nothing extra to plumb — just read from `detail` instead of the prop.
3. Lifting state would require threading `setSelectedLead` through mutation hooks or the drawer's `onChange` handlers, coupling the page to the drawer's internal mutations.

The `view = detail ?? lead` pattern costs one line and zero coupling.
