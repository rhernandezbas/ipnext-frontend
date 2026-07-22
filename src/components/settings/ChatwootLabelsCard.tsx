import { useRef, useState } from 'react';
import { Can } from '@/components/auth/Can';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { useChatwootLabels, useCreateChatwootLabel } from '@/hooks/useBulkMessaging';
import { ChatwootCreateLabelModal } from './ChatwootCreateLabelModal';
import styles from './ChatwootLabelsCard.module.css';

/**
 * ChatwootLabelsCard (chatwoot-label-config-fe) — tarjeta "Etiquetas de
 * Chatwoot" en Configuración → WhatsApp. Pedido textual del usuario: "el
 * crear label tiene que estar en configuración" — la CREACIÓN del catálogo
 * (antes un CTA dentro del composer del bulk, `ChatwootLabelSelector`) se
 * mudó acá; el composer conserva SOLO la selección (lee el mismo catálogo).
 *
 * Molde `CannedResponsesSection` (fila de acciones fija arriba + 4 ramas de
 * estado abajo, toast-free acá porque no hay ABM de edición/borrado — solo
 * alta) + `TaskStageConfigCard` (gate de lectura consistente con el caller).
 *
 * Gates:
 * - Card VISIBLE con `messaging.templates` (MISMO permiso que gatea el
 *   catálogo del picker del composer, `CampaignComposer.canUseTemplates` —
 *   D5.c del design BE, tier lectura). El caller (`WhatsappSettingsPage`)
 *   envuelve la sección entera en `<Can permission="messaging.templates">`;
 *   acá se repite el gate sobre el fetch (defensa, mismo criterio que
 *   `TaskStageConfigCard`/`CampaignComposer`: el componente no confía en que
 *   el caller lo monte siempre detrás del `<Can>` correcto).
 * - CTA "Crear etiqueta…" gateado a `messaging.manage` (tier supervisor,
 *   D5.c del design BE) — OCULTO sin el permiso (patrón del repo: nunca un
 *   botón visible-pero-deshabilitado para un gate de permisos).
 *
 * A diferencia del `ChatwootLabelSelector` (composer, fix wave F2 ya
 * retirado), el CTA vive en una fila de acciones ESTABLE, ajena a las 4
 * ramas de la lista de abajo — nunca se desmonta al pasar de catálogo vacío
 * a catálogo con 1 etiqueta, así que no hay carrera de foco que reparar; el
 * `fallbackFocusRef` del modal se wirea de todos modos (mismo criterio
 * defensivo del repo: nunca asumir que el trigger sigue montado).
 */
export function ChatwootLabelsCard() {
  const { can } = useMyPermissions();
  const canViewCatalog = can('messaging.templates');

  const labelsQuery = useChatwootLabels(canViewCatalog);
  const {
    createAsync: createChatwootLabelAsync,
    isPending: isCreating,
    serverError,
    reset: resetCreate,
  } = useCreateChatwootLabel();

  const [modalOpen, setModalOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const labels = labelsQuery.data ?? [];

  async function handleCreate(input: { title: string; color: string }) {
    try {
      await createChatwootLabelAsync(input);
      setModalOpen(false);
    } catch {
      // el error se refleja reactivamente vía `serverError` — el modal queda abierto.
    }
  }

  function handleCancel() {
    setModalOpen(false);
    resetCreate();
  }

  return (
    <div className={styles.card} ref={cardRef} tabIndex={-1}>
      <div className={styles.actionsRow}>
        <Can permission="messaging.manage">
          <button type="button" className={styles.primaryBtn} onClick={() => setModalOpen(true)}>
            Crear etiqueta…
          </button>
        </Can>
      </div>

      {labelsQuery.isLoading && (
        <p className={styles.notice} role="status">
          Cargando etiquetas de Chatwoot…
        </p>
      )}

      {!labelsQuery.isLoading && labelsQuery.isError && (
        <div className={styles.errorState} role="alert">
          <p className={styles.errorText}>No se pudieron cargar las etiquetas de Chatwoot.</p>
          <button type="button" className={styles.retryBtn} onClick={() => void labelsQuery.refetch()}>
            Reintentar
          </button>
        </div>
      )}

      {!labelsQuery.isLoading && !labelsQuery.isError && labels.length === 0 && (
        <p className={styles.notice} role="status">
          No hay etiquetas de Chatwoot todavía.
        </p>
      )}

      {!labelsQuery.isLoading && !labelsQuery.isError && labels.length > 0 && (
        <ul className={styles.list}>
          {labels.map((label) => (
            <li key={label.title} className={styles.listItem}>
              <span className={styles.swatch} style={{ backgroundColor: label.color }} aria-hidden="true" />
              <span className={styles.listItemTitle}>{label.title}</span>
            </li>
          ))}
        </ul>
      )}

      <ChatwootCreateLabelModal
        open={modalOpen}
        busy={isCreating}
        serverError={serverError}
        fallbackFocusRef={cardRef}
        onSubmit={handleCreate}
        onCancel={handleCancel}
      />
    </div>
  );
}
