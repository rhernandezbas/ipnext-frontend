import { Fragment, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Select, type SelectOption } from '@/components/molecules/Select/Select';
import { useInboxClientContext, useSendableTemplates, useSendWhatsappTemplate } from '@/hooks/useWhatsapp';
import { mapSendError } from '@/utils/mapSendError';
import { formatMoney } from '@/utils/formatMoney';
import type { TemplateSummaryDto } from '@/types/messagingBulk';
import type { WhatsappClientContext } from '@/types/whatsapp';
import styles from './TemplateSendPanel.module.css';

/** Elementos tabulables dentro del diálogo (para el focus-trap) — mismo criterio que `ConfirmModal`/`PreviewModal`. */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusable(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

const TITLE_ID = 'template-send-panel-title';
const SUBTITLE_ID = 'template-send-panel-subtitle';
const SOURCES_HINT_ID = 'template-send-sources-hint';
const EMPTY_VALUE = '';

/**
 * FUENTES (variables con opciones + texto libre) — espejo CONCEPTUAL de
 * `VariablesMapForm.SOURCE_OPTIONS` (bulk): `name`/`balanceDue`/`literal` con
 * los MISMOS labels. Diferencia clave de contrato: en el bulk la resolución la
 * hace el BE por destinatario (viaja el `source`); acá el endpoint de envío
 * recibe VALORES literales — la resolución es CLIENT-SIDE al confirmar, con
 * los datos de la cache del contexto del cliente (los mismos en pantalla).
 */
type VariableSource = 'name' | 'balanceDue' | 'literal';

/** Bug BAJO #13c precedent (`useWhatsapp.ts:makeTempId`) — `crypto.randomUUID` puede faltar (contexto no-seguro/browser viejo). */
function makeIdempotencyKey(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `idem-${Date.now()}-${Math.random()}`;
}

type TemplateBodyPart = { text: string } | { variable: string };

/** Parte `template.body` en segmentos de texto plano y placeholders `{{N}}` — mismo patrón que `VariablesMapForm.splitTemplateBody` (bulk), no exportado desde ahí. */
function splitTemplateBody(body: string): TemplateBodyPart[] {
  const parts: TemplateBodyPart[] = [];
  const re = /\{\{(\w+)\}\}/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    if (m.index > lastIndex) parts.push({ text: body.slice(lastIndex, m.index) });
    parts.push({ variable: m[1] });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < body.length) parts.push({ text: body.slice(lastIndex) });
  return parts;
}

interface TemplateSendPanelProps {
  conversationId: string;
  /** Backdrop/Esc/botón "Cerrar"/"Cancelar" — el padre (`Composer`) decide qué hacer (cerrar el panel). */
  onClose: () => void;
  /** Envío OK — el padre cierra el panel Y anuncia "Template enviado" (design SEND-1; el panel ya se desmonta, el announcement vive en `Composer`). */
  onSent: () => void;
  /**
   * Contexto LIGHT del detalle de la conversación (F1) — llega threadeado
   * `WhatsappInboxPage → Composer → acá` (mismo dato que alimenta a
   * `ClientContextPanel`). Decide si las FUENTES de datos están disponibles:
   * SOLO `matched` con candidatos habilita "Nombre del cliente"/"Monto de
   * deuda" (y dispara el fetch RICO con la MISMA key que el panel de contexto
   * — `useInboxClientContext(conversationId, null)`, cache compartida).
   * `unknown`/`ambiguous`/ausente → opciones de datos deshabilitadas + hint,
   * solo "Valor fijo" (jamás adivinamos de quién son los datos — mismo
   * criterio CTX-1 del panel). Opcional/backcompat: sin el prop se comporta
   * como "sin cliente".
   */
  lightContext?: WhatsappClientContext | null;
}

