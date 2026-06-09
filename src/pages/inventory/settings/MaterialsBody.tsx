import { useState } from 'react';
import {
  useMaterialTypes,
  useCreateMaterialType,
  useUpdateMaterialType,
  useDeleteMaterialType,
} from '@/hooks/useMaterialTypes';
import type { MaterialType } from '@/types/materialType';
import { Can } from '@/components/auth/Can';
import { useConfirm } from '@/context/ConfirmContext';
import styles from './MaterialsBody.module.css';

interface ModalProps {
  initial?: MaterialType;
  nextSortOrder: number;
  onClose: () => void;
  onSave: (data: { name: string; label: string | null; unit: string | null; active: boolean; sortOrder: number; minStock: number }) => Promise<void>;
  loading: boolean;
}

function MaterialModal({ initial, nextSortOrder, onClose, onSave, loading }: ModalProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [label, setLabel] = useState(initial?.label ?? '');
  const [unit, setUnit] = useState(initial?.unit ?? '');
  const [active, setActive] = useState(initial?.active ?? true);
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? nextSortOrder);
  const [minStock, setMinStock] = useState(initial?.minStock ?? 0);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        label: label.trim() || null,
        unit: unit.trim() || null,
        active,
        sortOrder: Number(sortOrder),
        minStock: Number(minStock),
      });
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { code?: string } } };
      if (e.response?.status === 409 && e.response.data?.code === 'MATERIAL_NAME_CONFLICT') {
        setError('Ya existe un material con ese nombre.');
      } else {
        setError('No se pudo guardar el material.');
      }
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>
          {initial ? 'Editar material' : 'Nuevo material'}
        </h2>
        {error && <p className={styles.error}>{error}</p>}
        <label className={styles.label}>
          Nombre *
          <input
            className={styles.input}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ej: CABLE"
            autoFocus
          />
        </label>
        <label className={styles.label}>
          Etiqueta
          <input
            className={styles.input}
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Ej: Cable coaxial"
          />
        </label>
        <label className={styles.label}>
          Unidad
          <input
            className={styles.input}
            value={unit}
            onChange={e => setUnit(e.target.value)}
            placeholder="Ej: m, u, kg"
          />
        </label>
        <label className={styles.label}>
          Orden
          <input
            className={styles.input}
            type="number"
            value={sortOrder}
            onChange={e => setSortOrder(Number(e.target.value))}
          />
        </label>
        <Can permission="inventory.manage">
          <label className={styles.label}>
            Stock mínimo
            <input
              className={styles.input}
              type="number"
              min={0}
              value={minStock}
              onChange={e => setMinStock(Number(e.target.value))}
            />
          </label>
        </Can>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={active}
            onChange={e => setActive(e.target.checked)}
          />
          <span>Activo</span>
        </label>
        <div className={styles.modalActions}>
          <button className={styles.btnSecondary} onClick={onClose} disabled={loading}>Cancelar</button>
          <button className={styles.btnPrimary} onClick={handleSave} disabled={!name.trim() || loading}>
            {loading ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Tipos de materiales — toolbar + tabla + modales, sin header de página. */
export function MaterialsBody() {
  const { data: materialTypes = [], isLoading } = useMaterialTypes();
  const createMutation = useCreateMaterialType();
  const updateMutation = useUpdateMaterialType();
  const deleteMutation = useDeleteMaterialType();

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<MaterialType | null>(null);
  const confirm = useConfirm();

  const nextSortOrder = materialTypes.reduce((max, mt) => Math.max(max, mt.sortOrder), 0) + 1;

  async function handleCreate(data: { name: string; label: string | null; unit: string | null; active: boolean; sortOrder: number; minStock: number }) {
    await createMutation.mutateAsync(data);
  }

  async function handleEdit(data: { name: string; label: string | null; unit: string | null; active: boolean; sortOrder: number; minStock: number }) {
    if (!editing) return;
    await updateMutation.mutateAsync({ id: editing.id, data });
    setEditing(null);
  }

  async function handleDelete(mt: MaterialType) {
    if (!(await confirm({ message: `¿Eliminar el material "${mt.name}"?`, tone: 'danger', confirmLabel: 'Eliminar' }))) return;
    try {
      await deleteMutation.mutateAsync(mt.id);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { code?: string } } };
      if (e.response?.status === 409 && e.response.data?.code === 'MATERIAL_IN_USE') {
        window.alert('No se puede eliminar: hay consumos que usan este material.');
      } else if (e.response?.status === 409 && e.response.data?.code === 'MATERIAL_PROTECTED') {
        window.alert('Este material no se puede eliminar.');
      } else {
        window.alert('No se pudo eliminar el material.');
      }
    }
  }

  return (
    <>
      <div className={styles.toolbar}>
        <Can permission="inventory.manage">
          <button className={styles.btnPrimary} onClick={() => setShowCreate(true)}>+ Nuevo material</button>
        </Can>
      </div>

      <div className={styles.card}>
        {isLoading ? (
          <p className={styles.empty}>Cargando…</p>
        ) : materialTypes.length === 0 ? (
          <p className={styles.empty}>No hay materiales. Creá el primero.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Etiqueta</th>
                <th>Unidad</th>
                <th>Activo</th>
                <th>Orden</th>
                <th>Stock mín.</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {materialTypes.map(mt => (
                <tr key={mt.id}>
                  <td>{mt.name}</td>
                  <td className={styles.desc}>{mt.label ?? '—'}</td>
                  <td className={styles.desc}>{mt.unit ?? '—'}</td>
                  <td>{mt.active ? 'Sí' : 'No'}</td>
                  <td className={styles.desc}>{mt.sortOrder}</td>
                  <td className={styles.desc}>{mt.minStock}</td>
                  <td className={styles.actions}>
                    <Can permission="inventory.manage">
                      <button className={styles.linkBtn} onClick={() => setEditing(mt)}>Editar</button>
                      <button className={styles.linkDanger} onClick={() => handleDelete(mt)}>Eliminar</button>
                    </Can>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <MaterialModal
          nextSortOrder={nextSortOrder}
          onClose={() => setShowCreate(false)}
          onSave={handleCreate}
          loading={createMutation.isPending}
        />
      )}
      {editing && (
        <MaterialModal
          initial={editing}
          nextSortOrder={nextSortOrder}
          onClose={() => setEditing(null)}
          onSave={handleEdit}
          loading={updateMutation.isPending}
        />
      )}
    </>
  );
}
