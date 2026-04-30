import { useState } from 'react';
import { useProjects, useCreateProject, useUpdateProject, useDeleteProject } from '@/hooks/useProjects';
import type { Project } from '@/types/project';
import styles from './SchedulingProjectsPage.module.css';

// ── Modal ──────────────────────────────────────────────────────────────────────
interface ModalProps {
  initial?: Project;
  onClose: () => void;
  onSave: (data: { title: string; description: string }) => void;
  loading: boolean;
}

function ProjectModal({ initial, onClose, onSave, loading }: ModalProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>{initial ? 'Editar proyecto' : 'Nuevo proyecto'}</h2>
        <label className={styles.label}>
          Título *
          <input
            className={styles.input}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Nombre del proyecto"
            autoFocus
          />
        </label>
        <label className={styles.label}>
          Descripción
          <textarea
            className={styles.textarea}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Descripción opcional"
            rows={3}
          />
        </label>
        <div className={styles.modalActions}>
          <button className={styles.btnSecondary} onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button
            className={styles.btnPrimary}
            onClick={() => onSave({ title, description })}
            disabled={!title.trim() || loading}
          >
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Confirm dialog ─────────────────────────────────────────────────────────────
function ConfirmDialog({ title, onConfirm, onCancel }: { title: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>¿Eliminar proyecto?</h2>
        <p className={styles.confirmText}>
          Se eliminará <strong>{title}</strong>. Esta acción no se puede deshacer.
        </p>
        <div className={styles.modalActions}>
          <button className={styles.btnSecondary} onClick={onCancel}>Cancelar</button>
          <button className={styles.btnDanger} onClick={onConfirm}>Eliminar</button>
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function SchedulingProjectsPage() {
  const { data: projects = [], isLoading } = useProjects();
  const createMutation = useCreateProject();
  const updateMutation = useUpdateProject();
  const deleteMutation = useDeleteProject();

  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);

  const filtered = projects.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    (p.description ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async (data: { title: string; description: string }) => {
    await createMutation.mutateAsync(data);
    setShowCreate(false);
  };

  const handleEdit = async (data: { title: string; description: string }) => {
    if (!editing) return;
    await updateMutation.mutateAsync({ id: editing.id, data });
    setEditing(null);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    await deleteMutation.mutateAsync(deleting.id);
    setDeleting(null);
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.breadcrumb}>Scheduling /</span>
          <h1 className={styles.title}>Proyectos</h1>
        </div>
        <div className={styles.headerRight}>
          <input
            className={styles.searchInput}
            placeholder="Buscar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button className={styles.btnPrimary} onClick={() => setShowCreate(true)}>
            + Añadir
          </button>
        </div>
      </div>

      {/* Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Título</th>
              <th>Nuevo</th>
              <th>En progreso</th>
              <th>Hecho</th>
              <th>Descripción</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className={styles.empty}>Cargando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className={styles.empty}>No hay proyectos. Creá el primero.</td></tr>
            ) : (
              filtered.map((p, i) => (
                <tr key={p.id} className={styles.row}>
                  <td className={styles.idCell}>{i + 1}</td>
                  <td className={styles.titleCell}>{p.title}</td>
                  <td className={styles.countCell} data-color="blue">
                    {p.taskCounts?.nuevo ?? 0}
                  </td>
                  <td className={styles.countCell} data-color="orange">
                    {p.taskCounts?.enProgreso ?? 0}
                  </td>
                  <td className={styles.countCell} data-color="green">
                    {p.taskCounts?.hecho ?? 0}
                  </td>
                  <td className={styles.descCell}>{p.description ?? '—'}</td>
                  <td className={styles.actionsCell}>
                    <button
                      className={styles.iconBtn}
                      title="Editar"
                      onClick={() => setEditing(p)}
                    >
                      ✏️
                    </button>
                    <button
                      className={styles.iconBtn}
                      title="Eliminar"
                      onClick={() => setDeleting(p)}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.footer}>
        {filtered.length > 0 && (
          <span className={styles.footerText}>
            Mostrando {filtered.length} de {projects.length} proyectos
          </span>
        )}
      </div>

      {/* Modals */}
      {showCreate && (
        <ProjectModal
          onClose={() => setShowCreate(false)}
          onSave={handleCreate}
          loading={createMutation.isPending}
        />
      )}
      {editing && (
        <ProjectModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={handleEdit}
          loading={updateMutation.isPending}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={deleting.title}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