/**
 * TemplateSendPanel (inbox-template-send, design D11) — picker de templates
 * aprobados + variables + preview + confirm/envío, para cuando la ventana de
 * 24h expiró (CTA "Enviar template" del composer). Modal por portal, molde
 * a11y de `PreviewModal`/`ConfirmModal` (foco inicial dentro del diálogo,
 * focus-trap Tab/Shift+Tab, Esc/backdrop cierran, restauración de foco al
 * desmontar, scroll-lock del body).
 *
 * A diferencia de esos moldes, este componente NO recibe un prop `open` —
 * el padre (`Composer`) lo monta/desmonta condicionalmente
 * (`{templatePanelOpen && <TemplateSendPanel .../>}`), así que "montado" ==
 * "abierto": los efectos de foco/scroll-lock/teclado corren una vez al montar
 * y limpian al desmontar (equivalente exacto al patrón `[open]` de los otros
 * modales, sin la rama `if (!open) return null`). Esto también evita que
 * suites que auto-mockean `@/hooks/useWhatsapp` (ej. `WhatsappInboxPage.test.tsx`)
 * necesiten stubear `useSendableTemplates`/`useSendWhatsappTemplate` sólo
 * porque el composer renderiza — los hooks nuevos sólo se llaman cuando el
 * agente efectivamente clickeó el CTA.
 *
 * `conversationId` — el caller (`Composer`) monta este componente con
 * `key={conversationId}` (design D11/SEND-1): un cambio de conversación
 * fuerza un remount limpio (selección/variables/idempotencyKey de la
 * conversación anterior NUNCA sobreviven, memoria `inbox-key-por-conversacion`).
 *
 * `idempotencyKey` (contrato H1, design D5/D11; ampliado por el review
 * adversarial post-CTA-1) se genera al montar (`useState` lazy init) y se
 * REUSA en los reintentos de un MISMO intento de envío — mismo template,
 * "Confirmar y enviar" de nuevo tras un error, doble click — así el guard-0
 * server-side dedupea correctamente. PERO `handleSelectTemplate` la
 * REGENERA cuando el template elegido CAMBIA (contentSid distinto al ya
 * seleccionado): cambiar de template es una intención NUEVA, y reusar la
 * key vieja causaría un wrong-send silencioso (el operador elige A,
 * confirma, sufre un timeout ambiguo, elige B, confirma — B viajaría con la
 * key de A, el server lo dedupea contra A y B nunca sale). El PRIMER pick
 * (null → algo) NO regenera — reusa la key de montaje, porque todavía no
 * hubo ningún intento de envío con ella. Cambiar SOLO variables (mismo
 * template) tampoco regenera — y con FUENTES eso incluye cambiar la FUENTE
 * de una variable (literal ↔ dato del cliente): un reintento con vars
 * corregidas del MISMO template sigue protegido contra doble-cargo. Un UUID
 * nuevo, además, sale de un remount real (cerrar+abrir el panel, o cambiar
 * de conversación).
 */
