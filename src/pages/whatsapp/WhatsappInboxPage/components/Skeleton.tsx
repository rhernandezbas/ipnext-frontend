import styles from './Skeleton.module.css';

interface SkeletonProps {
  /** CSS width (px number or any valid CSS length string). @default '100%' */
  width?: string | number;
  /** CSS height (px number or any valid CSS length string). @default '14px' */
  height?: string | number;
  /** Renders a full-round shape (avatar placeholders). @default false */
  circle?: boolean;
  /** Extra class from the consumer (composition, e.g. margin overrides). */
  className?: string;
}

const toCssLength = (v: string | number): string => (typeof v === 'number' ? `${v}px` : v);

/**
 * Skeleton — shimmer compartido (messaging-inbox F1, design §7, task 2.6).
 * Primitivo presentacional puro: consumido por ConversationList/MessageThread/
 * ClientContextPanel (FB3) para sus estados `isLoading`. `role="presentation"`
 * porque es puramente decorativo — no debe anunciarse a lectores de pantalla
 * (el estado real de "cargando" lo comunica el contenedor que lo usa, p.ej.
 * un `aria-busy` o texto "Cargando…" en el componente consumidor).
 */
export function Skeleton({ width = '100%', height = '14px', circle = false, className }: SkeletonProps) {
  return (
    <span
      role="presentation"
      className={[styles.skeleton, circle ? styles.circle : '', className ?? ''].filter(Boolean).join(' ')}
      style={{ width: toCssLength(width), height: toCssLength(height) }}
    />
  );
}
