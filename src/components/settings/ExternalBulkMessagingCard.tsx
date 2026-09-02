import { useEffect, useRef, useState } from 'react';
import { Can } from '@/components/auth/Can';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { useConfirm } from '@/context/ConfirmContext';
import { useFeatureFlag, useSetFeatureFlag } from '@/hooks/useFeatureFlags';
import {
  useExternalBulkMessagingConfig,
  useSetExternalBulkMessagingConfig,
} from '@/hooks/useExternalBulkMessagingConfig';
import styles from './ExternalBulkMessagingCard.module.css';

const FLAG_KEY = 'messaging-external-bulk-enabled';
const DEFAULT_MAX_PER_REQUEST = 500;
const DEFAULT_MAX_PER_DAY = 2000;

const MAX_PER_REQUEST_ID = 'external-bulk-max-per-request';
const MAX_PER_DAY_ID = 'external-bulk-max-per-day';
const MAX_PER_REQUEST_HINT_ID = `${MAX_PER_REQUEST_ID}-hint`;
const MAX_PER_DAY_HINT_ID = `${MAX_PER_DAY_ID}-hint`;
const MAX_PER_REQUEST_ERROR_ID = `${MAX_PER_REQUEST_ID}-error`;
const MAX_PER_DAY_ERROR_ID = `${MAX_PER_DAY_ID}-error`;
const CAPS_CROSS_ERROR_ID = 'external-bulk-caps-cross-error';

/** Arma `aria-describedby` combinando hint + errores aplicables, omitiendo los ausentes. */
function describedBy(...ids: Array<string | false | undefined>): string | undefined {
  const joined = ids.filter((id): id is string => Boolean(id)).join(' ');
  return joined || undefined;
}

interface CapsForm {
  maxPerRequest: string;
  maxPerDay: string;
}

interface CapsFieldErrors {
  maxPerRequest?: string;
  maxPerDay?: string;
  cross?: string;
}

function toForm(maxPerRequest: number, maxPerDay: number): CapsForm {
  return { maxPerRequest: String(maxPerRequest), maxPerDay: String(maxPerDay) };
}

// Solo dígitos — rechaza notación científica ("1e3"), decimales, signo y
// vacío. `Number("1e3")` da 1000 (finito), así que `Number()` a secas dejaba
// pasar strings que un <input type="number"> SÍ acepta como valor válido
// (los navegadores parsean notación exponencial en ese input).
const STRICT_INTEGER_RE = /^\d+$/;

function parseIntOrNaN(raw: string): number {
  const trimmed = raw.trim();
  return STRICT_INTEGER_RE.test(trimmed) ? Number(trimmed) : NaN;
}

/**
 * Validación cliente (UX) — entero >= 1 en ambos campos, y
 * `maxPerRequest <= maxPerDay`. La AUTORIDAD real es el 400 del BE
 * (CONFIG-3): esto solo evita un roundtrip inútil y guía al usuario.
 */
function validateCapsForm(form: CapsForm): CapsFieldErrors {
  const errors: CapsFieldErrors = {};
  const mpr = parseIntOrNaN(form.maxPerRequest);
  const mpd = parseIntOrNaN(form.maxPerDay);

  if (!Number.isInteger(mpr) || mpr < 1) {
    errors.maxPerRequest = 'Ingresá un entero mayor o igual a 1.';
  }
  if (!Number.isInteger(mpd) || mpd < 1) {
    errors.maxPerDay = 'Ingresá un entero mayor o igual a 1.';
  }
  if (!errors.maxPerRequest && !errors.maxPerDay && mpr > mpd) {
    errors.cross = 'El tope por request no puede ser mayor que el tope diario.';
  }
  return errors;
}

interface ApiError {
  response?: { status?: number; data?: { code?: string } };
}

/**
 * Mapea el 400 del BE (CONFIG-3) a un mensaje accionable — la autoridad real
 * de la validación, por si el cliente no la atrapó (ventana entre el cambio
 * de topes del lado admin y este submit, o un bug en la validación cliente).
 */
