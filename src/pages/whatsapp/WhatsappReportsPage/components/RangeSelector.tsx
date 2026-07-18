import { useState } from 'react';
import { presetRange, customRange, type RangePreset } from '../lib/range';
import type { ReportsDateRange } from '@/types/messagingReports';
import styles from './RangeSelector.module.css';

interface RangeSelectorProps {
  /** Preset inicial que semilla el modo del selector (default 7d). */
  preset: RangePreset;
  /** Emite (preset, rango UTC) al elegir un preset o completar un rango custom válido. */
  onChange: (preset: RangePreset, range: ReportsDateRange) => void;
}

/**
 * RangeSelector — presets "Últimos 7/30 días" + modo Personalizado (2 date
 * inputs). El componente es dueño de su MODO (qué botón está activo / si muestra
 * los inputs); el rango calculado (medianoche AR → UTC) se emite al padre, que
 * mantiene el estado de los fetches. El custom solo emite cuando ambas fechas
 * están completas y `desde <= hasta` (no dispara rangos inválidos).
 */
export function RangeSelector({ preset, onChange }: RangeSelectorProps) {
  const [mode, setMode] = useState<RangePreset>(preset);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  function choosePreset(p: '7d' | '30d') {
    setMode(p);
    onChange(p, presetRange(p));
  }

  function chooseCustom() {
    setMode('custom');
    // No emite hasta tener un rango válido — evita un fetch con from/to vacíos.
  }

  function emitCustom(nextFrom: string, nextTo: string) {
    if (nextFrom && nextTo && nextFrom <= nextTo) {
      onChange('custom', customRange(nextFrom, nextTo));
    }
  }

  return (
    <div className={styles.selector} role="group" aria-label="Rango de fechas">
      <button
        type="button"
        className={styles.preset}
        aria-pressed={mode === '7d'}
        onClick={() => choosePreset('7d')}
      >
        Últimos 7 días
      </button>
      <button
        type="button"
        className={styles.preset}
        aria-pressed={mode === '30d'}
        onClick={() => choosePreset('30d')}
      >
        Últimos 30 días
      </button>
      <button
        type="button"
        className={styles.preset}
        aria-pressed={mode === 'custom'}
        onClick={chooseCustom}
      >
        Personalizado
      </button>

      {mode === 'custom' && (
        <div className={styles.custom}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Desde</span>
            <input
              type="date"
              className={styles.date}
              value={from}
              max={to || undefined}
              onChange={(e) => {
                setFrom(e.target.value);
                emitCustom(e.target.value, to);
              }}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Hasta</span>
            <input
              type="date"
              className={styles.date}
              value={to}
              min={from || undefined}
              onChange={(e) => {
                setTo(e.target.value);
                emitCustom(from, e.target.value);
              }}
            />
          </label>
        </div>
      )}
    </div>
  );
}
