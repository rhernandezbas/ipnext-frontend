import { useEffect, useRef, useState } from 'react';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { useConfirm } from '@/context/ConfirmContext';
import {
  useMessagingRatesConfig,
  useSetMessagingRatesConfig,
  useMessagingCreditBalance,
} from '@/hooks/useMessagingRatesConfig';
import { Select, type SelectOption } from '@/components/molecules/Select/Select';
import { computeUnitCost, estimateSpend, formatMoney, tryParseMoney } from '@/utils/messagingMoney';
import type { MessagingRateCategory, MessagingRatesConfig } from '@/types/messagingRates';
import styles from './MessagingRatesCard.module.css';

const RATE_RE = /^\d+(\.\d{1,4})?$/;
const CURRENCY_RE = /^[A-Z]{3}$/;
/** Finding 5 (fix wave) — cantidad del estimador: entero de 1 a 7 dígitos, luego acotado a [1, 1_000_000]. */
const QUANTITY_RE = /^\d{1,7}$/;
const MAX_QUANTITY = 1_000_000;

const CURRENCY_ID = 'messaging-rates-currency';
const UTILITY_ID = 'messaging-rates-utility';
const MARKETING_ID = 'messaging-rates-marketing';
const AUTHENTICATION_ID = 'messaging-rates-authentication';
const FEE_ID = 'messaging-rates-provider-fee';
const ESTIMATOR_QTY_ID = 'messaging-rates-estimator-quantity';
const ESTIMATOR_CATEGORY_ID = 'messaging-rates-estimator-category';

/** Finding 8 (fix wave) — el label relativo del saldo se re-computa cada TICK. */
const RELATIVE_TICK_MS = 30_000;
/** Finding 6 (fix wave) — debounce del live region del estimador (no anunciar cada tecla). */
const ANNOUNCE_DEBOUNCE_MS = 400;

const CATEGORY_OPTIONS: SelectOption[] = [
  { value: 'UTILITY', label: 'UTILITY' },
  { value: 'MARKETING', label: 'MARKETING' },
  { value: 'AUTHENTICATION', label: 'AUTHENTICATION' },
];

const CATEGORIES: MessagingRateCategory[] = ['UTILITY', 'MARKETING', 'AUTHENTICATION'];

interface RatesForm {
  currency: string;
  utilityRate: string;
  marketingRate: string;
  authenticationRate: string;
  providerFee: string;
}

interface FieldErrors {
  currency?: string;
  utilityRate?: string;
  marketingRate?: string;
  authenticationRate?: string;
  providerFee?: string;
}

function toForm(rates: MessagingRatesConfig): RatesForm {
  return {
    currency: rates.currency,
    utilityRate: rates.utilityRate,
    marketingRate: rates.marketingRate,
    authenticationRate: rates.authenticationRate,
    providerFee: rates.providerFee,
  };
}

function rateFieldFor(category: MessagingRateCategory): keyof RatesForm {
  switch (category) {
    case 'UTILITY':
      return 'utilityRate';
    case 'MARKETING':
      return 'marketingRate';
    case 'AUTHENTICATION':
      return 'authenticationRate';
  }
}

/** Arma `aria-describedby` combinando los ids aplicables, omitiendo los ausentes. */
function describedBy(...ids: Array<string | false | undefined>): string | undefined {
  const joined = ids.filter((id): id is string => Boolean(id)).join(' ');
  return joined || undefined;
}

const RATE_ERROR_MSG = 'Ingresá un decimal mayor o igual a 0, con hasta 4 decimales.';
const CURRENCY_ERROR_MSG = 'Ingresá un código de moneda de 3 letras en mayúsculas (ISO-4217), ej. USD.';
const QUANTITY_ERROR_MSG = 'Ingresá una cantidad entera entre 1 y 1.000.000.';

