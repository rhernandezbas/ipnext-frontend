import { useEffect, useState } from 'react';
import {
  useNocBroadcastConfig,
  useUpdateNocBroadcastConfig,
  useTestNocBroadcast,
} from '@/hooks/useNocBroadcast';
import type { NocBroadcastConfigDTO, UpdateNocBroadcastPayload } from '@/types/nocBroadcast';
import styles from './NocBroadcastCard.module.css';

/**
 * Difusión NOC (N1-FE) — tarjeta de configuración de la conexión con el
 * Evolution API (WhatsApp self-hosted en un Pi) que manda noticias/tareas de red
 * al canal "noc lider". La config vive en la DB (no en envs) y se edita desde acá.
 *
 * Vive en WhatsappSettingsPage bajo una sección gateada por `messaging.manage`.
 * El contrato BE (`/api/messaging/noc-broadcast`) NUNCA devuelve la apiKey
 * completa: solo `hasApiKey` + `apiKeyLast4`. En el PUT, `evolutionApiKey`
 * vacío/ausente PRESERVA la key guardada — por eso el input de la key arranca
 * vacío y solo se envía cuando el usuario escribe una nueva.
 *
 * Molde: GestionRealSyncBody (GET puebla el form + PUT parcial de lo cambiado),
 * con el agregado del POST /test ("Probar conexión") y el indicador `configured`.
 */

interface FormState {
  enabled: boolean;
  evolutionBaseUrl: string;
  evolutionInstance: string;
  targetChat: string;
  appPublicUrl: string;
  /** '' = intacto → NO se envía (preserva la key guardada). */
  apiKey: string;
}

function configToForm(c: NocBroadcastConfigDTO): FormState {
  return {
    enabled: c.enabled,
    evolutionBaseUrl: c.evolutionBaseUrl,
    evolutionInstance: c.evolutionInstance,
    targetChat: c.targetChat,
    appPublicUrl: c.appPublicUrl,
    apiKey: '',
  };
}

/** Diff parcial: solo los campos que cambiaron. `evolutionApiKey` solo si se escribió. */
function buildPayload(form: FormState, baseline: FormState): UpdateNocBroadcastPayload {
  const p: UpdateNocBroadcastPayload = {};
  if (form.enabled !== baseline.enabled) p.enabled = form.enabled;
  if (form.evolutionBaseUrl !== baseline.evolutionBaseUrl) p.evolutionBaseUrl = form.evolutionBaseUrl;
  if (form.evolutionInstance !== baseline.evolutionInstance) p.evolutionInstance = form.evolutionInstance;
  if (form.targetChat !== baseline.targetChat) p.targetChat = form.targetChat;
  if (form.appPublicUrl !== baseline.appPublicUrl) p.appPublicUrl = form.appPublicUrl;
  const key = form.apiKey.trim();
  if (key !== '') p.evolutionApiKey = key;
  return p;
}

/** true solo para URLs http(s) — mismo criterio que el Zod del BE. */
function isHttpUrl(value: string): boolean {
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return false;
  }
  return u.protocol === 'http:' || u.protocol === 'https:';
}

interface ApiError {
  response?: { status?: number; data?: { code?: string } };
}

function mapSaveError(err: unknown): string {
  const e = err as ApiError;
  const status = e?.response?.status;
  const code = e?.response?.data?.code;
  if (status === 400 || code === 'VALIDATION_ERROR') {
    return 'Datos inválidos. Revisá las URLs (deben ser http/https) e intentá de nuevo.';
  }
  return 'No se pudo guardar la configuración. Reintentá en unos segundos.';
}

function mapTestError(err: unknown): string {
  const e = err as ApiError;
  const status = e?.response?.status;
  const code = e?.response?.data?.code;
  if (status === 503 || code === 'NOC_BROADCAST_NOT_CONFIGURED') {
    return 'Falta configurar la difusión NOC o no está habilitada.';
  }
  if (status === 502 || code === 'EVOLUTION_API_ERROR') {
    return 'Error hablando con Evolution API — revisá URL, key e instancia, y que el Pi sea alcanzable.';
  }
  return 'No se pudo enviar el mensaje de prueba. Reintentá en unos segundos.';
}

