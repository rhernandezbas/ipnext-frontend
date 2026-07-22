import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Can } from '@/components/auth/Can';
import { Button } from '@/components/atoms/Button/Button';
import { Tabs } from '@/components/molecules/Tabs/Tabs';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import {
  useTemplates,
  usePreviewSegment,
  useCreateCampaign,
  bulkRecipientsErrorMessage,
  useChatwootLabels,
} from '@/hooks/useBulkMessaging';
import { useNetworkSites } from '@/hooks/useNetworkSites';
import { useAssignableAccessPoints } from '@/hooks/useAccessPoints';
import { useTaskStageConfig } from '@/hooks/useTaskStageConfig';
import type { CampaignSegment, CampaignVariableSpec, TemplateSummaryDto } from '@/types/messagingBulk';
import { TemplateSelector } from './TemplateSelector';
import { ChatwootLabelSelector } from './ChatwootLabelSelector';
import { VariablesMapForm } from './VariablesMapForm';
import { SegmentBuilder } from './SegmentBuilder';
import { NetworkFilterPanel } from './NetworkFilterPanel';
import { TaskStagesTabPanel } from './TaskStagesTabPanel';
import { SegmentPreviewPanel } from './SegmentPreviewPanel';
import { PreviewModal } from './PreviewModal';
import { CreateCampaignConfirmModal } from './CreateCampaignConfirmModal';
import { ManualRecipientsPicker, type ManualRecipient } from '@/components/molecules/ManualRecipientsPicker/ManualRecipientsPicker';
import { CsvRecipientsUploader } from './CsvRecipientsUploader';
import type { CsvContact } from './parseRecipientsCsv';
import { parseRecipientNumbers } from './parseRecipientNumbers';
import { hasRecipients, hasEffectiveBalanceFilter, networkFilterCount } from './segmentCriteria';
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
 * Rediseño bulk-elegant — los orígenes de destinatarios viven en UNA card
 * con tabs (`Tabs` del repo, `mountMode="all"` default: los paneles quedan
 * SIEMPRE montados y solo se ocultan con CSS — el estado de cada origen
 * sobrevive al cambio de tab, lección `inbox-key-por-conversacion`; además el
 * uploader de CSV guarda estado LOCAL del archivo, desmontarlo lo perdería).
 *
 * Change network-filter-tab — el filtro de red Nodo/AP salió del panel
 * Segmento a su PROPIO tab (segundo, pedido del usuario): Segmento | Nodo/AP
 * | Manuales | CSV. `network` es un tab de UI, NO un origen nuevo:
 * `networkSiteId`/`accessPointId` siguen DENTRO de `segment` (AND con
 * estados/deuda, payload idéntico).
 */
// bulk-task-recipients (D8) — 6to tab "Tarea" AGREGADO AL FINAL (molde D10 del
// design BE: append, nunca insertar en medio): clientes con ≥1 tarea abierta
// en un `Stage` mapeado (Ajustes → WhatsApp, `TaskStageConfigCard`).
// `taskStageIds` es un 4to origen PARALELO a segmento/manual/csv-números —
// mismo criterio "se OMITE del payload cuando está vacío".
type RecipientsTabId = 'segment' | 'network' | 'manual' | 'csv' | 'numbers' | 'task';