/**
 * Validación cliente (UX) — MISMA regex que la autoridad real del BE
 * (`DECIMAL_4_RE`/`CURRENCY_RE`, `SetMessagingRatesConfig`, design D4.e): un
 * `parseFloat` acá reintroduciría el float que la aritmética de punto fijo
 * del BE saca de raíz (D2), así que la validación es puramente sintáctica
 * sobre el STRING tipeado, nunca sobre un `Number(input)`.
 */
function validateRatesForm(form: RatesForm): FieldErrors {
  const errors: FieldErrors = {};
  if (!CURRENCY_RE.test(form.currency)) errors.currency = CURRENCY_ERROR_MSG;
  if (!RATE_RE.test(form.utilityRate)) errors.utilityRate = RATE_ERROR_MSG;
  if (!RATE_RE.test(form.marketingRate)) errors.marketingRate = RATE_ERROR_MSG;
  if (!RATE_RE.test(form.authenticationRate)) errors.authenticationRate = RATE_ERROR_MSG;
  if (!RATE_RE.test(form.providerFee)) errors.providerFee = RATE_ERROR_MSG;
  return errors;
}

/** Finding 5 (fix wave) — cantidad válida del estimador: entero string [1, 7] dígitos, en [1, 1_000_000]. */
function isValidQuantity(raw: string): boolean {
  const trimmed = raw.trim();
  if (!QUANTITY_RE.test(trimmed)) return false;
  const n = Number(trimmed);
  return n >= 1 && n <= MAX_QUANTITY;
}

interface ApiError {
  response?: { status?: number; data?: { code?: string } };
}

/** Mapea el 400 VALIDATION_ERROR del BE a un mensaje accionable — autoridad real por si el cliente no lo atrapó. */
function mapRatesSaveError(err: unknown): string {
  const e = err as ApiError;
  const status = e?.response?.status;
  if (status === 403) return 'No tenés permiso para editar las tarifas.';
  if (status === 400) {
    return (
      'Las tarifas ingresadas no son válidas: deben ser decimales mayores o iguales a 0 con hasta 4 decimales, ' +
      'y la moneda debe ser un código ISO-4217 de 3 letras mayúsculas.'
    );
  }
  return 'No se pudieron guardar las tarifas. Reintentá en unos segundos.';
}

/**
 * Finding 8 (fix wave) — relativo TICKEADO (antes era estático, calculado
 * solo en el render en que se montó/actualizó el balance). Bajo 60s en
 * segundos ("hace 12 s"), después en minutos; desvío a futuro (reloj
 * desincronizado) → "recién" en vez de un negativo sin sentido.
 */
function relativeTimeLabel(iso: string, nowMs: number): string {
  const diffMs = nowMs - new Date(iso).getTime();
  if (diffMs < 0) return 'actualizado recién';
  const seconds = Math.round(diffMs / 1000);
  if (seconds < 60) return `actualizado hace ${seconds} s`;
  const minutes = Math.round(diffMs / 60_000);
  if (minutes === 1) return 'actualizado hace 1 min';
  return `actualizado hace ${minutes} min`;
}