export function NocBroadcastCard() {
  const { data: config, isLoading, isError, refetch } = useNocBroadcastConfig();
  const update = useUpdateNocBroadcastConfig();
  const test = useTestNocBroadcast();

  const [form, setForm] = useState<FormState | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);

  // Reset baseline whenever the loaded config changes (load / invalidate success).
  useEffect(() => {
    if (config) setForm(configToForm(config));
  }, [config]);

  // ── Fetch: 4 ramas (error / loading / no-form-todavía / listo) ──────────────
  if (isError && !config) {
    return (
      <section className={styles.card}>
        <div className={`${styles.banner} ${styles.bannerError}`} role="alert">
          <span>No se pudo cargar la configuración de la difusión NOC.</span>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.btnPrimary} onClick={() => refetch()}>
            Reintentar
          </button>
        </div>
      </section>
    );
  }

  if (isLoading || !config || !form) {
    return (
      <section className={styles.card}>
        <p className={styles.loading}>Cargando…</p>
      </section>
    );
  }

  const baseline = configToForm(config);
  const dirty = Object.keys(buildPayload(form, baseline)).length > 0;
  const configured = config.configured;

  function patch(p: Partial<FormState>) {
    if (urlError) setUrlError(null);
    if (update.isSuccess || update.isError) update.reset();
    setForm(f => (f ? { ...f, ...p } : f));
  }

  function handleSave() {
    if (!form || !dirty || update.isPending) return;

    const errors: string[] = [];
    const base = form.evolutionBaseUrl.trim();
    const app = form.appPublicUrl.trim();
    if (base !== '' && !isHttpUrl(base)) {
      errors.push('La URL de Evolution debe empezar con http:// o https://.');
    }
    if (app !== '' && !isHttpUrl(app)) {
      errors.push('La URL pública de la app debe empezar con http:// o https://.');
    }
    if (errors.length > 0) {
      setUrlError(errors.join(' '));
      return;
    }
    setUrlError(null);
    update.mutate(buildPayload(form, baseline));
  }

  function handleTest() {
    if (!configured || test.isPending) return;
    test.mutate();
  }

  const saveError = update.isError ? mapSaveError(update.error) : null;
  const testError = test.isError ? mapTestError(test.error) : null;

  return (
    <section className={styles.card}>
      <header className={styles.header}>
        <h3 className={styles.title}>Conexión con Evolution API</h3>
        <span
          className={`${styles.badge} ${configured ? styles.badgeReady : styles.badgeMissing}`}
        >
          <span className={styles.badgeDot} aria-hidden="true" />
          {configured ? 'Listo para usar' : 'Falta configurar'}
        </span>
      </header>

      {/* ── Aviso de alcanzabilidad de red ──────────────────────────────── */}
      <div className={`${styles.banner} ${styles.bannerInfo}`}>
        <span>
          El servidor debe poder <strong>alcanzar</strong> el Evolution del Pi por red. Si el Pi
          está en la <strong>LAN</strong>, exponelo (port-forward) o usá una <strong>VPN</strong>;
          de lo contrario la difusión y la prueba de conexión van a fallar.
        </span>
      </div>

      {/* ── Toggle habilitar ────────────────────────────────────────────── */}
      <label className={styles.toggleRow}>
        <span className={styles.toggleText}>
          <span className={styles.fieldLabel}>Difusión habilitada</span>
          <span className={styles.fieldHint}>
            Con la difusión apagada no se envían noticias ni tareas al canal, aunque esté configurada.
          </span>
        </span>
        <input
          type="checkbox"
          className={styles.toggle}
          checked={form.enabled}
          onChange={e => patch({ enabled: e.target.checked })}
          aria-label="Habilitar difusión NOC"
        />
      </label>

      {/* ── Campos ──────────────────────────────────────────────────────── */}
      <div className={styles.formGrid}>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="noc-base">
            URL de Evolution (Pi)
          </label>
          <input
            id="noc-base"
            type="url"
            inputMode="url"
            className={styles.input}
            value={form.evolutionBaseUrl}
            placeholder="http://192.168.0.10:8080"
            onChange={e => patch({ evolutionBaseUrl: e.target.value })}
          />
          <span className={styles.fieldHint}>Dónde corre el Evolution API en el Pi. http o https.</span>
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="noc-instance">
            Instancia de Evolution
          </label>
          <input
            id="noc-instance"
            type="text"
            className={styles.input}
            value={form.evolutionInstance}
            placeholder="ronald noc"
            onChange={e => patch({ evolutionInstance: e.target.value })}
          />
          <span className={styles.fieldHint}>Nombre de la instancia (sesión de WhatsApp) en Evolution.</span>
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="noc-chat">
            Canal destino (JID)
          </label>
          <input
            id="noc-chat"
            type="text"
            className={styles.input}
            value={form.targetChat}
            placeholder="1203630XXXXXXXXX@g.us"
            onChange={e => patch({ targetChat: e.target.value })}
          />
          <span className={styles.fieldHint}>
            El id/JID del canal “noc lider” en Evolution (los grupos terminan en <code>@g.us</code>).
          </span>
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="noc-app">
            URL pública de la app
          </label>
          <input
            id="noc-app"
            type="url"
            inputMode="url"
            className={styles.input}
            value={form.appPublicUrl}
            placeholder="http://190.7.234.37:7778"
            onChange={e => patch({ appPublicUrl: e.target.value })}
          />
          <span className={styles.fieldHint}>Se usa para armar los links dentro de los mensajes. http o https.</span>
        </div>

        <div className={`${styles.field} ${styles.fieldWide}`}>
          <label className={styles.fieldLabel} htmlFor="noc-apikey">
            API key de Evolution
          </label>
          <input
            id="noc-apikey"
            type="password"
            autoComplete="off"
            className={styles.input}
            value={form.apiKey}
            placeholder={config.hasApiKey ? 'Dejar vacío para conservar la actual' : 'Pegá la API key de Evolution'}
            onChange={e => patch({ apiKey: e.target.value })}
            aria-label="API key de Evolution"
          />
          <span className={styles.fieldHint}>
            {config.hasApiKey ? (
              <>
                Hay una key guardada (•••• {config.apiKeyLast4}). Dejá vacío para{' '}
                <strong>conservar la actual</strong>; escribí una nueva solo si la querés cambiar.
              </>
            ) : (
              <>No hay API key configurada todavía. Pegá la de Evolution para poder difundir.</>
            )}
          </span>
        </div>
      </div>

      {/* ── Feedback de guardado ────────────────────────────────────────── */}
      {urlError && (
        <div className={`${styles.banner} ${styles.bannerError}`} role="alert">
          <span>{urlError}</span>
        </div>
      )}
      {saveError && (
        <div className={`${styles.banner} ${styles.bannerError}`} role="alert">
          <span>{saveError}</span>
        </div>
      )}
      {update.isSuccess && !dirty && (
        <div className={`${styles.banner} ${styles.bannerSuccess}`} role="status">
          <span>Configuración guardada.</span>
        </div>
      )}

      {/* ── Feedback del test ───────────────────────────────────────────── */}
      {testError && (
        <div className={`${styles.banner} ${styles.bannerError}`} role="alert">
          <span>{testError}</span>
        </div>
      )}
      {test.isSuccess && (
        <div className={`${styles.banner} ${styles.bannerSuccess}`} role="status" aria-live="polite">
          <span>✅ Mensaje de prueba enviado al canal.</span>
        </div>
      )}

      {/* ── Acciones ────────────────────────────────────────────────────── */}
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.btnSecondary}
          disabled={!configured || test.isPending}
          onClick={handleTest}
          title={!configured ? 'Configurá y guardá la difusión antes de probar la conexión.' : undefined}
        >
          {test.isPending ? 'Probando…' : 'Probar conexión'}
        </button>
        <button
          type="button"
          className={styles.btnPrimary}
          disabled={!dirty || update.isPending}
          onClick={handleSave}
        >
          {update.isPending ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </section>
  );
}
