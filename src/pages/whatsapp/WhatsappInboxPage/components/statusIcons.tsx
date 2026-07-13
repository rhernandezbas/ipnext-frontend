interface IconProps {
  className?: string;
}

/**
 * statusIcons — íconos SVG inline del control Resolver/Reabrir
 * (messaging-inbox-productivity F1.5-C v1, design-system rule: nunca emoji).
 * Mismo estilo `stroke=currentColor` que `mediaIcons.tsx`. `aria-hidden`
 * porque el nombre accesible vive en el `aria-label` del botón que los
 * envuelve (`ConversationStatusToggle`), nunca en el SVG.
 */

/** IconCheck — "Resolver" (open/pending → resolved). */
export function IconCheck({ className }: IconProps = {}) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/** IconRotateCcw — "Reabrir" (resolved → open). Flecha antihoraria, NO un candado (reabrir no es "desbloquear"). */
export function IconRotateCcw({ className }: IconProps = {}) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  );
}
