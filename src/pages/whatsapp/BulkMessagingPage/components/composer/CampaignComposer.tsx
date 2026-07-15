import { useEffect, useRef, useState } from 'react';
import { Can } from '@/components/auth/Can';
import { Button } from '@/components/atoms/Button/Button';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { useTemplates, usePreviewSegment, useCreateCampaign } from '@/hooks/useBulkMessaging';
import type { CampaignSegment, CampaignVariableSpec, TemplateSummaryDto } from '@/types/messagingBulk';
import { TemplateSelector } from './TemplateSelector';
import { VariablesMapForm } from './VariablesMapForm';
import { SegmentBuilder } from './SegmentBuilder';
import { SegmentPreviewPanel } from './SegmentPreviewPanel';
import { PreviewModal } from './PreviewModal';
import { CreateCampaignConfirmModal } from './CreateCampaignConfirmModal';
import { ManualRecipientsPicker, type ManualRecipient } from '@/components/molecules/ManualRecipientsPicker/ManualRecipientsPicker';
import { hasRecipients } from './segmentCriteria';
import styles from './CampaignComposer.module.css';

interface CampaignComposerProps {
  /** Se llama con el `campaignId` recién creado — `BulkMessagingPage` decide adónde navegar (chunk 3 renderiza el detalle). */
  onCampaignCreated?: (campaignId: string) => void;
}

const PREVIEW_DEBOUNCE_MS = 500;
const TOAST_DURATION_MS = 4000;
const EMPTY_SEGMENT: CampaignSegment = { statuses: [] };
const NAME_INPUT_ID = 'bulk-campaign-name';

/**
 * CampaignComposer (F2 apply chunk 2; wiring del `PreviewModal` en
 * messaging-bulk-v11 FE apply chunk 2) — container-fino del tab "Nueva
 * campaña" de `BulkMessagingPage`. Orquesta los 3 hooks de datos
 * (`useTemplates`/`usePreviewSegment`/`useCreateCampaign`, `useBulkMessaging.ts`
 * chunk 1) + los presentacionales del composer (`TemplateSelector`/
 * `VariablesMapForm`/`SegmentBuilder`/`SegmentPreviewPanel`/`PreviewModal`) —
 * layout de 2 columnas (controles | preview live, decisión LOCKED del explore).
 *
 * El fetch de templates está gateado a `messaging.templates` (TPL-1) — un
 * permiso PROPIO, independiente del `messaging.bulk` que ya gatea la ruta
 * entera (`RequirePermission`, `App.tsx`). Sin él, ni se pide el catálogo
 * (`enabled`) ni se monta el selector (`<Can>`).
 *
 * `previewModalOpen` es un ESTADO PROPIO, separado del `usePreviewSegment`
 * (indicador liviano de `SegmentPreviewPanel`, sigue debounceado ~500ms) — el
 * `PreviewModal` tiene su PROPIA query (`useSegmentRecipients`, gateada a
 * `open`) para el detalle rico, así que abrir/cerrar el modal no necesita
 * (ni debe) volver a disparar `preview(segment)`.
 */
