import { useEffect, useState } from 'react';
import { useTicketSlaConfig, useUpdateTicketSlaConfig } from '@/hooks/useTicketSlaConfig';
import { Can } from '@/components/auth/Can';
import { slaTimerColor } from '@/utils/slaTimer';
import styles from './TicketSlaBody.module.css';

/**
 * #79 — "SLA / Timer" settings. Two thresholds drive the color of the Timer
 * column in the tickets list: green below `warnMinutes`, amber up to
 * `dangerMinutes`, red beyond. Gated by `tickets.manage` (read-only otherwise).
 *
 * Validation is two-layered: a client-side guard (danger > warn) blocks the
 * obvious mistake before the request, and the BE returns 422
 * TICKET_SLA_THRESHOLD_ORDER as the authoritative backstop, surfaced here.
 */
export function TicketSlaBody() {
  const { data: config, isLoading } = useTicketSlaConfig();
  const updateMutation = useUpdateTicketSlaConfig();

  const [warn, setWarn] = useState('');
  const [danger, setDanger] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Hydrate the inputs once the config loads (and on any external refetch).
  useEffect(() => {
    if (config) {
      setWarn(String(config.warnMinutes));
      setDanger(String(config.dangerMinutes));
    }
  }, [config]);

  async function handleSave() {
    setError(null);
    setSaved(false);
    const w = Number(warn);
    const d = Number(danger);
    if (!Number.isInteger(w) || !Number.isInteger(d) || w < 1 || d < 1) {
      setError('Los umbrales deben ser minutos enteros positivos.');
      return;
    }
    if (d <= w) {
      setError('El umbral rojo (peligro) debe ser mayor que el amarillo (alerta).');
      return;
    }
    try {
      await updateMutation.mutateAsync({ warnMinutes: w, dangerMinutes: d });
      setSaved(true);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { code?: string } } };
      if (e.response?.status === 422 && e.response.data?.code === 'TICKET_SLA_THRESHOLD_ORDER') {
        setError('El umbral rojo debe ser mayor que el amarillo.');
      } else {
        setError('No se pudo guardar la configuración del timer.');
      }
    }
  }

  if (isLoading) return <p className={styles.empty}>Cargando…</p>;

  return (
    <div className={styles.card}>
      <p className={styles.intro}>
        El Timer de cada ticket muestra los minutos transcurridos desde su creación.
        Estos umbrales definen cuándo el color escala de verde a amarillo y de
        amarillo a rojo. Un ticket cerrado congela su timer en gris.
      </p>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.fields}>
        <label className={styles.field}>
          Umbral de alerta (amarillo)
          <span className={styles.hint}>Minutos a partir de los cuales el timer pasa a amarillo.</span>
          <input
            className={styles.input}
            type="number"
            min={1}
            step={1}
            value={warn}
            onChange={e => setWarn(e.target.value)}
            aria-label="Umbral de alerta en minutos"
          />
        </label>

        <label className={styles.field}>
          Umbral de peligro (rojo)
          <span className={styles.hint}>Minutos a partir de los cuales el timer pasa a rojo. Debe ser mayor que el de alerta.</span>
          <input
            className={styles.input}
            type="number"
            min={1}
            step={1}
            value={danger}
            onChange={e => setDanger(e.target.value)}
            aria-label="Umbral de peligro en minutos"
          />
        </label>

        <p className={styles.legend}>
          <span className={styles.swatch} style={{ background: slaTimerColor('ok') }} /> Verde
          <span className={styles.swatch} style={{ background: slaTimerColor('warn') }} /> Amarillo
          <span className={styles.swatch} style={{ background: slaTimerColor('danger') }} /> Rojo
        </p>
      </div>

      <div className={styles.actions}>
        <Can permission="tickets.manage">
          <button
            className={styles.btnPrimary}
            onClick={handleSave}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </Can>
        {saved && <span className={styles.saved}>Guardado ✓</span>}
      </div>
    </div>
  );
}