function mapCapsSaveError(err: unknown): string {
  const e = err as ApiError;
  const status = e?.response?.status;
  if (status === 403) return 'No tenés permiso para editar los topes.';
  if (status === 400) {
    return 'Los topes ingresados no son válidos: deben ser enteros mayores o iguales a 1, y el tope por ' +
      'request no puede ser mayor que el tope diario.';
  }
  return 'No se pudieron guardar los topes. Reintentá en unos segundos.';
}

/**
 * ExternalBulkMessagingCard (external-bulk-messaging FE, D13, Batch B5) —
 * card "Envío masivo externo (API)" en WhatsappSettingsPage, junto a
 * `ChatwootSendPathCard`.
 *
 * Bloque 1 — kill-switch del flag `messaging-external-bulk-enabled` (molde
 * EXACTO `ChatwootSendPathCard.tsx`): toggle + confirm EN AMBAS direcciones
 * (tone danger), gate `admin.flags`. Prender habilita que una IA/integración
 * externa dispare envíos masivos de WhatsApp con la key dedicada — "es plata
 * real". Apagar corta esas llamadas con 403 de inmediato.
 *
 * Bloque 2 — topes `maxPerRequest`/`maxPerDay` (molde `NocBroadcastCard.tsx`
 * para el form controlado + diff/dirty, `TaskStageConfigCard.tsx` para el
 * patrón de card de Ajustes): 2 inputs numéricos + Guardar, gate
 * `messaging.manage`. Sin el permiso: los inputs quedan de solo lectura
 * (NUNCA ocultos) y no se muestra el botón Guardar.
 *
 * Fetch: si el flag O la config están cargando → skeleton único; si
 * cualquiera de los dos falla → "Estado desconocido" (JAMÁS un badge
 * confiado) con reintentar (cada fuente reintenta la suya).
 */
