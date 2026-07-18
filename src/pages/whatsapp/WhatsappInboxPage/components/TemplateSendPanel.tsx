import { Fragment, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Select, type SelectOption } from '@/components/molecules/Select/Select';
import { useSendableTemplates, useSendWhatsappTemplate } from '@/hooks/useWhatsapp';
import { mapSendError } from '@/utils/mapSendError';
import type { TemplateSummaryDto } from '@/types/messagingBulk';
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
const EMPTY_VALUE = '';

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
 * template) tampoco regenera — un reintento con vars corregidas del MISMO
 * template sigue protegido contra doble-cargo. Un UUID nuevo, además, sale
 * de un remount real (cerrar+abrir el panel, o cambiar de conversación).
 */
export function TemplateSendPanel({ conversationId, onClose, onSent }: TemplateSendPanelProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateSummaryDto | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => makeIdempotencyKey());

  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const templatesQuery = useSendableTemplates(true);
  const { sendTemplate, isPending, isError, error, reset } = useSendWhatsappTemplate(conversationId);

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
    setVariables({});
    // PICK-1/ERR-1: elegir OTRO template limpia un error de envío previo — no
    // tiene sentido que un error del template A siga colgado sobre el B recién elegido.
    reset();
  }

  function handleVariableChange(variable: string, value: string) {
    setVariables((prev) => ({ ...prev, [variable]: value }));
  }

  const allVariablesFilled = !!selectedTemplate && selectedTemplate.variables.every((v) => (variables[v] ?? '').trim().length > 0);
  const canConfirm = !!selectedTemplate && allVariablesFilled && !isPending;

  function handleConfirm() {
    if (!selectedTemplate || !canConfirm) return;
    // D8 (wire): SIEMPRE el shape completo derivado de `template.variables` —
    // un template sin variables manda `variables:{}` (contrato explícito,
    // spec.md WAPI-1 "variables ausentes viajan como objeto vacío").
    const payloadVariables: Record<string, string> = {};
    for (const v of selectedTemplate.variables) payloadVariables[v] = variables[v] ?? '';

    sendTemplate(
      { templateRef: selectedTemplate.contentSid, variables: payloadVariables, idempotencyKey },
      { onSuccess: () => onSent() },
    );
  }

  const templateOptions: SelectOption[] = [
    { value: EMPTY_VALUE, label: 'Seleccioná un template…' },
    ...sendableTemplates.map((t) => ({ value: t.contentSid, label: t.friendlyName })),
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
                    {selectedTemplate.variables.map((variable) => {
                      const inputId = `template-send-variable-${variable}`;
                      return (
                        <div key={variable} className={styles.variableRow}>
                          <label htmlFor={inputId} className={styles.variableLabel}>{`{{${variable}}}`}</label>
                          <input
                            id={inputId}
                            type="text"
                            className={styles.variableInput}
                            value={variables[variable] ?? ''}
                            onChange={(e) => handleVariableChange(variable, e.target.value)}
                            disabled={isPending}
                          />
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
                        const value = (variables[part.variable] ?? '').trim();
                        if (value.length > 0) return <Fragment key={i}>{variables[part.variable]}</Fragment>;
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
