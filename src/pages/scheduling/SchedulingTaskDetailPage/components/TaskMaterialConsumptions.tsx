import { useState } from 'react';
import { useTaskMaterials, useRecordTaskMaterial, useDeleteTaskMaterial } from '@/hooks/useTaskMaterials';
import { useMaterialTypes } from '@/hooks/useMaterialTypes';
import { Can } from '@/components/auth/Can';
import styles from './TaskMaterialConsumptions.module.css';

interface Props {
  taskId: string;
}

/**
 * Lista de materiales consumidos en la tarea + formulario para registrar nuevos.
 * Gated: ver con inventory.write (listar), registrar/quitar con inventory.write.
 */
export function TaskMaterialConsumptions({ taskId }: Props) {
  const { data: consumptions = [], isLoading } = useTaskMaterials(taskId);
  const { data: materialTypes = [] } = useMaterialTypes();
  const recordMutation = useRecordTaskMaterial(taskId);
  const deleteMutation = useDeleteTaskMaterial(taskId);

  const [showForm, setShowForm] = useState(false);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');

  const activeMaterials = materialTypes.filter(m => m.active).sort((a, b) => a.sortOrder - b.sortOrder);

  // Sync default selection when materials load
  const defaultMaterialId = activeMaterials[0]?.id ?? '';
  const effectiveSelected = selectedMaterialId || defaultMaterialId;

  async function handleRecord(e: React.FormEvent) {
    e.preventDefault();
    if (!effectiveSelected || !quantity) return;
    await recordMutation.mutateAsync({
      materialCatalogId: effectiveSelected,
      quantity: Number(quantity),
      notes: notes.trim() || undefined,
    });
    setQuantity('');
    setNotes('');
    setShowForm(false);
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.title}>Materiales consumidos</span>
        <Can permission="inventory.write">
          <button
            type="button"
            className={styles.addBtn}
            onClick={() => setShowForm(s => !s)}
          >
            {showForm ? 'Cancelar' : '+ Agregar consumo'}
          </button>
        </Can>
      </div>

      {showForm && (
        <Can permission="inventory.write">
          <form onSubmit={handleRecord} className={styles.form}>
            <select
              value={effectiveSelected}
              onChange={e => setSelectedMaterialId(e.target.value)}
              className={styles.select}
              required
            >
              {activeMaterials.map(m => (
                <option key={m.id} value={m.id}>{m.name}{m.unit ? ` (${m.unit})` : ''}</option>
              ))}
            </select>
            <input
              type="number"
              min="0.01"
              step="any"
              placeholder="Cantidad"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              className={styles.input}
              required
            />
            <input
              type="text"
              placeholder="Notas (opcional)"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className={styles.input}
            />
            <button type="submit" className={styles.primaryBtn} disabled={!quantity || recordMutation.isPending}>
              {recordMutation.isPending ? 'Guardando…' : 'Registrar'}
            </button>
          </form>
        </Can>
      )}

      {isLoading ? (
        <p className={styles.muted}>Cargando consumos…</p>
      ) : consumptions.length === 0 ? (
        <p className={styles.muted}>Sin consumos registrados en esta tarea.</p>
      ) : (
        <ul className={styles.list}>
          {consumptions.map(c => (
            <li key={c.id} className={styles.item}>
              <div className={styles.itemInfo}>
                <span className={styles.materialName}>{c.materialName}</span>
                <span className={styles.qty}>× {c.quantity}{c.unit ? ` ${c.unit}` : ''}</span>
                {c.notes && <span className={styles.notes}>{c.notes}</span>}
                {c.recordedByUserName && (
                  <span className={styles.meta}>por {c.recordedByUserName}</span>
                )}
              </div>
              <Can permission="inventory.write">
                <button
                  type="button"
                  className={styles.removeBtn}
                  aria-label="quitar consumo"
                  onClick={() => deleteMutation.mutateAsync(c.id)}
                  disabled={deleteMutation.isPending}
                >
                  Quitar
                </button>
              </Can>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
