import { useState } from 'react';
import {
  useServiceTechnologies,
  useCreateServiceTechnology,
  useUpdateServiceTechnology,
  useDeleteServiceTechnology,
} from '@/hooks/useServiceTechnologies';
import type { ServiceTechnology } from '@/types/serviceTechnology';
import { useConfirm } from '@/context/ConfirmContext';
import styles from './ServiceTechnologiesPage.module.css';

interface ModalProps {
  initial?: ServiceTechnology;
  onClose: () => void;
  onSave: (data: { name: string; description: string | null }) => Promise<void>;
  loading: boolean;
}

function TechnologyModal({ initial, onClose, onSave, loading }: ModalProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    try {
      await onSave({ name: name.trim(), description: description.trim() || null });
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { code?: string } } };
      if (e.response?.status === 409 && e.response.data?.code === 'SERVICE_TECHNOLOGY_NAME_CONFLICT') {
        setError('Ya existe una tecnología con ese nombre.');
      } else {
        setError('No se pudo guardar la tecnología.');
      }
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(ev) => ev.stopPropagation()}>
        <h2 className={styles.modalTitle}>
          {initial ? 'Editar tecnología' : 'Nueva tecnología'}
        </h2>
        {error && <p className={styles.error}>{error}</p>}
        <label className={styles.label}>
          Nombre *
          <input
            className={styles.input}
            value={name}
            onChange={(ev) => setName(ev.target.value)}
            placeholder="Ej: Fibra óptica"
            autoFocus
          />
        </label>
        <label className={styles.label}>
          Descripción
          <textarea
            className={styles.textarea}
            value={description}
            onChange={(ev) => setDescription(ev.target.value)}
            rows={2}
            placeholder="Opcional"
          />
        </label>
        <div className={styles.modalActions}>
          <button className={styles.btnSecondary} onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button
            className={styles.btnPrimary}
            onClick={handleSave}
            disabled={!name.trim() || loading}
          >
            {loading ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Catálogo de tecnologías de servicio — toolbar + tabla + modales.
 *  Reutilizable por ServiceTechnologiesPage (standalone). */
export function ServiceTechnologiesBody() {
  const { data: technologies = [], isLoading } = useServiceTechnologies();
  const createMutation = useCreateServiceTechnology();
  const updateMutation = useUpdateServiceTechnology();
  const deleteMutation = useDeleteServiceTechnology();

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<ServiceTechnology | null>(null);
  const confirm = useConfirm();

  async function handleCreate(data: { name: string; description: string | null }) {
    await createMutation.mutateAsync(data);
  }

  async function handleEdit(data: { name: string; description: string | null }) {
    if (!editing) return;
    await updateMutation.mutateAsync({ id: editing.id, data });
    setEditing(null);
  }

  async function handleDelete(tech: ServiceTechnology) {
    const confirmed = await confirm({
      message: `¿Eliminar la tecnología "${tech.name}"?`,
      tone: 'danger',
      confirmLabel: 'Eliminar',
    });
    if (!confirmed) return;
    try {
      await deleteMutation.mutateAsync(tech.id);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { code?: string } } };
      if (e.response?.status === 409 && e.response.data?.code === 'SERVICE_TECHNOLOGY_IN_USE') {
        window.alert('No se puede eliminar: hay servicios que usan esta tecnología.');
      } else {
        window.alert('No se pudo eliminar la tecnología.');
      }
    }
  }

  return (
    <>
      <div className={styles.toolbar}>
        <button className={styles.btnPrimary} onClick={() => setShowCreate(true)}>
          + Nueva tecnología
        </button>
      </div>

      <div className={styles.card}>
        {isLoading ? (
          <p className={styles.empty}>Cargando…</p>
        ) : technologies.length === 0 ? (
          <p className={styles.empty}>No hay tecnologías. Creá la primera.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Descripción</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {technologies.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td className={styles.desc}>{t.description || '—'}</td>
                  <td className={styles.actions}>
                    <button className={styles.linkBtn} onClick={() => setEditing(t)}>
                      Editar
                    </button>
                    <button className={styles.linkDanger} onClick={() => handleDelete(t)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <TechnologyModal
          onClose={() => setShowCreate(false)}
          onSave={handleCreate}
          loading={createMutation.isPending}
        />
      )}
      {editing && (
        <TechnologyModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={handleEdit}
          loading={updateMutation.isPending}
        />
      )}
    </>
  );
}