/**
 * CampaignComposer (F2 apply chunk 2; wiring del `PreviewModal` en
 * messaging-bulk-v11 FE apply chunk 2) — container-fino del tab "Nueva
 * campaña" de `BulkMessagingPage`. Orquesta los 3 hooks de datos
 * (`useTemplates`/`usePreviewSegment`/`useCreateCampaign`, `useBulkMessaging.ts`
 * chunk 1) + los presentacionales del composer (`TemplateSelector`/
 * `VariablesMapForm`/`SegmentBuilder`/`SegmentPreviewPanel`/`PreviewModal`) —
 * layout de 2 columnas (controles | preview live, decisión LOCKED del explore).
 *
 * Rediseño bulk-elegant — la columna de controles pasó de 5 cards apiladas a:
 * card "Mensaje" (template + variables), card "Destinatarios" (tabs Segmento/
 * Nodo\/AP/Manuales/CSV con contador-chip por tab, `Tabs` del repo con
 * `mountMode="all"` — los paneles siempre montados, cambiar de tab no
 * pierde estado) y una barra de acción (nombre + CTA). FORMA únicamente:
 * hooks, gates, payloads, debounce y doble-confirm quedaron IDÉNTICOS
 * (network-filter-tab agregó el tab Nodo/AP: mismos ids dentro de `segment`).
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
  // bulk-granular-perms — gate del tab "Números": sin `messaging.bulk_numbers`
  // el textarea queda deshabilitado (candado + aviso). El BE es el backstop
  // (403 BULK_RECIPIENTS_NOT_PERMITTED) si igual llegara un número.
  const canUseNumbers = can('messaging.bulk_numbers');

  const templatesQuery = useTemplates(canUseTemplates);
  // campaign-chatwoot-label (D6/FE.1) — MISMO gate que el catálogo de
  // templates: la card "Mensaje" entera está detrás de `messaging.templates`
  // (D5.c del design BE, tier lectura para el picker). La CREACIÓN del
  // catálogo (chatwoot-label-config-fe) se mudó a Configuración → WhatsApp
  // (`ChatwootLabelsCard`) — acá solo queda la SELECCIÓN.
  const chatwootLabelsQuery = useChatwootLabels(canUseTemplates);
  const {
    preview,
    data: previewData,
    isPending: isPreviewPending,
    isError: isPreviewError,
    reset: resetPreview,
  } = usePreviewSegment();
  const {
    createAsync,
    isPending: isCreating,
    missingVariablesError,
    missingRecipientsError,
    bulkRecipientsError,
    taskStageNotEligibleError,
    serverError: createServerError,
  } = useCreateCampaign();
  // bulk-task-recipients (D8) — mapeo actual (gate: el MISMO que los otros
  // tabs de destinatarios, sin gate propio — la ruta ya exige `messaging.bulk`;
  // el fetch en sí lo autoriza el BE con `messaging.read`). Compartido por la
  // card de Ajustes y este tab (misma query key, `useTaskStageConfig.ts`).
  const taskStageConfigQuery = useTaskStageConfig();
  const mappedTaskStages = taskStageConfigQuery.data?.stages ?? [];

  const [selectedTemplate, setSelectedTemplate] = useState<TemplateSummaryDto | null>(null);
  const [variablesMap, setVariablesMap] = useState<CampaignVariableSpec>({});
  // campaign-chatwoot-label (D6/FE.2) — `title` de la etiqueta de Chatwoot
  // elegida (o `null` = "Sin etiqueta", opt-in — comportamiento actual exacto
  // cuando no se elige nada, Decisión E del design BE).
  const [chatwootLabel, setChatwootLabel] = useState<string | null>(null);
  const [segment, setSegment] = useState<CampaignSegment>(EMPTY_SEGMENT);
  // manual-recipients-fe — lista manual (metadata FE-only para los chips). El
  // contrato con el BE es `manualClientIds: string[]`, derivado abajo.
  const [manualRecipients, setManualRecipients] = useState<ManualRecipient[]>([]);
  // bulk-csv-recipients (CSV-FE-5) — dueño único de los contactos VÁLIDOS del
  // CSV cargado (molde `manualRecipients`). `csvFileName` alimenta el
  // fingerprint ESTABLE del debounce (NO un `join` de hasta 5000 items).
  const [csvContacts, setCsvContacts] = useState<CsvContact[]>([]);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  // bulk-granular-perms — tab "Números": texto crudo pegado por el operador
  // (molde `csvFileName`, el estado dueño es el texto; los contactos se DERIVAN
  // con `parseRecipientNumbers`). Uno por línea, opcionalmente `número, nombre`.
  const [numbersText, setNumbersText] = useState('');
  // bulk-task-recipients (D8) — subset de stageIds tildado en el tab "Tarea"
  // (molde `manualClientIds`: array de ids, SIN metadata FE — el chip del tab
  // ya identifica el stage por su MappedStageDto hidratado).
  const [taskStageIds, setTaskStageIds] = useState<string[]>([]);
  // Bump tras crear la campaña (CSV-FE-5.5) para remontar el uploader (molde
  // `resetKey` de `ManualRecipientsPicker`/`CustomerPicker`) — limpia también
  // el resumen/detalle interno del archivo, no sólo el estado del composer.
  const [csvResetKey, setCsvResetKey] = useState(0);
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
  // Rediseño bulk-elegant — tab activo de la card "Destinatarios". Estado de
  // UI puro: cambiarlo NO toca segment/manualRecipients/csvContacts (los 3
  // orígenes siguen combinándose igual en preview/create).
  const [recipientsTab, setRecipientsTab] = useState<RecipientsTabId>('segment');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // manual-recipients-fe — ids de la lista manual (el shape que espera el BE).
  const manualClientIds = manualRecipients.map((r) => r.id);
  // bulk-granular-perms — contactos crudos del tab "Números", DERIVADOS del
  // texto pegado (memoizado: sólo se re-parsea cuando cambia el texto).
  const numbersContacts = useMemo(() => parseRecipientNumbers(numbersText), [numbersText]);
  // CSV y Números comparten el MISMO canal del BE (`manualContacts`, dedup por
  // teléfono) — se concatenan en un solo array (CSV primero, Números después).
  // F4 (review adversarial) — los números se EXCLUYEN si el usuario no tiene
  // `messaging.bulk_numbers` (ej. permiso revocado tras tipear): sin este scrub
  // viajarían igual al preview/create aunque el textarea esté deshabilitado. El
  // BE es el backstop (403), pero el FE no debe mandar lo que no puede.
  // Identidad estable entre renders (solo cambia si cambian sus fuentes).
  const combinedManualContacts = useMemo(
    () => (canUseNumbers ? [...csvContacts, ...numbersContacts] : [...csvContacts]),
    [canUseNumbers, csvContacts, numbersContacts],
  );
  // El gate combina el segmento con la lista manual (COMP-1), el CSV
  // (bulk-csv-recipients CSV-FE-5), los números (bulk-granular-perms) Y el
  // subset de estados de tarea (bulk-task-recipients): cualquiera de las 4
  // fuentes no vacía habilita el preview/create aunque el segmento esté vacío.
  const criteriaPresent = hasRecipients(
    segment,
    manualClientIds,
    combinedManualContacts.length > 0,
    taskStageIds.length > 0,
  );
  // Fingerprint del archivo para el dep-array del debounce (CSV-FE-5, fix M3
  // review adversarial) — sobre el CONTENIDO real de `csvContacts`
  // (`JSON.stringify`, mismo patrón robusto que
  // `PreviewModal.inputFingerprint`), no `${fileName}:${length}`. Ese combo
  // era LOSSY: re-subir un archivo con el MISMO nombre y la MISMA cantidad
  // de filas válidas pero contenido DISTINTO (ej. se corrigió un teléfono,
  // mismo N) no cambiaba el fingerprint → el preview debounceado no se
  // re-disparaba y `previewData.count`/`canCreate` quedaban STALE contra los
  // `csvContacts` FRESCOS que sí viajan en `handleCreate`.
  // Memoizado: el JSON.stringify de hasta 5000 contactos corría en CADA render
  // (cada keystroke del nombre de campaña) — inofensivo pero desperdiciado. Con
  // useMemo se recomputa SOLO cuando cambia `csvContacts` (identidad estable
  // entre cargas: solo `setCsvContacts` la reemplaza). Mismo string, cacheado.
  const csvFingerprint = useMemo(
    () => `${csvFileName ?? ''}:${JSON.stringify(csvContacts)}`,
    [csvFileName, csvContacts],
  );

  // node-segment-fe — nombres de nodo/AP para el resumen del confirm modal
  // (el operador revisa NOMBRES, no uuids). MISMAS queries (misma key de
  // cache TanStack) que ya dispara `SegmentBuilder` adentro — acá es un
  // lookup sobre la cache compartida, cero fetch extra. Fallback al id crudo
  // si el catálogo todavía no resolvió (nunca ocultar que hay un filtro).
  // M2 (fix wave) — /access-points exige network.read: sin el permiso la query
  // ni se dispara (NetworkFilterPanel tampoco renderiza la fila del AP, así
  // que segment.accessPointId nunca se setea por esta vía).
  const { data: networkSitesCatalog } = useNetworkSites({ staleTime: 60_000 });
  const { data: accessPointsCatalog } = useAssignableAccessPoints(segment.networkSiteId ?? null, can('network.read'));
  const networkSiteName = segment.networkSiteId
    ? networkSitesCatalog?.find((s) => s.id === segment.networkSiteId)?.name ?? segment.networkSiteId
    : undefined;
  const accessPointName = segment.accessPointId
    ? accessPointsCatalog?.find((a) => a.id === segment.accessPointId)?.name ?? segment.accessPointId
    : undefined;

  /** Input del preview/segmento: se OMITEN `manualClientIds`/`manualContacts`/`taskStageIds` cuando están vacíos (cero cambio en el payload del flujo por-segmento). */
  function buildRecipientsInput() {
    return {
      ...segment,
      ...(manualClientIds.length > 0 ? { manualClientIds } : {}),
      // CSV + Números concatenados (bulk-granular-perms) — un solo array.
      ...(combinedManualContacts.length > 0 ? { manualContacts: combinedManualContacts } : {}),
      // bulk-task-recipients (D8) — 4to origen, mismo criterio de omisión.
      ...(taskStageIds.length > 0 ? { taskStageIds } : {}),
    };
  }

  function handleCsvChange(contacts: CsvContact[], fileName: string | null) {
    setCsvContacts(contacts);
    setCsvFileName(fileName);
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
      preview(buildRecipientsInput());
    }, PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps primitivas a propósito, ver comentario de arriba
  }, [
    segment.statuses.join(','),
    segment.balanceMin,
    segment.balanceMax,
    // node-segment-fe — el filtro de red también re-dispara el preview (deps
    // primitivas, mismo criterio que statuses/balance).
    segment.networkSiteId,
    segment.accessPointId,
    manualClientIds.join(','),
    csvFingerprint,
    // bulk-granular-perms — editar los números re-dispara el preview (primitiva:
    // cambia exactamente cuando cambia el texto pegado).
    numbersText,
    // F4 — si se gana/pierde el permiso de números, el scrub cambia lo que
    // viaja: re-preview para que el count no quede stale.
    canUseNumbers,
    // bulk-task-recipients (D8) — tildar/destildar un estado de tarea
    // re-dispara el preview (primitiva: join de ids, mismo criterio que manual).
    taskStageIds.join(','),
    criteriaPresent,
  ]);

  // bulk-task-recipients (D3, TASK-2) — 422 TASK_STAGE_NOT_ELIGIBLE: el mapeo
  // cambió mientras el operador armaba la campaña (otro admin lo editó en
  // Ajustes → WhatsApp). Refetchea la config para que el tab "Tarea" refleje
  // el mapeo REAL antes de que el operador reintente (en vez de dejarlo
  // reintentando a ciegas contra el mismo subset ya inválido).
  //
  // fix wave F1 (HIGH, review adversarial) — LOOP INFINITO: `taskStageNotEligibleError`
  // lo arma `toTaskStageNotEligibleError()` DENTRO de `useCreateCampaign()`, un
  // objeto NUEVO en cada render (aunque `mutation.error` no haya cambiado). Ese
  // objeto es dependencia del efecto → el CUERPO corre en cada render mientras
  // el error siga presente → `refetch()` togglea `isFetching` (re-render real)
  // → el efecto vuelve a correr → refetch de nuevo → loop contra
  // `/config/task-stages` (reproducido con "Maximum update depth exceeded" en
  // el test rojo). El guard-ref recuerda "ya refetcheé para ESTA ocurrencia"
  // (se resetea a `false` en cuanto el error desaparece — nueva mutación o
  // reset): refetch se dispara UNA sola vez por 422, sin importar cuántos
  // re-renders pasen después.
  const taskStageRefetchedRef = useRef(false);
  useEffect(() => {
    if (!taskStageNotEligibleError) {
      taskStageRefetchedRef.current = false;
      return;
    }
    if (taskStageRefetchedRef.current) return;
    taskStageRefetchedRef.current = true;
    void taskStageConfigQuery.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- guard-ref evita el loop; refetch estable de TanStack
  }, [taskStageNotEligibleError]);

  // fix wave F2 (MED, review adversarial) — taskStageIds HUÉRFANOS: si el
  // mapeo se achica (otro admin desmapea un stage tildado en Ajustes →
  // WhatsApp), el checkbox de ESE stage desaparece de `TaskStagesTabPanel`
  // (ya no está en `mappedStages`) pero el id se quedaba en el ESTADO
  // (`taskStageIds`) — 422 TASK_STAGE_NOT_ELIGIBLE perpetuo, SIN forma de
  // destildarlo por UI (el checkbox que lo controlaba ya no existe).
  // Reconciliación: cuando `mappedTaskStages` cambia (carga inicial o un
  // refetch con un catálogo distinto), poda `taskStageIds` a la
  // INTERSECCIÓN con los ids REALMENTE mapeados. El `setTaskStageIds`
  // devuelve la MISMA referencia `prev` cuando nada cambió — React bailea
  // el re-render, así que esto no compite con el guard-ref de F1 ni crea
  // un loop propio.
  useEffect(() => {
    if (!taskStageConfigQuery.data) return; // todavía no cargó — no podar contra un catálogo vacío por ausencia de dato
    const mappedIds = new Set(mappedTaskStages.map((s) => s.stageId));
    setTaskStageIds((prev) => {
      const pruned = prev.filter((id) => mappedIds.has(id));
      return pruned.length === prev.length ? prev : pruned;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reacciona solo a mappedTaskStages (derivado de taskStageConfigQuery.data)
  }, [mappedTaskStages]);

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
        // bulk-csv-recipients (CSV-FE-5) + bulk-granular-perms — CSV y Números
        // comparten `manualContacts` (dedup por teléfono en el BE). Se OMITE
        // cuando no hay ni CSV ni números.
        ...(combinedManualContacts.length > 0 ? { manualContacts: combinedManualContacts } : {}),
        // bulk-task-recipients (D8) — 4to origen, mismo criterio de omisión.
        ...(taskStageIds.length > 0 ? { taskStageIds } : {}),
        // campaign-chatwoot-label (D6/FE.4) — se OMITE cuando no se eligió
        // ninguna etiqueta (cero cambio en el payload de los flujos que no la
        // usan), mismo criterio que `manualClientIds`/`manualContacts`.
        ...(chatwootLabel ? { chatwootLabel } : {}),
      });
      showToast(`Campaña "${name}" creada — ${output.total} destinatario${output.total === 1 ? '' : 's'}.`);
      onCampaignCreated(output.campaignId);
      // Deja el composer listo para la próxima campaña.
      setSelectedTemplate(null);
      setVariablesMap({});
      setSegment(EMPTY_SEGMENT);
      setManualRecipients([]);
      setCsvContacts([]);
      setCsvFileName(null);
      setCsvResetKey((k) => k + 1);
      setNumbersText('');
      setTaskStageIds([]);
      setCampaignName('');
      setChatwootLabel(null);
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

  // Rediseño bulk-elegant — contador-chip por tab: se VE qué origen tiene
  // algo cargado sin abrir cada tab. Para Segmento el número honesto es la
  // cantidad de FILTROS activos (el count de destinatarios del preview es la
  // UNIÓN de los orígenes — atribuírselo al segmento sería mentir).
  // Micro-fix L1 — la deuda cuenta con el MISMO criterio EFECTIVO que el
  // gate/hint (`hasEffectiveBalanceFilter`, >0 finito): una deuda de $0
  // tipeada NO es un filtro (el hint dice "no filtra a nadie" y el gate la
  // ignora) — contar "1 filtro" ahí era una contradicción visible.
  // network-filter-tab — mismo criterio de honestidad, por tab: el chip de
  // Segmento cuenta SOLO lo que vive en su panel (estados + deuda efectiva);
  // el filtro de red cuenta en el chip del tab Nodo/AP (`networkFilterCount`,
  // 0/1/2) — contarlo en ambos duplicaría, contarlo en Segmento mentiría.
  const segmentFilterCount = segment.statuses.length + (hasEffectiveBalanceFilter(segment) ? 1 : 0);
  const networkChipCount = networkFilterCount(segment);

  /** Label de tab con contador-chip opcional (el accname del tab incluye el número). */
  function tabLabel(text: string, count: number, unit?: string) {
    return (
      <span className={styles.tabLabel}>
        {text}
        {count > 0 && (
          <span className={styles.tabChip}>
            {unit ? `${count} ${unit}${count === 1 ? '' : 's'}` : count}
          </span>
        )}
      </span>
    );
  }

  // bulk-task-recipients (D8) — config REALMENTE vacía (ya resuelta, sin
  // stages mapeados) — durante loading/error el tab NO se marca "vacío" (el
  // panel ya distingue esas 2 ramas de la de config vacía).
  const taskStagesConfigEmpty =
    !taskStageConfigQuery.isLoading && !taskStageConfigQuery.isError && mappedTaskStages.length === 0;
  // fix wave F6 (review adversarial) — un 403 (sin `messaging.read`) es
  // NO-retryable: "Reintentá" nunca lo cura. Mismo criterio M2 que
  // `TaskStageConfigCard` en la rama sin `scheduling.read`.
  const taskStageConfigForbidden =
    axios.isAxiosError(taskStageConfigQuery.error) && taskStageConfigQuery.error.response?.status === 403;

  const recipientTabs = [
    {
      id: 'segment',
      label: tabLabel('Segmento', segmentFilterCount, 'filtro'),
      content: <SegmentBuilder value={segment} onChange={setSegment} />,
    },
    {
      // network-filter-tab — tab SEGUNDO (orden pedido por el usuario). El
      // panel edita el MISMO `segment` que el tab Segmento (nodo/AP viven
      // dentro de `CampaignSegment`) — mudanza de UI, no de modelo.
      id: 'network',
      label: tabLabel('Nodo/AP', networkChipCount),
      content: <NetworkFilterPanel value={segment} onChange={setSegment} />,
    },
    {
      id: 'manual',
      label: tabLabel('Manuales', manualRecipients.length),
      content: (
        <ManualRecipientsPicker
          value={manualRecipients}
          onChange={setManualRecipients}
          invalidIds={missingRecipientsError?.missingClientIds}
        />
      ),
    },
    {
      id: 'csv',
      label: tabLabel('CSV', csvContacts.length),
      content: <CsvRecipientsUploader key={csvResetKey} onChange={handleCsvChange} />,
    },
    {
      // bulk-granular-perms — tab "Números": pegar teléfonos sueltos (uno por
      // línea, opcional `número, nombre`). Gateado a `messaging.bulk_numbers`:
      // sin el permiso, el textarea queda deshabilitado (candado + aviso) y el
      // label del tab lleva un candado. Los números viajan por `manualContacts`
      // (junto con el CSV) — el BE dedup por teléfono.
      id: 'numbers',
      label: canUseNumbers ? (
        tabLabel('Números', numbersContacts.length)
      ) : (
        <span className={styles.tabLabel} title="No tenés permiso para enviar a números">
          Números{' '}
          <span aria-hidden="true">🔒</span>
        </span>
      ),
      content: (
        <div className={styles.numbersPanel}>
          <label htmlFor="bulk-numbers-input" className={styles.numbersLabel}>
            Números de teléfono
          </label>
          <p className={styles.numbersHint}>
            Uno por línea. Opcional: <code>número, nombre</code> (sin nombre, se muestra el número).
          </p>
          <textarea
            id="bulk-numbers-input"
            className={styles.numbersTextarea}
            value={numbersText}
            onChange={(e) => setNumbersText(e.target.value)}
            disabled={!canUseNumbers}
            rows={6}
            placeholder={'1123456789\n1198765432, Ana Gómez'}
            aria-describedby="bulk-numbers-count"
          />
          {canUseNumbers ? (
            <p id="bulk-numbers-count" className={styles.numbersCount} role="status">
              {numbersContacts.length} número{numbersContacts.length === 1 ? '' : 's'} válido
              {numbersContacts.length === 1 ? '' : 's'}
            </p>
          ) : (
            <p id="bulk-numbers-count" className={styles.numbersLockedHint} role="status">
              <span aria-hidden="true">🔒</span> No tenés permiso para enviar a números.
            </p>
          )}
        </div>
      ),
    },
    {
      // bulk-task-recipients (D8) — 6to tab "Tarea", AGREGADO AL FINAL (D10).
      // Config vacía (sin NINGÚN stage mapeado) → el label lleva un hint
      // visual (mismo criterio que "Números" con 🔒, acá ⚙ porque no es un
      // permiso sino data ausente) y el panel muestra el hint accionable en
      // vez de checkboxes — no hay nada que "tildar" hasta que un admin
      // mapee ≥1 stage en Ajustes → WhatsApp.
      id: 'task',
      label: taskStagesConfigEmpty ? (
        <span className={styles.tabLabel} title="Configurá estados de tarea en Ajustes → WhatsApp">
          Tarea <span aria-hidden="true">⚙</span>
        </span>
      ) : (
        tabLabel('Tarea', taskStageIds.length)
      ),
      content: (
        <TaskStagesTabPanel
          mappedStages={mappedTaskStages}
          isLoading={taskStageConfigQuery.isLoading}
          isError={taskStageConfigQuery.isError}
          isForbidden={taskStageConfigForbidden}
          value={taskStageIds}
          onChange={setTaskStageIds}
          previewCount={previewData?.count}
          noCustomerCount={previewData?.noCustomerCount}
        />
      ),
    },
  ];

  return (
    <div className={styles.layout}>
      <div className={styles.controls}>
        {/* Card 1 — Mensaje: template + variables en una sola card (antes eran
            2 apiladas). Sin el permiso messaging.templates la card entera no
            se monta (mismo gate de siempre — selectedTemplate solo puede
            setearse desde el selector, así que VariablesMapForm tampoco). */}
        {canUseTemplates && (
          <Can permission="messaging.templates">
            <section className={`${styles.card} ${styles.messageCard}`} aria-labelledby="bulk-card-message-title">
              <header className={styles.cardHeader}>
                <h2 id="bulk-card-message-title" className={styles.cardTitle}>
                  Mensaje
                </h2>
                <p className={styles.cardSubtitle}>Elegí el template aprobado y completá sus variables.</p>
              </header>

              <TemplateSelector
                templates={templatesQuery.data ?? []}
                isLoading={templatesQuery.isLoading}
                isError={templatesQuery.isError}
                selected={selectedTemplate}
                onSelect={handleSelectTemplate}
              />

              {selectedTemplate && (
                <VariablesMapForm
                  variables={selectedTemplate.variables}
                  value={variablesMap}
                  onChange={setVariablesMap}
                  missingVariables={missingVariables}
                  templateBody={selectedTemplate.body}
                />
              )}

              {/* campaign-chatwoot-label (D6/FE.2) — debajo de VariablesMapForm,
                  MISMO gate de la card (`messaging.templates`). Independiente de
                  si ya se eligió template (el operador puede pre-elegir la
                  etiqueta antes). chatwoot-label-config-fe — la CREACIÓN salió
                  de acá (ahora en Configuración → WhatsApp); el selector solo
                  elige entre el catálogo ya existente. */}
              <ChatwootLabelSelector
                labels={chatwootLabelsQuery.data ?? []}
                isLoading={chatwootLabelsQuery.isLoading}
                isError={chatwootLabelsQuery.isError}
                selected={chatwootLabel}
                onSelect={setChatwootLabel}
                onRetry={() => void chatwootLabelsQuery.refetch()}
              />
            </section>
          </Can>
        )}

        {/* Card 2 — Destinatarios: tabs Segmento / Nodo/AP / Manuales / CSV
            (network-filter-tab movió el filtro de red a su propio tab).
            mountMode="all" (default): los 4 paneles SIEMPRE montados —
            cambiar de tab no pierde el estado de los otros. */}
        <section className={styles.card} aria-labelledby="bulk-card-recipients-title">
          <header className={styles.cardHeader}>
            <h2 id="bulk-card-recipients-title" className={styles.cardTitle}>
              Destinatarios
            </h2>
            <p className={styles.cardSubtitle}>
              El segmento (con su filtro de nodo/AP), la lista manual y el CSV se combinan en un único envío, sin
              duplicados.
            </p>
          </header>

          <Tabs
            tabs={recipientTabs}
            activeTab={recipientsTab}
            onTabChange={(id) => setRecipientsTab(id as RecipientsTabId)}
          />
        </section>

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

        {/* bulk-granular-perms — 403 BULK_RECIPIENTS_NOT_PERMITTED: el operador
            eligió destinatarios para los que no tiene permiso (backstop del BE,
            ej. un cliente 'blocked' agregado a mano en Manuales). `forbidden`
            son etiquetas legibles (estados + 'números') — se muestran tal cual. */}
        {bulkRecipientsError && (
          <p className={styles.serverError} role="alert" aria-live="polite">
            {bulkRecipientsErrorMessage(bulkRecipientsError)}
          </p>
        )}

        {/* bulk-task-recipients (D3, TASK-2) — 422 TASK_STAGE_NOT_ELIGIBLE: el
            mapeo cambió mientras armabas la campaña. La config ya se
            refetcheó (efecto de arriba) — el mensaje guía a revisar el tab. */}
        {taskStageNotEligibleError && (
          <p className={styles.serverError} role="alert" aria-live="polite">
            {taskStageNotEligibleError.message}
          </p>
        )}

        {/* FIX-3b — errores de creación que NO son el 422 MISSING (EMPTY_SEGMENT,
            UNFILTERED_SEGMENT, TEMPLATE_NOT_APPROVED, red/500) ya no caen silenciosos. */}
        {createServerError && missingVariables.length === 0 && (
          <p className={styles.serverError} role="alert">
            {createServerError}
          </p>
        )}

        {/* Barra de acción — nombre + CTA en una sola fila limpia al final
            (rediseño bulk-elegant; antes eran una card de nombre + una fila
            suelta de botón). El hint del gate vive acá, pegado al CTA. */}
        <div className={styles.actionBar}>
          <div className={styles.actionRow}>
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
            {/* #5 — el gate `canCreate` sigue siendo la precondición para ABRIR
                el modal; el confirm de adentro dispara la creación real. */}
            <Button type="button" variant="primary" loading={isCreating} disabled={!canCreate} onClick={() => setConfirmOpen(true)}>
              Crear campaña
            </Button>
          </div>
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
        // bulk-csv-recipients (CSV-FE-6) + bulk-granular-perms — el modal pide
        // la UNIÓN completa (segmento + manuales + CSV + Números), ya no sólo
        // el segmento con un aviso.
        manualClientIds={manualClientIds}
        manualContacts={combinedManualContacts}
        // bulk-task-recipients (D8) — 4to origen: el modal pide la MISMA
        // unión completa que ve el preview automático (`/segment/recipients`
        // es el mismo endpoint que resuelve `taskStageIds`).
        taskStageIds={taskStageIds}
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
        csvCount={csvContacts.length}
        numbersCount={numbersContacts.length}
        statusCounts={previewData?.statusCounts ?? {}}
        skipped={previewData?.skipped}
        networkSiteName={networkSiteName}
        accessPointName={accessPointName}
        chatwootLabel={chatwootLabel}
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
