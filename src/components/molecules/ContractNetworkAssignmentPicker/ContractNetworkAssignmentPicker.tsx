import { useEffect, useState } from 'react';
import { Can } from '@/components/auth/Can';
import { Select, type SelectOption } from '@/components/molecules/Select/Select';
import { useNetworkSites } from '@/hooks/useNetworkSites';
import { useAssignableAccessPoints } from '@/hooks/useAccessPoints';
import styles from './ContractNetworkAssignmentPicker.module.css';

export interface ContractNetworkAssignmentValue {
  networkSiteId: string | null;
  accessPointId: string | null;
}

export interface ContractNetworkAssignmentPickerProps {
  /**
   * Asignación actualmente persistida en el contrato.
   *
   * `undefined` (default, NO se pasa la prop) = DESCONOCIDA — deuda de Fase B: hoy no existe
   * ningún endpoint BE (`GET /api/contracts`, `GET /api/contracts/:id` ni ningún otro) que
   * exponga `networkSiteId`/`accessPointId` de un contrato. Solo el PATCH
   * `/contracts/:id/network-assignment` devuelve el par persistido, y solo tras guardar.
   * `null` = CONFIRMADO sin asignar (para cuando el caller sí tenga el dato real).
   *
   * El componente jamás finge saber el estado: si viene `undefined` avisa explícitamente en vez
   * de mostrar "Sin asignar" con confianza (mismo criterio que PppoeAutoMoveCard ante un error de
   * fetch del flag).
   */
  currentNetworkSiteId?: string | null;
  currentAccessPointId?: string | null;
  /** Persiste la selección — el caller es dueño de la mutación PATCH (molde `GeoLocationEditor`). */
  onSave: (value: ContractNetworkAssignmentValue) => Promise<void>;
}

/** Mapea los errores tipados del BE (design §9.1) a mensajes legibles para el operador. */
function mapAssignmentError(err: unknown): string {
  const e = err as { response?: { data?: { code?: string } } };
  const code = e?.response?.data?.code;
  switch (code) {
    case 'ACCESS_POINT_NOT_IN_SITE':
      return 'El access point elegido no pertenece al nodo seleccionado.';
    case 'ACCESS_POINT_RETIRED':
      return 'Ese access point está retirado (missingSince) y no se puede asignar a mano.';
    case 'ACCESS_POINT_NOT_FOUND':
      return 'El access point elegido ya no existe en el catálogo.';
    case 'NETWORK_SITE_NOT_FOUND':
      return 'El nodo elegido ya no existe.';
    case 'CONTRACT_NOT_FOUND':
      return 'El contrato ya no existe.';
    default:
      return 'No se pudo guardar la asignación de nodo/AP. Reintentá.';
  }
}

/**
 * ContractNetworkAssignmentPicker — contract-node-ap-auto-assign (Fase B FE, picker manual).
 *
 * Asigna/cambia a mano el nodo y/o Access Point de un contrato — cubre el ~20% que la red no
 * puede resolver sola (fibra, PPPoE sin MAC matcheable, design §2). Dos `Select` propios (Nodo +
 * Access Point, el segundo acotado al nodo elegido) + "Limpiar" (desasigna ambos, par coherente
 * con el BE). Gate `contracts.assign` (design §9.4).
 */
export function ContractNetworkAssignmentPicker({
  currentNetworkSiteId,
  currentAccessPointId,
  onSave,
}: ContractNetworkAssignmentPickerProps) {
  const [siteId, setSiteId] = useState<string | null>(currentNetworkSiteId ?? null);
  const [apId, setApId] = useState<string | null>(currentAccessPointId ?? null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const { data: sites } = useNetworkSites();
  const { data: aps, isLoading: apsLoading } = useAssignableAccessPoints(siteId);

  // Sync local selection when the parent supplies a fresh persisted value
  // (e.g. after a page refetch elsewhere) — same convention as GeoLocationEditor.
  useEffect(() => {
    setSiteId(currentNetworkSiteId ?? null);
    setApId(currentAccessPointId ?? null);
  }, [currentNetworkSiteId, currentAccessPointId]);

  const currentUnknown = currentNetworkSiteId === undefined && currentAccessPointId === undefined;

  async function persist(value: ContractNetworkAssignmentValue) {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await onSave(value);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      setSaveError(mapAssignmentError(err));
    } finally {
      setSaving(false);
    }
  }

  function handleSiteChange(value: string) {
    setSiteId(value || null);
    // El AP listado se re-scopea al nuevo nodo — el elegido antes puede no
    // pertenecer más a la lista visible, así que arranca la elección de nuevo.
    setApId(null);
  }

  function handleApChange(value: string) {
    const nextApId = value || null;
    setApId(nextApId);
    if (nextApId) {
      const ap = (aps ?? []).find((a) => a.id === nextApId);
      if (ap) setSiteId(ap.networkSiteId);
    }
  }

  function handleSubmit() {
    void persist({ networkSiteId: siteId, accessPointId: apId });
  }

  function handleClear() {
    setSiteId(null);
    setApId(null);
    void persist({ networkSiteId: null, accessPointId: null });
  }

  const siteOptions: SelectOption[] = (sites ?? []).map((s) => ({ value: s.id, label: s.name }));
  const apOptions: SelectOption[] = (aps ?? []).map((a) => ({ value: a.id, label: a.name }));

  return (
    <section className={styles.section} aria-labelledby="network-assignment-heading">
      <h2 id="network-assignment-heading" className={styles.sectionTitle}>
        Nodo / Access Point
      </h2>

      {currentUnknown && (
        <p className={styles.unknownHint}>
          Estado actual no disponible: el backend todavía no expone una lectura de la asignación de
          red persistida de este contrato. Podés asignar o cambiar el nodo/AP desde acá — lo que
          veas en los selectores es tu selección, no necesariamente lo que ya esté guardado.
        </p>
      )}

      <Can
        permission="contracts.assign"
        fallback={<p className={styles.noPermissionHint}>No tenés permiso para asignar nodo/AP.</p>}
      >
        <div className={styles.row}>
          <Select
            label="Nodo"
            value={siteId ?? ''}
            onChange={handleSiteChange}
            options={siteOptions}
            placeholder="Elegí un nodo…"
            disabled={saving}
          />
          <Select
            label="Access Point"
            value={apId ?? ''}
            onChange={handleApChange}
            options={apOptions}
            placeholder={apsLoading ? 'Cargando…' : 'Elegí un AP…'}
            disabled={saving || apsLoading}
          />
        </div>

        {saveError && (
          <p className={styles.error} role="alert">
            {saveError}
          </p>
        )}
        {saveSuccess && (
          <p className={styles.success} role="status">
            Asignación guardada.
          </p>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={handleSubmit}
            disabled={saving}
            aria-busy={saving}
            data-testid="network-assignment-save-button"
          >
            {saving ? 'Guardando…' : 'Guardar asignación'}
          </button>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={handleClear}
            disabled={saving}
            data-testid="network-assignment-clear-button"
          >
            Limpiar
          </button>
        </div>
      </Can>
    </section>
  );
}