export function TemplateSendPanel({ conversationId, onClose, onSent, lightContext }: TemplateSendPanelProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateSummaryDto | null>(null);
  // FUENTES: por variable, la fuente elegida ('' = "Elegí una fuente…") + el
  // texto tipeado para "Valor fijo". Dos mapas separados a propósito: cambiar
  // de fuente y volver a "Valor fijo" NO pierde lo tipeado (el valor SOLO
  // cuenta cuando la fuente activa es `literal` — ver `resolveVariable`).
  const [variableSources, setVariableSources] = useState<Record<string, VariableSource | ''>>({});
  const [literalValues, setLiteralValues] = useState<Record<string, string>>({});
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => makeIdempotencyKey());

  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const templatesQuery = useSendableTemplates(true);
  const { sendTemplate, isPending, isError, error, reset } = useSendWhatsappTemplate(conversationId);

  // FUENTES — contexto RICO del cliente, con la MISMA query key que
  // `ClientContextPanel` usa en `matched` (`whatsappClientContextKey(convId,
  // null)`): cache compartida, jamás un fetch paralelo propio. El gate
  // `clientMatched` replica el `shouldFetchRich` del panel para `matched`
  // (status matched + candidatos no vacíos — un `matched` sin clients es dato
  // malformado y cae a "sin cliente"). En `unknown`/`ambiguous` se pasa
  // `null` → `enabled:false`: NUNCA disparamos un fetch que el panel de
  // contexto no hizo (CTX-1: sin candidato resuelto no se agregan datos de
  // nadie — la desambiguación vive en el panel, no acá).
  const clientMatched = lightContext?.status === 'matched' && (lightContext?.clients.length ?? 0) > 0;
  const contextQuery = useInboxClientContext(clientMatched ? conversationId : null, null);
  const contextClient = clientMatched ? contextQuery.data?.client : undefined;

  // Valores resueltos de las fuentes de datos — client-side, con lo que hay
  // EN PANTALLA (la cache): sin dato ⇒ '' ⇒ la opción queda deshabilitada y
  // el gate del confirm bloquea. La deuda usa el MISMO `formatMoney` que el
  // HERO del panel de contexto — el operador ve el mismo número en ambos lados.
  const resolvedName = (contextClient?.name ?? '').trim();
  const resolvedDebt =
    contextClient && contextClient.balance.due != null
      ? formatMoney(contextClient.balance.due, contextClient.balance.currency)
      : '';

  function resolveVariable(variable: string): string {
    const source = variableSources[variable] ?? '';
    if (source === 'name') return resolvedName;
    if (source === 'balanceDue') return resolvedDebt;
    if (source === 'literal') return literalValues[variable] ?? '';
    return '';
  }

  // Foco inicial (al botón "Cerrar") + restauración al desmontar — molde
  // `PreviewModal`, pero keyed en `[]` (corre una vez al montar) porque este
  // componente no tiene prop `open`: existir YA es estar abierto.
  useEffect(() => {
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => {
      const el = restoreFocusRef.current;
      if (el && typeof el.focus === 'function') el.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- una sola vez, al montar/desmontar.
  }, []);

  // Scroll lock + teclado (Esc cierra, Tab atrapa el foco dentro del diálogo).
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = getFocusable(dialogRef.current);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      const outside = !dialogRef.current?.contains(active);
      if (e.shiftKey) {
        if (active === first || outside) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || outside) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const sendableTemplates = (templatesQuery.data ?? []).filter((t) => t.sendable);

  function handleSelectTemplate(contentSid: string) {
    const next = sendableTemplates.find((t) => t.contentSid === contentSid) ?? null;
    // EDGE de contrato (review adversarial, arreglado): cambiar de template
    // dentro del MISMO panel es una intención NUEVA — regenerar acá evita el
    // wrong-send silencioso (ver el doc comment del componente, arriba).
    // Regla lean: SOLO dispara cuando hay un template PREVIO y uno NUEVO, y
    // son distintos entre sí. El primer pick (`selectedTemplate` todavía
    // `null`) no regenera — reusa la key de montaje. Cambiar solo variables
    // nunca pasa por acá (`handleVariableChange` no toca la key).
    if (selectedTemplate && next && selectedTemplate.contentSid !== next.contentSid) {
      setIdempotencyKey(makeIdempotencyKey());
    }
    setSelectedTemplate(next);
    setVariableSources({});
    setLiteralValues({});
    // PICK-1/ERR-1: elegir OTRO template limpia un error de envío previo — no
    // tiene sentido que un error del template A siga colgado sobre el B recién elegido.
    reset();
  }

  // Idempotencia SAGRADA: cambiar la FUENTE (o el texto) de una variable NUNCA
  // toca `idempotencyKey` — mismo template = misma intención de envío (igual
  // que el histórico "cambiar solo variables no regenera"). Solo cambiar de
  // TEMPLATE regenera (`handleSelectTemplate`, arriba).
  function handleSourceChange(variable: string, source: VariableSource | '') {
    setVariableSources((prev) => ({ ...prev, [variable]: source }));
  }

  function handleLiteralChange(variable: string, value: string) {
    setLiteralValues((prev) => ({ ...prev, [variable]: value }));
  }

  // Gate del confirm, extendido a fuentes: TODAS las variables con valor
  // RESUELTO no-vacío (fuente con dato, o "Valor fijo" no-vacío).
  const allVariablesResolved =
    !!selectedTemplate && selectedTemplate.variables.every((v) => resolveVariable(v).trim().length > 0);
  const canConfirm = !!selectedTemplate && allVariablesResolved && !isPending;

  function handleConfirm() {
    if (!selectedTemplate || !canConfirm) return;
    // D8 (wire): SIEMPRE el shape completo derivado de `template.variables` —
    // un template sin variables manda `variables:{}` (contrato explícito,
    // spec.md WAPI-1 "variables ausentes viajan como objeto vacío").
    // FUENTES: el shape del payload NO cambia — viajan los valores RESUELTOS
    // como strings, resueltos ACÁ con la cache del contexto (los mismos datos
    // que el operador ve en pantalla — sin re-fetch sorpresa al confirmar).
    const payloadVariables: Record<string, string> = {};
    for (const v of selectedTemplate.variables) payloadVariables[v] = resolveVariable(v);

    sendTemplate(
      { templateRef: selectedTemplate.contentSid, variables: payloadVariables, idempotencyKey },
      { onSuccess: () => onSent() },
    );
  }

  const templateOptions: SelectOption[] = [
    { value: EMPTY_VALUE, label: 'Seleccioná un template…' },
    ...sendableTemplates.map((t) => ({ value: t.contentSid, label: t.friendlyName })),
  ];

  // Opciones de fuente por variable (mismas para todas las filas). Las de
  // DATOS se deshabilitan cuando su valor resuelto está vacío — cubre de una
  // "sin cliente" (unknown/ambiguous/sin contexto), "todavía cargando" y
  // "dato ausente" (ej. `balance.due: null` ⇒ deuda no disponible).
  const sourceSelectOptions: SelectOption[] = [
    { value: '', label: 'Elegí una fuente…' },
    { value: 'name', label: 'Nombre del cliente', disabled: resolvedName.length === 0 },
    { value: 'balanceDue', label: 'Monto de deuda', disabled: resolvedDebt.length === 0 },
    { value: 'literal', label: 'Valor fijo' },
  ];

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={TITLE_ID}
      aria-describedby={SUBTITLE_ID}
    >
      <div className={styles.dialog} ref={dialogRef}>
        <div className={styles.header}>
          <div className={styles.headerText}>
            <h2 id={TITLE_ID} className={styles.title}>Enviar template</h2>
            {/* Rediseño card: subtítulo de contexto — explica POR QUÉ el agente
                está acá (la ventana de 24h expiró) sin que tenga que volver al
                composer a releer el aviso. `aria-describedby` del dialog. */}
            <p id={SUBTITLE_ID} className={styles.subtitle}>
              La ventana de 24h expiró — solo se puede enviar un template aprobado.
            </p>
          </div>
          <button ref={closeRef} type="button" className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <div className={styles.body}>
          {templatesQuery.isLoading && (
            <p className={styles.notice} role="status">
              Cargando templates…
            </p>
          )}

          {!templatesQuery.isLoading && templatesQuery.isError && (
            <>
              <p className={styles.error} role="alert">
                No se pudieron cargar los templates. Reintentá.
              </p>
              <button type="button" className={styles.retryBtn} onClick={() => templatesQuery.refetch()}>
                Reintentar
              </button>
            </>
          )}

          {!templatesQuery.isLoading && !templatesQuery.isError && sendableTemplates.length === 0 && (
            <p className={styles.notice} role="status">
              No hay templates aprobados.
            </p>
          )}

          {!templatesQuery.isLoading && !templatesQuery.isError && sendableTemplates.length > 0 && (
            <>
              {/* Rediseño card — la sección del combobox lleva su propio
                  wrapper: (a) cinturón `:focus-within` anti-stacking-context
                  (lección bulk-dropdown-z/bulk-z-root) y (b) ancla del cap
                  local del listbox (CLIP-1, ver la CSS Module). */}
              <div className={styles.selectorSection}>
                <Select
                  label="Template"
                  options={templateOptions}
                  value={selectedTemplate?.contentSid ?? EMPTY_VALUE}
                  onChange={handleSelectTemplate}
                  placeholder="Seleccioná un template…"
                  disabled={isPending}
                />
              </div>

              {selectedTemplate && selectedTemplate.variables.length > 0 && (
                <div className={styles.variablesSection}>
                  {/* Divisor en el CONTENEDOR, jamás en un pseudo-elemento del
                      fieldset (lección M1 del bulk: los ::before de un
                      <fieldset> caen DESPUÉS del legend en browsers reales). */}
                  <fieldset className={styles.fieldset}>
                    <legend className={styles.legend}>Variables del template</legend>
                    {/* FUENTES — hint cuando no hay cliente asociado (unknown/
                        ambiguous/sin contexto): las opciones de datos quedan
                        deshabilitadas; referenciado por aria-describedby de
                        cada Select para que un SR explique el porqué. */}
                    {!clientMatched && (
                      <p id={SOURCES_HINT_ID} className={styles.notice}>
                        Sin cliente asociado — usá valor fijo.
                      </p>
                    )}
                    {selectedTemplate.variables.map((variable) => {
                      const selectId = `template-send-variable-${variable}-source`;
                      const literalId = `template-send-variable-${variable}`;
                      const resolvedId = `template-send-variable-${variable}-resolved`;
                      const source = variableSources[variable] ?? '';
                      const isDataSource = source === 'name' || source === 'balanceDue';
                      return (
                        <div key={variable} className={styles.variableRow}>
                          <Select
                            id={selectId}
                            label={`{{${variable}}}`}
                            options={sourceSelectOptions}
                            value={source}
                            onChange={(next) => handleSourceChange(variable, next as VariableSource | '')}
                            placeholder="Elegí una fuente…"
                            disabled={isPending}
                            aria-describedby={!clientMatched ? SOURCES_HINT_ID : isDataSource ? resolvedId : undefined}
                          />
                          {/* Valor resuelto de la fuente de datos — readonly,
                              al lado del Select; el prefijo sr-only lo hace
                              legible por SR ("Valor resuelto: …") y el
                              aria-describedby de arriba lo ata al combobox. */}
                          {isDataSource && (
                            <p
                              id={resolvedId}
                              className={styles.resolvedValue}
                              data-testid={`template-var-resolved-${variable}`}
                            >
                              <span aria-hidden="true">→ </span>
                              <span className={styles.srOnly}>Valor resuelto: </span>
                              {resolveVariable(variable)}
                            </p>
                          )}
                          {source === 'literal' && (
                            <>
                              <label htmlFor={literalId} className={styles.srOnly}>
                                {`Valor fijo para {{${variable}}}`}
                              </label>
                              <input
                                id={literalId}
                                type="text"
                                className={styles.variableInput}
                                value={literalValues[variable] ?? ''}
                                onChange={(e) => handleLiteralChange(variable, e.target.value)}
                                placeholder="Valor…"
                                disabled={isPending}
                              />
                            </>
                          )}
                        </div>
                      );
                    })}
                  </fieldset>
                </div>
              )}

              {/* Card de preview (el pedido del rediseño): burbuja estilo chat
                  WhatsApp — patrón visual del PreviewModal del bulk (cola
                  ::before) — con las variables interpoladas EN VIVO. SIEMPRE
                  montada en la rama success: el canvas con placeholder también
                  es el "aire" que garantiza que el listbox capado del Select
                  nunca se pase de la caja scrolleable del body (CLIP-1).
                  Sin live region a propósito: re-anunciar el body ENTERO en
                  cada tecleo de variable sería ruido para lectores de pantalla
                  — el pendiente ya se señala inline con texto sr-only. */}
              <section className={styles.previewSection} aria-labelledby="template-send-preview-title">
                <h3 id="template-send-preview-title" className={styles.previewTitle}>Vista previa</h3>
                <div className={styles.previewCanvas}>
                  {selectedTemplate ? (
                    <p
                      /* keyed por template: cambiar de template remonta la
                         burbuja y replay-a la entrada (motion 200ms backwards). */
                      key={selectedTemplate.contentSid}
                      className={styles.previewBubble}
                      data-testid="template-preview-bubble"
                    >
                      {splitTemplateBody(selectedTemplate.body).map((part, i) => {
                        if (!('variable' in part)) return <Fragment key={i}>{part.text}</Fragment>;
                        // FUENTES: la burbuja interpola el valor YA RESUELTO
                        // (dato del cliente o texto libre) — el operador ve el
                        // mensaje final EXACTO que va a recibir el cliente.
                        const resolved = resolveVariable(part.variable);
                        if (resolved.trim().length > 0) return <Fragment key={i}>{resolved}</Fragment>;
                        return (
                          <span
                            key={i}
                            className={styles.pending}
                            data-testid={`template-preview-pending-${part.variable}`}
                          >
                            {`{{${part.variable}}}`}
                            <span className={styles.srOnly}> (pendiente)</span>
                          </span>
                        );
                      })}
                    </p>
                  ) : (
                    <p className={styles.previewPlaceholder} data-testid="template-preview-placeholder">
                      Elegí un template para ver acá cómo lo va a recibir el cliente.
                    </p>
                  )}
                </div>
              </section>

              {/* BAJO/aceptado (review adversarial): el 422 MISSING_TEMPLATE_VARIABLES
                  trae un `missing[]` con los nombres puntuales — acá NO se usa para
                  resaltar los inputs correspondientes, solo se muestra el copy
                  mapeado (ERR-1 exige eso, ya cumplido por `mapSendError`). El gate
                  client-side (`allVariablesFilled`/`canConfirm`) ya bloquea el
                  "Confirmar y enviar" mientras falte alguna variable, así que este
                  422 es casi inalcanzable en la práctica (solo por una carrera o un
                  bypass del cliente) — deuda menor, no vale la complejidad de
                  mapear `missing[]` a los inputs por ahora. */}
              {isError && (
                <p className={styles.error} role="alert">
                  {mapSendError(error)}
                </p>
              )}
            </>
          )}
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className={styles.confirm} onClick={handleConfirm} disabled={!canConfirm}>
            {isPending ? 'Enviando…' : 'Confirmar y enviar'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
