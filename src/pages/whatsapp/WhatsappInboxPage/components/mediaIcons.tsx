/**
 * mediaIcons — íconos SVG inline (nunca emoji, design-system rule) para las
 * hojas de media del inbox (messaging-inbox-v2-media F1.5 fase A, tasks
 * F2.3/F3.x). Mismo estilo `stroke=currentColor` que `TaskPhotosGallery`.
 */

interface IconProps {
  className?: string;
}

export function IconFilePdf({ className }: IconProps = {}) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="15" x2="16" y2="15" />
      <line x1="8" y1="18" x2="12" y2="18" />
    </svg>
  );
}

export function IconFileArchive({ className }: IconProps = {}) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="10" y1="11" x2="10" y2="13" />
      <line x1="10" y1="14.5" x2="10" y2="16.5" />
      <line x1="10" y1="18" x2="10" y2="20" />
    </svg>
  );
}

export function IconFileDoc({ className }: IconProps = {}) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  );
}

export function IconFileSheet({ className }: IconProps = {}) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <line x1="8" y1="16" x2="16" y2="16" />
      <line x1="11" y1="12" x2="11" y2="20" />
    </svg>
  );
}

export function IconFileGeneric({ className }: IconProps = {}) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

export function IconDownload({ className }: IconProps = {}) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

export function IconImageOff({ className }: IconProps = {}) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15V6a2 2 0 0 0-2-2H9" />
      <path d="M3 3l18 18" />
      <path d="M3 9v10a2 2 0 0 0 2 2h14" />
      <circle cx="9" cy="9" r="1.5" />
      <path d="M5 17l4-4 3 3 3-4 3 3" />
    </svg>
  );
}

export function IconAlert({ className }: IconProps = {}) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

/**
 * IconPaperclip (messaging-inbox-v2-media F1.5 fase A, Tanda 2 — ENVIAR,
 * design §5.1) — ícono del botón "adjuntar" del composer. `aria-hidden`
 * porque el label accesible vive en el botón que lo envuelve
 * (`aria-label="Adjuntar archivos"`), nunca en el SVG.
 */
export function IconPaperclip({ className }: IconProps = {}) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21.44 11.05l-9.19 9.19a5.5 5.5 0 0 1-7.78-7.78l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95l-9.2 9.19a1.5 1.5 0 0 1-2.12-2.12l8.49-8.48" />
    </svg>
  );
}

/**
 * IconNote (messaging-inbox-notes F1.5 fase D — NOTA PRIVADA, design §4.3) —
 * ícono del label "Nota interna" en `MessageBubble`. `aria-hidden` porque el
 * nombre accesible vive en el texto visible que lo acompaña ("Nota
 * interna"), nunca en el SVG (mismo criterio que `IconPaperclip`). Lápiz
 * sobre un recuadro — no candado (una nota no es "secreta", es "interna" del
 * lado del agente).
 */
export function IconNote({ className }: IconProps = {}) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

/**
 * IconTrash (internal-notes F1.5 — ELIMINAR NOTA) — ícono de la acción
 * "Eliminar" y del tombstone de una nota borrada. `aria-hidden` porque el
 * nombre accesible vive en el `aria-label` del botón (o en el texto "Nota
 * eliminada" del tombstone) que lo acompaña. Mismo estilo `stroke=currentColor`
 * que el resto del archivo.
 */
export function IconTrash({ className }: IconProps = {}) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

export type FileIconKind = 'pdf' | 'archive' | 'doc' | 'sheet' | 'generic';

/**
 * Selección PURA de ícono por `contentType` (MIME real reportado por
 * Chatwoot) — mapa chico y honesto (design §3.4: "no inventar 20 tipos").
 * Función pura sin JSX: fácil de triangular sin mocks ni render
 * (`mediaIcons.test.tsx`).
 */
export function pickFileIconKind(contentType: string): FileIconKind {
  const ct = contentType.toLowerCase();
  if (ct === 'application/pdf') return 'pdf';
  if (ct.includes('zip') || ct.includes('rar')) return 'archive';
  if (ct.includes('msword') || ct.includes('wordprocessing')) return 'doc';
  if (ct.includes('spreadsheet') || ct.includes('excel')) return 'sheet';
  return 'generic';
}

const ICONS_BY_KIND: Record<FileIconKind, (props?: IconProps) => JSX.Element> = {
  pdf: IconFilePdf,
  archive: IconFileArchive,
  doc: IconFileDoc,
  sheet: IconFileSheet,
  generic: IconFileGeneric,
};

/** Componente de conveniencia: ícono de archivo directo por `contentType`. */
export function FileTypeIcon({ contentType, className }: { contentType: string } & IconProps) {
  const Icon = ICONS_BY_KIND[pickFileIconKind(contentType)];
  return <Icon className={className} />;
}
