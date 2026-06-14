import { useState, useEffect, useRef } from 'react';
import { useAssignIClassTeam } from '@/hooks/useIClassOsActions';
import { useIClassTeams } from '@/hooks/useIClassTeams';
import { useFeatureFlag } from '@/hooks/useFeatureFlags';
import { useCan } from '@/hooks/useMyPermissions';
import styles from './IClassTeamSelector.module.css';

const FLAG_KEY = 'iclass-assign-action';

interface IClassTeamSelectorProps {
  taskId: string;
  /** Optional callback after successful assignment */
  onAssigned?: () => void;
}

/**
 * Inline selector para asignar una cuadrilla a la OS en IClass.
 *
 * Gate doble:
 * - Permiso `scheduling.iclass_assign`
 * - Feature flag `iclass-assign-action`
 *
 * Solo muestra cuadrillas con `active && selectable === true`.
 * El selector queda inline en el header/sidebar de la tarea.
 */
export function IClassTeamSelector({ taskId, onAssigned }: IClassTeamSelectorProps) {
  const canAssign = useCan('scheduling.iclass_assign');
  const { data: flag } = useFeatureFlag(FLAG_KEY);
  const flagEnabled = flag?.enabled ?? false;

  const { data: teams = [] } = useIClassTeams();
  const assign = useAssignIClassTeam();

  const [teamLogin, setTeamLogin] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  // FIX 5: keep the timer ref so we can clear it on unmount and avoid
  // "state update on unmounted component" if the user navigates within 3s.
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (successTimerRef.current !== null) clearTimeout(successTimerRef.current);
    };
  }, []);

  // Double gate: permission AND flag
  if (!canAssign || !flagEnabled) return null;

  const selectableTeams = teams.filter(t => t.active && t.selectable);

  const handleAssign = async () => {
    if (!teamLogin) return;
    await assign.mutateAsync({ taskId, teamLogin });
    setTeamLogin('');
    setShowSuccess(true);
    // FIX 5: clear previous timer before setting a new one
    if (successTimerRef.current !== null) clearTimeout(successTimerRef.current);
    successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);
    onAssigned?.();
  };

  const errorReason = assign.isError
    ? ((assign.error as { response?: { data?: { reason?: string } } })?.response?.data?.reason ?? 'Error al asignar cuadrilla')
    : null;

  return (
    <div className={styles.wrapper}>
      <label className={styles.label} htmlFor={`iclass-team-${taskId}`}>
        Cuadrilla IClass
      </label>
      <select
        id={`iclass-team-${taskId}`}
        className={styles.select}
        value={teamLogin}
        onChange={e => {
          setTeamLogin(e.target.value);
          setShowSuccess(false);
          assign.reset();
        }}
        disabled={assign.isPending}
        aria-label="Cuadrilla"
      >
        <option value="">Seleccionar cuadrilla…</option>
        {selectableTeams.map(t => (
          <option key={t.login} value={t.login}>
            {t.name} ({t.login})
          </option>
        ))}
      </select>
      <button
        className={styles.btn}
        onClick={() => void handleAssign()}
        disabled={assign.isPending || !teamLogin}
        aria-label="Asignar cuadrilla"
      >
        {assign.isPending ? 'Asignando…' : 'Asignar'}
      </button>
      {showSuccess && (
        <span className={styles.successMsg} role="status">Cuadrilla asignada</span>
      )}
      {errorReason && (
        <span className={styles.errorMsg} role="alert">{errorReason}</span>
      )}
    </div>
  );
}