const UPDATED_AT_FMT = new Intl.DateTimeFormat('es-AR', {
  timeZone: 'America/Argentina/Buenos_Aires',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/**
 * Finding 3 (fix wave) — "Tarifas actualizadas el DD/MM/YYYY HH:mm", SIEMPRE
 * en hora de Argentina (independiente del huso del navegador/servidor).
 * `formatToParts` (no getters locales) — mismo criterio que
 * `arParts`/`formatDate.ts` (guard `no-browser-tz`); `% 24` porque
 * `hour12:false` puede emitir "24" para medianoche en algunos builds de ICU.
 */
function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const parts = UPDATED_AT_FMT.formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const hour = String(Number(get('hour')) % 24).padStart(2, '0');
  return `${get('day')}/${get('month')}/${get('year')} ${hour}:${get('minute')}`;
}

/**
 * MessagingRatesCard (twilio-credit-guard FE, D8) — card "Saldo Twilio y
 * tarifas por mensaje" en `WhatsappSettingsPage`, hermana de
 * `ExternalBulkMessagingCard` (mismo molde de estados/submit), NO una
 * extensión: son 2 configs distintas con 2 permisos que YA existen
 * (`messaging.read`/`.manage`).
 *
 * 3 bloques dentro de la misma card:
 *  1. Saldo Twilio (`GET .../rates/balance`) — estados PROPIOS; un 503 acá
 *     NUNCA rompe la edición de tarifas (D8, "sin romper la edición").
 *  2. Form de 5 tarifas (`GET/PUT .../rates`) — editable solo con
 *     `messaging.manage`; confirm al guardar porque gobiernan el guard de
 *     crédito de `send` (D9 del design BE).
 *  3. Estimador client-side — input cantidad + `Select` propio de categoría
 *     (nunca un `<select>` nativo), pura función de las tarifas YA CARGADAS
 *     + el balance, sin red nueva (`estimateSpend`, `@/utils/messagingMoney`).
 *     SIEMPRE usa las tarifas GUARDADAS, nunca el form sin guardar (fix wave
 *     finding 1) — el helper de arriba es el que refleja lo no guardado.
 */
export function MessagingRatesCard() {
  const { can } = useMyPermissions();
  const canManage = can('messaging.manage');
  const confirm = useConfirm();

  const {
    data: rates,
    isLoading: ratesLoading,
    isError: ratesError,
    refetch: refetchRates,
  } = useMessagingRatesConfig();
  const setRates = useSetMessagingRatesConfig();

  const {
    data: balance,
    isLoading: balanceLoading,
    isError: balanceError,
    refetch: refetchBalance,
  } = useMessagingCreditBalance();

  const [form, setForm] = useState<RatesForm | null>(null);
  const saveBtnRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Molde `ExternalBulkMessagingCard` — flag explícito "el usuario tocó el
  // form desde el último baseline". El ORDEN de los 2 effects de abajo es
  // load-bearing: el de reset corre ANTES del de baseline, para que, en el
  // MISMO commit donde un guardado exitoso trae `rates` nuevas Y prende
  // `isSuccess`, el baseline vea el flag ya apagado y re-siembre el form.
  const userEditedRef = useRef(false);

  const [estimatorQuantity, setEstimatorQuantity] = useState('100');
  const [estimatorCategory, setEstimatorCategory] = useState<MessagingRateCategory>('UTILITY');

  useEffect(() => {
    if (setRates.isSuccess) userEditedRef.current = false;
  }, [setRates.isSuccess]);

  useEffect(() => {
    if (!rates) return;
    if (userEditedRef.current) return;
    setForm(toForm(rates));
  }, [rates]);

  // A11y — mueve el foco a Guardar cuando el guardado falla, para que el
  // error quede en el punto de foco. Nunca roba el foco mientras el usuario
  // está tipeando dentro de la card. `focusRetryPendingRef` (molde
  // `ExternalBulkMessagingCard`) cubre el caso donde el error YA está
  // presente en el primer commit (form todavía null → skeleton, sin botón
  // montado): queda un pedido pendiente que se reintenta en cuanto `form` se
  // puebla y el botón aparece en el DOM (por eso `form` entra en las deps).
  const wasErrorRef = useRef(false);
  const focusRetryPendingRef = useRef(false);
  useEffect(() => {
    const isError = setRates.isError;
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
  }, [setRates.isError, form]);

  // Finding 8 (fix wave) — tick cada 30s para que el label relativo del
  // saldo ("hace N s/min") avance solo, sin depender de un re-render externo.
  // Fix wave 2 (minor) — SOLO corre mientras hay balance: sin balance
  // (loading/error) no hay label relativo que tickear, así que el interval
  // ni arranca. `hasBalance` (booleano) en vez del objeto `balance` en las
  // deps evita reiniciar el interval en cada refetch exitoso (mismo dato,
  // objeto nuevo) — solo transiciones presencia↔ausencia lo tocan.
  const [tickNow, setTickNow] = useState(() => Date.now());
  const hasBalance = Boolean(balance);
  useEffect(() => {
    if (!hasBalance) return;
    const id = setInterval(() => setTickNow(Date.now()), RELATIVE_TICK_MS);
    return () => clearInterval(id);
  }, [hasBalance]);

  // Finding 6 (fix wave) — el live region del estimador anuncia SOLO 400ms
  // después de la última tecla (no en cada keystroke). Usa SIEMPRE las
  // tarifas guardadas (`rates`), nunca el form sin guardar (finding 1) — este
  // effect va ANTES de cualquier return condicional (reglas de hooks), así
  // que recalcula la estimación a partir de las mismas piezas primitivas que
  // ya están disponibles arriba (rates/balance/estado del estimador).
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => {
    const trimmed = estimatorQuantity.trim();
    if (!isValidQuantity(trimmed) || !rates) {
      setAnnouncement('');
      return;
    }
    const result = estimateSpend({
      quantity: Number(trimmed),
      category: estimatorCategory,
      rates,
      balance: balance ?? null,
    });
    if (!result) {
      setAnnouncement('');
      return;
    }
    const verdict =
      result.sufficient === true ? 'alcanza' : result.sufficient === false ? 'no alcanza' : 'saldo no confirmado';
    const timer = setTimeout(() => {
      setAnnouncement(`${rates.currency} ${result.estimatedCost}, ${verdict}`);
    }, ANNOUNCE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [estimatorQuantity, estimatorCategory, rates, balance]);

  const loading = ratesLoading || (!ratesError && form === null);

  if (loading && !ratesError) {
    return (
      <section className={styles.card}>
        <p className={styles.loadingText}>Cargando…</p>
      </section>
    );
  }

  if (ratesError || !form) {
    return (
      <div className={styles.section}>
        <section className={styles.card}>
          <header>
            <h3 className={styles.cardTitle}>Saldo Twilio y tarifas por mensaje</h3>
          </header>
          <div className={`${styles.banner} ${styles.bannerError}`} role="alert">
            <span>
              <span className={styles.bannerTitle}>No se pudieron leer las tarifas de mensajería.</span> Reintentá.
            </span>
            <button type="button" className={styles.btnRetry} onClick={() => void refetchRates()}>
              Reintentar
            </button>
          </div>
        </section>
      </div>
    );
  }

  const fieldErrors = validateRatesForm(form);
  const hasClientError = Boolean(
    fieldErrors.currency ||
      fieldErrors.utilityRate ||
      fieldErrors.marketingRate ||
      fieldErrors.authenticationRate ||
      fieldErrors.providerFee,
  );
  const dirty = Boolean(
    rates &&
      (form.currency !== rates.currency ||
        form.utilityRate !== rates.utilityRate ||
        form.marketingRate !== rates.marketingRate ||
        form.authenticationRate !== rates.authenticationRate ||
        form.providerFee !== rates.providerFee),
  );

  function patchForm(p: Partial<RatesForm>) {
    if (setRates.isSuccess || setRates.isError) setRates.reset();
    userEditedRef.current = true;
    setForm((f) => (f ? { ...f, ...p } : f));
  }

  async function handleSave() {
    if (!form || !canManage || setRates.isPending || hasClientError) return;
    const ok = await confirm({
      title: 'Guardar tarifas de mensajería',
      message:
        'Estas tarifas gobiernan el bloqueo de envíos masivos: las estimaciones de costo de los envíos ' +
        'externos usan estas tarifas. ¿Confirmás?',
      confirmLabel: 'Guardar',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });
    if (!ok) return;
    setRates.mutate({
      currency: form.currency,
      utilityRate: form.utilityRate,
      marketingRate: form.marketingRate,
      authenticationRate: form.authenticationRate,
      providerFee: form.providerFee,
    });
  }

  const saveError = setRates.isError ? mapRatesSaveError(setRates.error) : null;

  // Finding 5 (fix wave) — cantidad del estimador validada (entero [1, 1_000_000]).
  const quantityTrimmed = estimatorQuantity.trim();
  const quantityValid = isValidQuantity(quantityTrimmed);
  const quantityErrorMsg = quantityValid ? null : QUANTITY_ERROR_MSG;
  const parsedQuantity = quantityValid ? Number(quantityTrimmed) : NaN;
  const estimate =
    rates && quantityValid
      ? estimateSpend({ quantity: parsedQuantity, category: estimatorCategory, rates, balance: balance ?? null })
      : null;

  // Finding 9 (fix wave) — `balance.available` SIEMPRE pasado por `formatMoney`
  // (4 decimales), nunca impreso crudo. Si no es parseable (dato del BE
  // inesperado), cae al string crudo — nunca a "0.0000" silencioso.
  const availableParsed = balance ? tryParseMoney(balance.available) : null;
  const availableDisplay = balance ? (availableParsed !== null ? formatMoney(availableParsed) : balance.available) : null;

  return (
    <div className={styles.section} ref={cardRef}>
      <section className={styles.card}>
        <header>
          <h3 className={styles.cardTitle}>Saldo Twilio y tarifas por mensaje</h3>
        </header>
        <p className={styles.description}>Gobiernan el bloqueo de crédito del envío masivo externo.</p>

        {/* ── Bloque 1 — saldo ────────────────────────────────────────────── */}
        {balanceLoading && <p className={styles.loadingText}>Cargando saldo…</p>}

        {!balanceLoading && balanceError && (
          <div className={`${styles.banner} ${styles.bannerError}`} role="alert">
            <span>
              <span className={styles.bannerTitle}>Saldo no disponible.</span> No se pudo leer el saldo de Twilio.
            </span>
            <button type="button" className={styles.btnRetry} onClick={() => void refetchBalance()}>
              Reintentar
            </button>
          </div>
        )}

        {!balanceLoading && !balanceError && balance && (
          <div className={styles.balanceBlock}>
            <span className={styles.balanceAmount}>
              Saldo Twilio:{' '}
              <strong>
                {balance.currency} {availableDisplay}
              </strong>
            </span>
            <span className={styles.balanceMeta}>{relativeTimeLabel(balance.fetchedAt, tickNow)}</span>
            {balance.cached && <span className={styles.badgeCached}>Cache</span>}
            <button type="button" className={styles.btnRetry} onClick={() => void refetchBalance()}>
              Actualizar
            </button>
          </div>
        )}

        <hr className={styles.divider} />

        {/* ── Bloque 2 — tarifas ──────────────────────────────────────────── */}
        <h4 className={styles.blockTitle}>Tarifas por categoría</h4>

        {!canManage && (
          <p className={styles.readOnlyNote}>
            Solo lectura — necesitás permiso de gestión (messaging.manage) para editar las tarifas.
          </p>
        )}

        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor={CURRENCY_ID}>
              Moneda
            </label>
            <input
              id={CURRENCY_ID}
              type="text"
              maxLength={3}
              className={`${styles.input} ${fieldErrors.currency ? styles.inputError : ''}`}
              value={form.currency}
              disabled={!canManage || setRates.isPending}
              onChange={(e) => patchForm({ currency: e.target.value.toUpperCase() })}
              aria-invalid={Boolean(fieldErrors.currency)}
              aria-describedby={describedBy(fieldErrors.currency && `${CURRENCY_ID}-error`)}
            />
            {fieldErrors.currency && (
              <span id={`${CURRENCY_ID}-error`} className={styles.fieldError} role="status">
                {fieldErrors.currency}
              </span>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor={UTILITY_ID}>
              Tarifa UTILITY
            </label>
            <input
              id={UTILITY_ID}
              type="text"
              inputMode="decimal"
              className={`${styles.input} ${fieldErrors.utilityRate ? styles.inputError : ''}`}
              value={form.utilityRate}
              disabled={!canManage || setRates.isPending}
              onChange={(e) => patchForm({ utilityRate: e.target.value })}
              aria-invalid={Boolean(fieldErrors.utilityRate)}
              aria-describedby={describedBy(fieldErrors.utilityRate && `${UTILITY_ID}-error`)}
            />
            {fieldErrors.utilityRate && (
              <span id={`${UTILITY_ID}-error`} className={styles.fieldError} role="status">
                {fieldErrors.utilityRate}
              </span>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor={MARKETING_ID}>
              Tarifa MARKETING
            </label>
            <input
              id={MARKETING_ID}
              type="text"
              inputMode="decimal"
              className={`${styles.input} ${fieldErrors.marketingRate ? styles.inputError : ''}`}
              value={form.marketingRate}
              disabled={!canManage || setRates.isPending}
              onChange={(e) => patchForm({ marketingRate: e.target.value })}
              aria-invalid={Boolean(fieldErrors.marketingRate)}
              aria-describedby={describedBy(fieldErrors.marketingRate && `${MARKETING_ID}-error`)}
            />
            {fieldErrors.marketingRate && (
              <span id={`${MARKETING_ID}-error`} className={styles.fieldError} role="status">
                {fieldErrors.marketingRate}
              </span>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor={AUTHENTICATION_ID}>
              Tarifa AUTHENTICATION
            </label>
            <input
              id={AUTHENTICATION_ID}
              type="text"
              inputMode="decimal"
              className={`${styles.input} ${fieldErrors.authenticationRate ? styles.inputError : ''}`}
              value={form.authenticationRate}
              disabled={!canManage || setRates.isPending}
              onChange={(e) => patchForm({ authenticationRate: e.target.value })}
              aria-invalid={Boolean(fieldErrors.authenticationRate)}
              aria-describedby={describedBy(fieldErrors.authenticationRate && `${AUTHENTICATION_ID}-error`)}
            />
            {fieldErrors.authenticationRate && (
              <span id={`${AUTHENTICATION_ID}-error`} className={styles.fieldError} role="status">
                {fieldErrors.authenticationRate}
              </span>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor={FEE_ID}>
              Fee de Twilio
            </label>
            <input
              id={FEE_ID}
              type="text"
              inputMode="decimal"
              className={`${styles.input} ${fieldErrors.providerFee ? styles.inputError : ''}`}
              value={form.providerFee}
              disabled={!canManage || setRates.isPending}
              onChange={(e) => patchForm({ providerFee: e.target.value })}
              aria-invalid={Boolean(fieldErrors.providerFee)}
              aria-describedby={describedBy(fieldErrors.providerFee && `${FEE_ID}-error`)}
            />
            {fieldErrors.providerFee && (
              <span id={`${FEE_ID}-error`} className={styles.fieldError} role="status">
                {fieldErrors.providerFee}
              </span>
            )}
          </div>
        </div>

        {/* Findings 1 + 7 (fix wave) — el helper refleja el form SIN GUARDAR:
            "(con lo que estás por guardar)" mientras hay cambios, "(tarifa
            vigente)" cuando el form coincide con lo cargado; "—" si la
            tarifa (o el fee) no pasan la MISMA regex que valida el campo
            (nunca computa sobre un valor que el propio form marca inválido). */}
        <div className={styles.helperLines}>
          {CATEGORIES.map((category) => {
            const field = rateFieldFor(category);
            const rateValue = form[field];
            const rateInvalid = Boolean(fieldErrors[field] || fieldErrors.providerFee);
            const unit = rateInvalid ? null : computeUnitCost(rateValue, form.providerFee);
            let text: string;
            if (rateInvalid) {
              text = '—';
            } else if (unit) {
              text = dirty
                ? `≈ ${form.currency || 'USD'} ${unit} por mensaje ${category} (con lo que estás por guardar)`
                : `≈ ${form.currency || 'USD'} ${unit} por mensaje ${category} (tarifa vigente)`;
            } else {
              text = `Completá la tarifa ${category} y el fee para ver el costo por mensaje.`;
            }
            return (
              <p key={category} className={styles.helperLine}>
                {text}
              </p>
            );
          })}
        </div>

        {/* Finding 3 (fix wave) — fecha de última actualización de las tarifas. */}
        {rates && <p className={styles.updatedAtNote}>Tarifas actualizadas el {formatUpdatedAt(rates.updatedAt)}</p>}

        {saveError && (
          <div className={`${styles.banner} ${styles.bannerError}`} role="alert">
            <span>{saveError}</span>
          </div>
        )}
        {setRates.isSuccess && (
          <div className={`${styles.banner} ${styles.bannerSuccess}`} role="status" aria-live="polite">
            <span>Tarifas guardadas.</span>
          </div>
        )}

        {canManage && (
          <div className={styles.actions}>
            <button
              ref={saveBtnRef}
              type="button"
              className={styles.btnPrimary}
              disabled={((!dirty || setRates.isSuccess) && !setRates.isError) || setRates.isPending || hasClientError}
              onClick={() => void handleSave()}
            >
              {setRates.isPending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        )}

        <hr className={styles.divider} />

        {/* ── Bloque 3 — estimador ────────────────────────────────────────── */}
        <h4 className={styles.blockTitle}>Estimador de costo</h4>
        <p className={styles.estimatorCaption}>Usa las tarifas guardadas.</p>
        {dirty && (
          <p className={styles.estimatorDirtyNote}>Hay cambios sin guardar; guardá para que el estimador los use.</p>
        )}

        <div className={styles.estimatorRow}>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor={ESTIMATOR_QTY_ID}>
              Cantidad
            </label>
            <input
              id={ESTIMATOR_QTY_ID}
              type="text"
              inputMode="numeric"
              className={`${styles.input} ${quantityErrorMsg ? styles.inputError : ''}`}
              value={estimatorQuantity}
              onChange={(e) => setEstimatorQuantity(e.target.value)}
              aria-invalid={Boolean(quantityErrorMsg)}
              aria-describedby={quantityErrorMsg ? `${ESTIMATOR_QTY_ID}-error` : undefined}
            />
          </div>

          <div className={styles.field}>
            <Select
              id={ESTIMATOR_CATEGORY_ID}
              label="Categoría"
              options={CATEGORY_OPTIONS}
              value={estimatorCategory}
              onChange={(v) => setEstimatorCategory(v as MessagingRateCategory)}
            />
          </div>

          {quantityErrorMsg ? (
            <p id={`${ESTIMATOR_QTY_ID}-error`} className={styles.estimatorResult} role="status">
              {quantityErrorMsg}
            </p>
          ) : (
            estimate && (
              <p className={styles.estimatorResult} data-testid="estimator-result">
                {parsedQuantity} mensajes {estimatorCategory} ≈ {rates?.currency} {estimate.estimatedCost}
                {'; '}
                {estimate.sufficient === true && 'el saldo alcanza.'}
                {estimate.sufficient === false && 'el saldo NO alcanza.'}
                {estimate.sufficient === null &&
                  'No se puede confirmar el saldo (moneda distinta o saldo no disponible): los envíos externos van a ser bloqueados hasta resolverlo.'}
              </p>
            )
          )}
        </div>

        {/* Finding 6 (fix wave) — live region CHICO con SOLO monto + veredicto,
            debounced (400ms tras la última tecla): el párrafo visible de
            arriba ya NO lleva role="status" (anunciaba en cada tecla). */}
        <span
          className={styles.srOnly}
          role="status"
          aria-live="polite"
          data-testid="estimator-announcer"
        >
          {announcement}
        </span>
      </section>
    </div>
  );
}