export function CampaignComposer({ onCampaignCreated = () => {} }: CampaignComposerProps) {
  const { can } = useMyPermissions();
  const canUseTemplates = can('messaging.templates');

  const templatesQuery = useTemplates(canUseTemplates);
  const {
    preview,
    data: previewData,
    isPending: isPreviewPending,
    isError: isPreviewError,
    reset: resetPreview,
  } = usePreviewSegment();
  const { createAsync, isPending: isCreating, missingVariablesError, missingRecipientsError, serverError: createServerError } = useCreateCampaign();

  const [selectedTemplate, setSelectedTemplate] = useState<TemplateSummaryDto | null>(null);
  const [variablesMap, setVariablesMap] = useState<CampaignVariableSpec>({});
  const [segment, setSegment] = useState<CampaignSegment>(EMPTY_SEGMENT);
  // manual-recipients-fe — lista manual (metadata FE-only para los chips). El
  // contrato con el BE es `manualClientIds: string[]`, derivado abajo.
  const [manualRecipients, setManualRecipients] = useState<ManualRecipient[]>([]);
  const [campaignName, setCampaignName] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  // messaging-bulk-v11 FE apply chunk 2 — el modal completo (mensaje real +
  // resumen + destinatarios paginados) se abre desde "Ver preview"
  // (`SegmentPreviewPanel`), independiente del indicador liviano de ahí.
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  // #5 — doble-confirmación al crear. El click de "Crear campaña" ya no
  // dispara `createAsync` directo: abre este modal con el resumen de impacto,
  // y recién el confirm de ADENTRO llama a `handleCreate`.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // manual-recipients-fe — ids de la lista manual (el shape que espera el BE).
  const manualClientIds = manualRecipients.map((r) => r.id);
  // El gate ahora combina el segmento con la lista manual (COMP-1): una lista
  // manual no vacía habilita el preview/create aunque el segmento esté vacío.
  const criteriaPresent = hasRecipients(segment, manualClientIds);

  /** Input del preview/segmento: se OMITE `manualClientIds` cuando está vacío (cero cambio en el payload del flujo por-segmento). */
  function buildSegmentInput() {
    return manualClientIds.length > 0 ? { ...segment, manualClientIds } : segment;
  }

  // SEG (composer) — preview automático con debounce ~500ms al cambiar el
  // segmento O la lista manual (decisión LOCKED: on-demand, NUNCA en cada tecla
  // de un input individual). Dependencias primitivas (no el objeto `segment`,
  // que cambia de identidad en cada render) para no re-disparar el timer sin
  // motivo real — incluye `manualClientIds.join(',')` (manual-recipients-fe), si
  // no, agregar/quitar un manual no re-dispararía el preview.
  useEffect(() => {
    // FIX-5 — invalidar el preview ante CUALQUIER cambio del segmento/lista (no
    // sólo cuando desaparece el criterio): un `previewData` viejo con el count de
    // un segmento anterior dejaba `canCreate` en true con un número que ya no
    // corresponde. Reseteando acá, "Crear campaña" se re-gatea con el estado
    // ACTUAL hasta que el nuevo preview resuelva.
    resetPreview();
    if (!criteriaPresent) return;
    const timer = setTimeout(() => {
      preview(buildSegmentInput());
    }, PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps primitivas a propósito, ver comentario de arriba
  }, [segment.statuses.join(','), segment.balanceMin, segment.balanceMax, manualClientIds.join(','), criteriaPresent]);

  function handleSelectTemplate(template: TemplateSummaryDto | null) {
    setSelectedTemplate(template);
    setVariablesMap({});
  }

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }

  const previewCount = previewData?.count ?? 0;

  /** Una variable está "completa" cuando tiene fuente Y (si es literal) un valor no-vacío. */
  function isVariableMapped(variable: string): boolean {
    const entry = variablesMap[variable];
    if (!entry) return false;
    return entry.source !== 'literal' || (entry.value ?? '').trim().length > 0;
  }

  const allVariablesMapped = !selectedTemplate || selectedTemplate.variables.every(isVariableMapped);

  // NOTA: `missingVariablesError.missing` se usa TAL CUAL (sin re-filtrar
  // contra el `variablesMap` actual) — el 422 es la respuesta AUTORITATIVA
  // del servidor sobre ESE intento de creación. En el flujo normal el gate
  // de `allVariablesMapped` ya impide llegar acá con algo sin mapear, así
  // que este error es señal de un desacuerdo real FE/BE (carrera, versión
  // de template distinta) — no debe autolimpiarse con un chequeo local que
  // asuma que el FE tiene razón.
  const missingVariables = missingVariablesError?.missing ?? [];

  const canCreate =
    !!selectedTemplate &&
    allVariablesMapped &&
    criteriaPresent &&
    !!previewData &&
    previewCount > 0 &&
    campaignName.trim().length > 0 &&
    !isCreating;

  async function handleCreate() {
    if (!selectedTemplate || !canCreate) return;
    const name = campaignName.trim();
    try {
      const output = await createAsync({
        name,
        templateRef: selectedTemplate.contentSid,
        templateName: selectedTemplate.friendlyName,
        segment,
        variablesMap,
        // manual-recipients-fe — PARALELO a `segment`, se OMITE cuando la lista
        // está vacía (cero cambio en el payload del flujo por-segmento).
        ...(manualClientIds.length > 0 ? { manualClientIds } : {}),
      });
      showToast(`Campaña "${name}" creada — ${output.total} destinatario${output.total === 1 ? '' : 's'}.`);
      onCampaignCreated(output.campaignId);
      // Deja el composer listo para la próxima campaña.
      setSelectedTemplate(null);
      setVariablesMap({});
      setSegment(EMPTY_SEGMENT);
      setManualRecipients([]);
      setCampaignName('');
      resetPreview();
    } catch {
      // El error se refleja reactivamente vía el hook: el 422
      // MISSING_TEMPLATE_VARIABLES resalta filas en `VariablesMapForm`
      // (`missingVariablesError`); los demás (EMPTY_SEGMENT/UNFILTERED_SEGMENT/
      // TEMPLATE_NOT_APPROVED/red/500) se muestran en `.serverError`
      // (`createServerError`, FIX-3b). El botón queda habilitado para reintentar.
    }
  }

  // #5 — confirm del modal. El modal es un CHECKPOINT de revisión, NO vive
  // durante la creación: cerramos ANTES de disparar el create y recién ahí
  // llamamos `handleCreate` (fire-and-forget — atrapa sus propios errores). Así
  // evitamos el trap del "server colgado": si `createCampaign` nunca responde
  // (el axios client no tiene timeout global), `isCreating` quedaría true para
  // siempre; si el modal viviera durante la creación gateado por `busy`,
  // quedaría INCERRABLE + scroll-lock. El feedback de "creando" lo da el botón
  // "Crear campaña" del composer (`loading={isCreating}`), no el modal. El
  // gate `canCreate` (incluye `!isCreating`) impide reabrirlo mientras crea, así
  // que no hay doble-submit. `handleCreate` lee el estado vivo del composer al
  // ejecutarse — intacto, porque el reset ocurre DENTRO tras el create OK.
  function handleConfirmCreate() {
    setConfirmOpen(false);
    void handleCreate();
  }

  const disabledReason = !selectedTemplate
    ? 'Elegí un template para empezar.'
    : !allVariablesMapped
      ? 'Mapeá todas las variables del template.'
      : !criteriaPresent
        ? 'Definí un criterio de segmento o agregá destinatarios manuales.'
        : !previewData
          ? 'Generá el preview del segmento antes de crear la campaña.'
          : previewCount === 0
            ? 'El segmento no tiene destinatarios — revisalo.'
            : campaignName.trim().length === 0
              ? 'Ingresá un nombre para la campaña.'
              : null;

  return (
    <div className={styles.layout}>
      <div className={styles.controls}>
        {canUseTemplates && (
          <Can permission="messaging.templates">
            <TemplateSelector
              templates={templatesQuery.data ?? []}
              isLoading={templatesQuery.isLoading}
              isError={templatesQuery.isError}
              selected={selectedTemplate}
              onSelect={handleSelectTemplate}
            />
          </Can>
        )}

        {selectedTemplate && (
          <VariablesMapForm
            variables={selectedTemplate.variables}
            value={variablesMap}
            onChange={setVariablesMap}
            missingVariables={missingVariables}
            templateBody={selectedTemplate.body}
          />
        )}

        <SegmentBuilder value={segment} onChange={setSegment} />

        <ManualRecipientsPicker
          value={manualRecipients}
          onChange={setManualRecipients}
          invalidIds={missingRecipientsError?.missingClientIds}
        />

        <div className={styles.nameField}>
          <label htmlFor={NAME_INPUT_ID}>Nombre de la campaña</label>
          <input
            id={NAME_INPUT_ID}
            type="text"
            className={styles.nameInput}
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            placeholder="Ej: Recordatorio julio"
          />
        </div>

        {missingVariables.length > 0 && (
          <p className={styles.serverError} role="alert">
            El servidor rechazó la campaña: faltan mapear {missingVariables.join(', ')}.
          </p>
        )}

        {/* manual-recipients-fe (ERR-1) — 422 MANUAL_RECIPIENTS_NOT_FOUND: los
            chips inválidos ya se marcan en el picker (via `invalidIds`); acá va el
            mensaje agregado. `aria-live` para anunciarlo sin robar el foco. */}
        {missingRecipientsError && (
          <p className={styles.serverError} role="alert" aria-live="polite">
            {missingRecipientsError.missingClientIds.length} destinatario
            {missingRecipientsError.missingClientIds.length === 1 ? '' : 's'} manual
            {missingRecipientsError.missingClientIds.length === 1 ? '' : 'es'} ya no{' '}
            {missingRecipientsError.missingClientIds.length === 1 ? 'existe' : 'existen'} — quitalos y volvé a intentar.
          </p>
        )}

        {/* FIX-3b — errores de creación que NO son el 422 MISSING (EMPTY_SEGMENT,
            UNFILTERED_SEGMENT, TEMPLATE_NOT_APPROVED, red/500) ya no caen silenciosos. */}
        {createServerError && missingVariables.length === 0 && (
          <p className={styles.serverError} role="alert">
            {createServerError}
          </p>
        )}

        <div className={styles.createRow}>
          {/* #5 — el gate `canCreate` sigue siendo la precondición para ABRIR
              el modal; el confirm de adentro dispara la creación real. */}
          <Button type="button" variant="primary" loading={isCreating} disabled={!canCreate} onClick={() => setConfirmOpen(true)}>
            Crear campaña
          </Button>
          {disabledReason && (
            <p className={styles.hint} role="status">
              {disabledReason}
            </p>
          )}
        </div>
      </div>

      <div className={styles.preview}>
        <SegmentPreviewPanel
          hasCriteria={criteriaPresent}
          isPending={isPreviewPending}
          isError={isPreviewError}
          data={previewData}
          onOpenPreview={() => setPreviewModalOpen(true)}
        />
      </div>

      <PreviewModal
        open={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        segment={segment}
        templateBody={selectedTemplate?.body}
        variablesMap={variablesMap}
        // FIX 2 — el modal SOLO consulta el segmento; le pasamos el conteo de
        // manuales para que muestre el aviso y no contradiga/oculte el envío.
        manualCount={manualClientIds.length}
      />

      {/* #5 — doble-confirmación con resumen de impacto. Todo el contenido sale
          de `previewData`/`selectedTemplate` (ya en memoria por el gate
          `canCreate` que habilitó abrirlo) — cero fetch nuevo. */}
      <CreateCampaignConfirmModal
        open={confirmOpen}
        campaignName={campaignName.trim()}
        templateName={selectedTemplate?.friendlyName ?? ''}
        total={previewCount}
        manualCount={manualClientIds.length}
        statusCounts={previewData?.statusCounts ?? {}}
        skipped={previewData?.skipped}
        onConfirm={handleConfirmCreate}
        onCancel={() => setConfirmOpen(false)}
      />

      {toast && (
        <div className={styles.toast} role="alert" aria-live="assertive">
          {toast}
        </div>
      )}
    </div>
  );
}
