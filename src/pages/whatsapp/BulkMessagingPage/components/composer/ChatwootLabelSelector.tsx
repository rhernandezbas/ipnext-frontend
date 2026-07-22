import { forwardRef } from 'react';
import { Can } from '@/components/auth/Can';
import { Select, type SelectOption } from '@/components/molecules/Select/Select';
import type { ChatwootLabelDto } from '@/types/messagingBulk';
import styles from './ChatwootLabelSelector.module.css';

interface ChatwootLabelSelectorProps {
  labels: ChatwootLabelDto[];
  isLoading: boolean;
  isError: boolean;
  /** `title` de la etiqueta elegida, o `null` = "Sin etiqueta" (opt-in). */
  selected: string | null;
  onSelect: (title: string | null) => void;
  /** Reintentar el catálogo tras un error (rama `error`, molde `Reintentar` del repo). Sin handler, no se ofrece botón. */
  onRetry?: () => void;
  /** Abre el mini-modal "Crear label…" (FE.3) — gateado `messaging.manage` DENTRO de este componente. */
  onCreateClick: () => void;
}

const EMPTY_VALUE = '';

/**
 * ChatwootLabelSelector (campaign-chatwoot-label, design D6/tasks FE.2) —
 * molde EXACTO de `TemplateSelector`: presentacional puro, 4 ramas
 * (loading/error/empty/success, patrón F1). El fetch (`useChatwootLabels`,
 * gateado al MISMO permiso `messaging.templates` que ya gatea la card
 * "Mensaje" — D5.c del design BE) y el estado elegido viven en
 * `CampaignComposer`.
 *
 * Prefijo `chatwoot` OBLIGATORIO (design D6.5) — universo DISTINTO del
 * catálogo LOCAL `ConversationLabelsControl`/`ConversationLabelFilter`
 * (Ola 5, colores/etiquetas propias del inbox). Value = `title` (los tags de
 * conversación de Chatwoot son title-keyed, sin `id` — D1.a del design BE).
 *
 * El CTA "Crear label…" se ofrece en `empty` Y en `success` (no solo en el
 * catálogo vacío citado literal por el design D6.2) — un catálogo con 1
 * etiqueta sigue necesitando poder sumar otra sin vaciarlo antes. Gateado
 * `messaging.manage` (tier supervisor, D5.c del design BE) — el picker en sí
 * ya heredó `messaging.templates` de la card contenedora.
 *
 * Fix wave (review adversarial, post-apply):
 * - F2 (LOW-A11Y) — `forwardRef` expone el contenedor raíz (`tabIndex={-1}`,
 *   focuseable programáticamente pero fuera del tab-order natural) como nodo
 *   ESTABLE al que el mini-modal (`ChatwootCreateLabelModal.fallbackFocusRef`)
 *   puede restaurar el foco si el trigger que lo abrió (rama `emptyState`) ya
 *   se desmontó (el catálogo pasó a tener 1 label → cambia a `success`).
 * - F4 (LOW) — si el refetch del catálogo falla justo DESPUÉS de crear una
 *   etiqueta (`chatwootLabel` ya seteado en el composer, pero la query cae en
 *   `isError`), la rama `error` YA NO oculta esa selección: la muestra con un
 *   botón "Quitar" (`onSelect(null)`) para que UI y payload nunca diverjan
 *   invisiblemente (el operador vería un error de catálogo sin saber que su
 *   campaña igual va a viajar con un label que no puede ver/tocar).
 */
export const ChatwootLabelSelector = forwardRef<HTMLDivElement, ChatwootLabelSelectorProps>(function ChatwootLabelSelector(
  { labels, isLoading, isError, selected, onSelect, onRetry, onCreateClick },
  ref,
) {
  const options: SelectOption[] = [
    { value: EMPTY_VALUE, label: 'Sin etiqueta (opcional)' },
    ...labels.map((l) => ({ value: l.title, label: l.title, swatch: l.color })),
  ];

  function handleChange(title: string) {
    onSelect(title ? title : null);
  }

  return (
    <div className={styles.section} ref={ref} tabIndex={-1} data-testid="chatwoot-label-section">
      {isLoading && (
        <p className={styles.notice} role="status">
          Cargando etiquetas de Chatwoot…
        </p>
      )}

      {!isLoading && isError && (
        <div className={styles.errorState}>
          <p className={styles.error} role="alert">
            No se pudieron cargar las etiquetas de Chatwoot.
            {onRetry && (
              <button type="button" className={styles.retryBtn} onClick={onRetry}>
                Reintentar
              </button>
            )}
          </p>
          {selected && (
            <p className={styles.selectedNotice}>
              Etiqueta elegida: <strong>{selected}</strong>
              <button type="button" className={styles.removeBtn} onClick={() => onSelect(null)}>
                Quitar
              </button>
            </p>
          )}
        </div>
      )}

      {!isLoading && !isError && labels.length === 0 && (
        <div className={styles.emptyState}>
          <p className={styles.notice} role="status">
            No hay etiquetas de Chatwoot todavía.
          </p>
          <Can permission="messaging.manage">
            <button type="button" className={styles.createBtn} onClick={onCreateClick}>
              + Crear label…
            </button>
          </Can>
        </div>
      )}

      {!isLoading && !isError && labels.length > 0 && (
        <div className={styles.withOptions}>
          <Select
            label="Etiqueta de Chatwoot"
            options={options}
            value={selected ?? EMPTY_VALUE}
            onChange={handleChange}
            placeholder="Sin etiqueta (opcional)"
          />
          <Can permission="messaging.manage">
            <button type="button" className={styles.createBtn} onClick={onCreateClick}>
              + Crear label…
            </button>
          </Can>
        </div>
      )}
    </div>
  );
});
