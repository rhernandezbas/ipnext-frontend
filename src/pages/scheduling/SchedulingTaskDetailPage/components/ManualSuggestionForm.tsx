import { useState } from 'react';
import { useDeviceTypes } from '@/hooks/useDeviceTypes';
import { useCreateManualSuggestion } from '@/hooks/useServiceInventory';
import type { CreateManualSuggestionInput } from '@/types/serviceInventory';
import styles from './ManualSuggestionForm.module.css';

interface Props {
  taskId: string;
  onClose: () => void;
}

/**
 * Inline collapsible form to create a MANUAL inventory suggestion on a task.
 * Mirrors the #18 `incompleteHint` pattern from SuggestionCard.
 * Not a modal — renders inline inside TaskInventorySuggestions.
 */
export function ManualSuggestionForm({ taskId, onClose }: Props) {
  const { data: deviceTypes = [], isLoading: typesLoading } = useDeviceTypes();
  const activeTypes = deviceTypes.filter(dt => dt.active).sort((a, b) => a.sortOrder - b.sortOrder);

  const [kind, setKind] = useState<'DEVICE' | 'MATERIAL'>('DEVICE');
  const [deviceType, setDeviceType] = useState<string>('');
  const [serialNumber, setSerialNumber] = useState('');
  const [mac, setMac] = useState('');
  const [materialDesc, setMaterialDesc] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [showHint, setShowHint] = useState(false);

  const createMutation = useCreateManualSuggestion(taskId);

  // Mirror #18 incomplete logic from SuggestionCard lines 98-100
  const incomplete =
    kind === 'DEVICE'
      ? !serialNumber.trim() && !mac.trim()
      : !materialDesc.trim();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (incomplete) {
      setShowHint(true);
      return;
    }
    setShowHint(false);

    const input: CreateManualSuggestionInput = {
      kind,
      ...(kind === 'DEVICE'
        ? {
            type: deviceType || undefined,
            serialNumber: serialNumber.trim() || null,
            mac: mac.trim() || null,
          }
        : {
            materialDesc: materialDesc.trim(),
            quantity: quantity ? parseFloat(quantity) : null,
            unit: unit.trim() || null,
          }),
    };

    createMutation.mutate(input, {
      onSuccess: () => {
        // Reset and collapse
        setKind('DEVICE');
        setDeviceType('');
        setSerialNumber('');
        setMac('');
        setMaterialDesc('');
        setQuantity('');
        setUnit('');
        setShowHint(false);
        onClose();
      },
    });
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.kindRow}>
        <label className={styles.radioLabel}>
          <input
            type="radio"
            name="kind"
            value="DEVICE"
            checked={kind === 'DEVICE'}
            onChange={() => setKind('DEVICE')}
          />
          Equipo
        </label>
        <label className={styles.radioLabel}>
          <input
            type="radio"
            name="kind"
            value="MATERIAL"
            checked={kind === 'MATERIAL'}
            onChange={() => setKind('MATERIAL')}
          />
          Material
        </label>
      </div>

      {kind === 'DEVICE' ? (
        <div className={styles.fields}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Tipo</span>
            <select
              className={styles.input}
              aria-label="tipo de equipo"
              value={deviceType}
              onChange={e => setDeviceType(e.target.value)}
              disabled={typesLoading}
            >
              <option value="">— seleccionar —</option>
              {activeTypes.map(dt => (
                <option key={dt.id} value={dt.name}>{dt.name}</option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Número de serie</span>
            <input
              type="text"
              className={styles.input}
              aria-label="Número de serie"
              value={serialNumber}
              onChange={e => setSerialNumber(e.target.value)}
              placeholder="SN-001"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>MAC</span>
            <input
              type="text"
              className={styles.input}
              aria-label="MAC"
              value={mac}
              onChange={e => setMac(e.target.value)}
              placeholder="AA:BB:CC:DD:EE:FF"
            />
          </label>
        </div>
      ) : (
        <div className={styles.fields}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Descripción</span>
            <input
              type="text"
              className={styles.input}
              aria-label="Descripción"
              value={materialDesc}
              onChange={e => setMaterialDesc(e.target.value)}
              placeholder="Cable coaxial 10m"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Cantidad</span>
            <input
              type="number"
              className={styles.input}
              aria-label="Cantidad"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              min="0"
              step="any"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Unidad</span>
            <input
              type="text"
              className={styles.input}
              aria-label="Unidad"
              value={unit}
              onChange={e => setUnit(e.target.value)}
              placeholder="m, u, kg…"
            />
          </label>
        </div>
      )}

      {showHint && (
        <span className={styles.incompleteHint}>
          {kind === 'DEVICE' ? 'Falta SN o MAC para confirmar' : 'Falta una descripción'}
        </span>
      )}

      <div className={styles.actions}>
        <button
          type="submit"
          className={styles.submitBtn}
          disabled={createMutation.isPending}
        >
          Agregar
        </button>
        <button
          type="button"
          className={styles.cancelBtn}
          onClick={onClose}
          disabled={createMutation.isPending}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
