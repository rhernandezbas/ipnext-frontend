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
 * chatwoot-label-config-fe — el CTA "Crear label…" (y el mini-modal que abría)
 * SALIÓ de acá: la creación del catálogo ahora vive en Configuración →
 * WhatsApp (`ChatwootLabelsCard`), pedido explícito del usuario ("el crear
 * label tiene que estar en configuración"). Este selector vuelve a ser
 * PURAMENTE de selección — el `forwardRef`/`fallbackFocusRef` que exponía el
 * contenedor raíz (fix wave F2 de la wave anterior) se retiró: era plumbing
 * dedicado ÚNICAMENTE a restaurar el foco del mini-modal que ya no se abre
 * desde acá.
 *
 * Fix wave (review adversarial, post-apply) que SIGUE vigente:
 * - F4 (LOW) — si el refetch del catálogo falla justo DESPUÉS de que el
 *   operador ya tenía un `chatwootLabel` elegido, la rama `error` NO oculta
 *   esa selección: la muestra con un botón "Quitar" (`onSelect(null)`) para
 *   que UI y payload nunca diverjan invisiblemente.
 */
export function ChatwootLabelSelector({
  labels,
  isLoading,
  isError,
  selected,
  onSelect,
  onRetry,
}: ChatwootLabelSelectorProps) {
  const options: SelectOption[] = [
    { value: EMPTY_VALUE, label: 'Sin etiqueta (opcional)' },
    ...labels.map((l) => ({ value: l.title, label: l.title, swatch: l.color })),
  ];

  function handleChange(title: string) {
    onSelect(title ? title : null);
  }

  return (
    <div className={styles.section}>
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
            No hay etiquetas de Chatwoot todavía — se crean en Configuración → WhatsApp.
          </p>
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
        </div>
      )}
    </div>
  );
}