export function ExternalBulkMessagingCard() {
  const { can } = useMyPermissions();
  const canManage = can('messaging.manage');
  const confirm = useConfirm();

  const {
    data: flagData,
    isLoading: flagLoading,
    isError: flagError,
    refetch: refetchFlag,
  } = useFeatureFlag(FLAG_KEY);
  const setFlag = useSetFeatureFlag();

  const {
    data: config,
    isLoading: configLoading,
    isError: configError,
    refetch: refetchConfig,
  } = useExternalBulkMessagingConfig();
  const setConfig = useSetExternalBulkMessagingConfig();

  const [form, setForm] = useState<CapsForm | null>(null);
  const saveBtnRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Flag explícito "el usuario tocó el form desde el último baseline" —
  // NO se deriva comparando `form` contra el `config` NUEVO: eso confunde
  // "el usuario escribió algo distinto" con "el servidor cambió el valor
  // por su cuenta mientras el form quedó quieto" (ambos casos hacen que
  // form !== config, pero solo el primero es "sucio"). `patchForm` prende
  // el flag; el UNICO lugar que lo apaga es el effect de abajo, cuando el
  // guardado resuelve OK. OJO: el orden de declaracion de los dos effects
  // es load-bearing — este corre ANTES del baseline-effect en el mismo
  // commit, para que el baseline vea el flag ya apagado y sincronice.
  const userEditedRef = useRef(false);

  useEffect(() => {
    if (setConfig.isSuccess) userEditedRef.current = false;
  }, [setConfig.isSuccess]);

  // Reset baseline cuando la config cargada cambia (load inicial / tras
  // guardar OK) — PERO nunca si el form está "sucio" (el usuario tiene
  // cambios sin guardar). `onSettled` invalida la query TAMBIÉN cuando el
  // PUT falla (ver `useExternalBulkMessagingConfig.ts`), y ese refetch
  // devuelve un objeto `config` nuevo aunque los valores del servidor no
  // cambiaron — sin este guard, pisaba lo que el usuario estaba tipeando.
  useEffect(() => {
    if (!config) return;
    if (userEditedRef.current) return;
    setForm(toForm(config.maxPerRequest, config.maxPerDay));
  }, [config]);

  // A11y: mover el foco al botón Guardar cuando el guardado falla, para que
  // el error quede en el punto de foco (screen readers) en vez de perderse.
  // Corre UNA vez por transición error (ref `wasErrorRef`), nunca en cada
  // tecleo — y NUNCA mientras el usuario está escribiendo en un input de la
  // card (si no, el refetch de `onSettled` puede robar el foco del campo
  // que estaba editando). Si el botón todavía no está montado (primer
  // commit, `form` sigue null y la rama `loading` está activa), queda un
  // pedido pendiente (`focusRetryPendingRef`) que se reintenta cuando
  // `form` se puebla y el botón aparece en el DOM.
  const wasErrorRef = useRef(false);
  const focusRetryPendingRef = useRef(false);
  useEffect(() => {
    const isError = setConfig.isError;
    const justFailed = isError && !wasErrorRef.current;
    wasErrorRef.current = isError;

    if (!isError) {
      focusRetryPendingRef.current = false;
      return;
    }
    if (!justFailed && !focusRetryPendingRef.current) return;

    const active = document.activeElement;
    const userIsTyping =
      active instanceof HTMLElement && active.tagName === 'INPUT' && Boolean(cardRef.current?.contains(active));
    if (userIsTyping) return;

    if (saveBtnRef.current) {
      saveBtnRef.current.focus();
      focusRetryPendingRef.current = false;
    } else {
      focusRetryPendingRef.current = true;
    }
  }, [setConfig.isError, form]);

  const loading = flagLoading || configLoading || (!configError && form === null);
  const hasError = flagError || configError;

  if (loading && !hasError) {
    return (
      <section className={styles.card}>
        <p className={styles.loadingText}>Cargando…</p>
      </section>
    );
  }

  if (hasError) {
    return (
      <div className={styles.section}>
        <section className={styles.card}>
          <header className={styles.statusHeader}>
            <h3 className={styles.statusTitle}>Envío masivo externo (API)</h3>
            <span className={`${styles.statusBadge} ${styles.statusBadgeUnknown}`}>
              <span className={styles.statusBadgeDot} aria-hidden="true" />
              Estado desconocido
            </span>
          </header>

          <div className={`${styles.banner} ${styles.bannerInfo}`} role="alert">
            <span>
              <span className={styles.bannerTitle}>No se pudo leer el estado del envío masivo externo.</span>{' '}
              Reintentá.
            </span>
            <button
              type="button"
              className={styles.btnRetry}
              onClick={() => {
                if (flagError) void refetchFlag();
                if (configError) void refetchConfig();
              }}
            >
              Reintentar
            </button>
          </div>
        </section>
      </div>
    );
  }

  const enabled = flagData?.enabled ?? false;

  async function handleFlagToggle() {
    if (!enabled) {
      const ok = await confirm({
        title: 'Activar envío masivo externo',
        message:
          'Al activarlo, una IA o integración externa va a poder disparar envíos masivos de WhatsApp ' +
          'usando la key dedicada, dentro de los topes configurados abajo. Es plata real y el número de ' +
          'WhatsApp Business en juego. ¿Activarlo ahora?',
        confirmLabel: 'Activar envío masivo externo',
        cancelLabel: 'Cancelar',
        tone: 'danger',
      });
      if (!ok) return;
      setFlag.mutate({ key: FLAG_KEY, enabled: true });
      return;
    }
    const ok = await confirm({
      title: 'Desactivar envío masivo externo',
      message:
        'Al apagarlo, las llamadas externas al envío masivo (validate/send) van a empezar a recibir 403 ' +
        'de inmediato. ¿Desactivarlo ahora?',
      confirmLabel: 'Desactivar envío masivo externo',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });
    if (!ok) return;
    setFlag.mutate({ key: FLAG_KEY, enabled: false });
  }

  const fieldErrors = form ? validateCapsForm(form) : {};
  const hasClientError = Boolean(fieldErrors.maxPerRequest || fieldErrors.maxPerDay || fieldErrors.cross);
  const dirty = Boolean(
    form && config && (form.maxPerRequest !== String(config.maxPerRequest) || form.maxPerDay !== String(config.maxPerDay)),
  );

  function patchForm(p: Partial<CapsForm>) {
    if (setConfig.isSuccess || setConfig.isError) setConfig.reset();
    userEditedRef.current = true;
    setForm((f) => (f ? { ...f, ...p } : f));
  }

  async function handleSaveCaps() {
    if (!form || !canManage || setConfig.isPending || hasClientError) return;
    const mpr = parseIntOrNaN(form.maxPerRequest);
    const mpd = parseIntOrNaN(form.maxPerDay);
    const ok = await confirm({
      title: 'Guardar topes de envío masivo externo',
      message: `La API externa va a poder enviar hasta ${mpr} destinatarios por request y ${mpd} por día. ¿Guardar?`,
      confirmLabel: 'Guardar',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });
    if (!ok) return;
    setConfig.mutate({ maxPerRequest: mpr, maxPerDay: mpd });
  }

  const saveError = setConfig.isError ? mapCapsSaveError(setConfig.error) : null;

  return (
    <div className={styles.section} ref={cardRef}>
      <section className={styles.card}>
        {/* ── Bloque 1 — kill-switch ─────────────────────────────────────── */}
        <header className={styles.statusHeader}>
          {/* h3, no h2: la sección de WhatsappSettingsPage que envuelve esta
              card YA renderiza un <h2>"Envío masivo externo"> — duplicar el
              nivel acá rompía la jerarquía de encabezados (finding 5). */}
          <h3 className={styles.statusTitle}>Envío masivo externo (API)</h3>
          <span className={`${styles.statusBadge} ${enabled ? styles.statusBadgeOn : styles.statusBadgeOff}`}>
            <span className={styles.statusBadgeDot} aria-hidden="true" />
            {enabled ? 'Activo' : 'Inactivo'}
          </span>
        </header>

        <p className={styles.statusDescription}>
          Permite que una IA o integración externa dispare envíos masivos por WhatsApp con una key
          dedicada.
        </p>

        <Can permission="admin.flags">
          <div className={styles.statusActionRow}>
            <span className={styles.statusActionLabel}>
              {enabled ? 'Desactivar envío masivo externo' : 'Activar envío masivo externo'}
            </span>
            <label className={styles.switch}>
              <input
                type="checkbox"
                checked={enabled}
                disabled={setFlag.isPending}
                onChange={() => void handleFlagToggle()}
                aria-label={enabled ? 'Desactivar envío masivo externo' : 'Activar envío masivo externo'}
              />
              <span className={styles.switchTrack} aria-hidden="true" />
            </label>
          </div>
        </Can>

        {setFlag.isSuccess && (
          <div className={`${styles.banner} ${styles.bannerSuccess}`} role="status" aria-live="polite">
            <span>
              <span className={styles.bannerTitle}>Listo.</span>{' '}
              {setFlag.variables?.enabled
                ? 'Envío masivo externo activado.'
                : 'Envío masivo externo desactivado.'}
            </span>
          </div>
        )}

        {setFlag.isError && (
          <div className={`${styles.banner} ${styles.bannerError}`} role="alert">
            <span>
              <span className={styles.bannerTitle}>No se pudo cambiar el estado del envío masivo externo.</span>{' '}
              Reintentá en unos segundos.
            </span>
          </div>
        )}

        <hr className={styles.divider} />

        {/* ── Bloque 2 — topes ───────────────────────────────────────────── */}
        <h3 className={styles.blockTitle}>Topes de envío</h3>

        {!canManage && (
          // Sin role: es una nota ESTÁTICA (permiso del usuario, no cambia
          // en vivo) — no es un live update, así que no le corresponde
          // role="status" (finding 4).
          <p className={styles.readOnlyNote}>
            Solo lectura — necesitás permiso de gestión (messaging.manage) para editar los topes.
          </p>
        )}

        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="external-bulk-max-per-request">
              Tope por request
            </label>
            <input
              id={MAX_PER_REQUEST_ID}
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              className={`${styles.input} ${fieldErrors.maxPerRequest || fieldErrors.cross ? styles.inputError : ''}`}
              value={form?.maxPerRequest ?? ''}
              placeholder={String(DEFAULT_MAX_PER_REQUEST)}
              disabled={!canManage || setConfig.isPending}
              onChange={(e) => patchForm({ maxPerRequest: e.target.value })}
              aria-invalid={Boolean(fieldErrors.maxPerRequest || fieldErrors.cross)}
              aria-describedby={describedBy(
                MAX_PER_REQUEST_HINT_ID,
                fieldErrors.maxPerRequest && MAX_PER_REQUEST_ERROR_ID,
                fieldErrors.cross && CAPS_CROSS_ERROR_ID,
              )}
            />
            <span id={MAX_PER_REQUEST_HINT_ID} className={styles.fieldHint}>
              Máximo de destinatarios que la API externa puede validar/enviar en un mismo request.
            </span>
            {fieldErrors.maxPerRequest && (
              // role="status" (polite), no "alert": es validación por
              // tecleo — un role="alert" por cada tecla es demasiado
              // agresivo para un screen reader (finding 3). El banner de
              // guardado fallido, más abajo, SÍ sigue siendo role="alert".
              <span id={MAX_PER_REQUEST_ERROR_ID} className={styles.fieldError} role="status">
                {fieldErrors.maxPerRequest}
              </span>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="external-bulk-max-per-day">
              Tope diario
            </label>
            <input
              id={MAX_PER_DAY_ID}
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              className={`${styles.input} ${fieldErrors.maxPerDay || fieldErrors.cross ? styles.inputError : ''}`}
              value={form?.maxPerDay ?? ''}
              placeholder={String(DEFAULT_MAX_PER_DAY)}
              disabled={!canManage || setConfig.isPending}
              onChange={(e) => patchForm({ maxPerDay: e.target.value })}
              aria-invalid={Boolean(fieldErrors.maxPerDay || fieldErrors.cross)}
              aria-describedby={describedBy(
                MAX_PER_DAY_HINT_ID,
                fieldErrors.maxPerDay && MAX_PER_DAY_ERROR_ID,
                fieldErrors.cross && CAPS_CROSS_ERROR_ID,
              )}
            />
            <span id={MAX_PER_DAY_HINT_ID} className={styles.fieldHint}>
              Máximo de destinatarios enviados por día (se cuenta lo efectivamente enviado).
            </span>
            {fieldErrors.maxPerDay && (
              <span id={MAX_PER_DAY_ERROR_ID} className={styles.fieldError} role="status">
                {fieldErrors.maxPerDay}
              </span>
            )}
          </div>
        </div>

        {fieldErrors.cross && (
          <span id={CAPS_CROSS_ERROR_ID} className={styles.fieldError} role="status">
            {fieldErrors.cross}
          </span>
        )}

        {saveError && (
          <div className={`${styles.banner} ${styles.bannerError}`} role="alert">
            <span>{saveError}</span>
          </div>
        )}
        {setConfig.isSuccess && (
          // Depende SOLO de `isSuccess` (fix wave 2, item 1) — no de `!dirty`.
          // `dirty` compara `form` contra `config` (la query), y aunque el
          // fix de `useSetExternalBulkMessagingConfig` sincroniza esa query
          // con `setQueryData` en `onSuccess`, esa sincronización pasa por
          // OTRO hook/suscripción que `isSuccess` (ambos reaccionan a la
          // misma resolución del PUT, pero no hay garantía de que lleguen en
          // el mismo render). Atarse a `isSuccess`, que SÍ es sincrónico con
          // la resolución de la mutation, cierra esa ventana ciega. Editar
          // de nuevo llama `setConfig.reset()` (ver `patchForm`), que apaga
          // `isSuccess` y hace desaparecer el banner.
          <div className={`${styles.banner} ${styles.bannerSuccess}`} role="status" aria-live="polite">
            <span>Topes guardados.</span>
          </div>
        )}

        {canManage && (
          <div className={styles.actions}>
            <button
              ref={saveBtnRef}
              type="button"
              className={styles.btnPrimary}
              // Tras un guardado fallido se permite reintentar aunque `dirty`
              // sea false relativo a la config recién leída (el PUT que
              // falló no persistió nada) — si no, el botón queda deshabilitado
              // e inalcanzable por foco justo cuando el usuario más lo necesita.
              // `|| setConfig.isSuccess` (fix wave 2, item 1): un guardado
              // recién exitoso no puede volver a dispararse hasta que el
              // usuario edite el form de nuevo (lo que llama `reset()` y
              // apaga `isSuccess`) — sin depender de que `dirty` ya haya
              // reaccionado a la config sincronizada.
              disabled={((!dirty || setConfig.isSuccess) && !setConfig.isError) || setConfig.isPending || hasClientError}
              onClick={() => void handleSaveCaps()}
            >
              {setConfig.isPending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
