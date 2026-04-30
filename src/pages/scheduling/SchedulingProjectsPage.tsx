import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects, useCreateProject, useUpdateProject, useDeleteProject } from '@/hooks/useProjects';
import type { Project } from '@/types/project';
import styles from './SchedulingProjectsPage.module.css';

// ── SVG Icons ──────────────────────────────────────────────────────────────────
function IconPencil() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}

function IconExternalLink() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function IconRefresh() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function IconFilter() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function SortIcon({ col, sortCol, sortDir }: { col: string; sortCol: string; sortDir: 'asc' | 'desc' }) {
  if (col !== sortCol) return <span className={styles.sortNeutral}>⇅</span>;
  return <span className={styles.sortActive}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
}

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
          <input className={styles.input} value={title} onChange={e => setTitle(e.target.value)} placeholder="Nombre del proyecto" autoFocus />
        </label>
        <label className={styles.label}>
          Descripción
          <textarea className={styles.textarea} value={description} onChange={e => setDescription(e.target.value)} placeholder="Descripción opcional" rows={3} />
        </label>
        <div className={styles.modalActions}>
          <button className={styles.btnSecondary} onClick={onClose} disabled={loading}>Cancelar</button>
          <button className={styles.btnPrimary} onClick={() => onSave({ title, description })} disabled={!title.trim() || loading}>
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDialog({ title, onConfirm, onCancel }: { title: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>¿Eliminar proyecto?</h2>
        <p className={styles.confirmText}>Se eliminará <strong>{title}</strong>. Esta acción no se puede deshacer.</p>
        <div className={styles.modalActions}>
          <button className={styles.btnSecondary} onClick={onCancel}>Cancelar</button>
          <button className={styles.btnDanger} onClick={onConfirm}>Eliminar</button>
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
type SortCol = 'id' | 'title' | 'nuevo' | 'enProgreso' | 'hecho' | 'description';

export default function SchedulingProjectsPage() {
  const navigate = useNavigate();
  const { data: projects = [], isLoading, refetch } = useProjects();
  const createMutation = useCreateProject();
  const updateMutation = useUpdateProject();
  const deleteMutation = useDeleteProject();

  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [sortCol, setSortCol] = useState<SortCol>('id');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  function handleSort(col: SortCol) {
    if (col === sortCol) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
    setPage(1);
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return projects.filter(p =>
      p.title.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q)
    );
  }, [projects, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va: string | number;
      let vb: string | number;
      if (sortCol === 'nuevo') { va = a.taskCounts?.nuevo ?? 0; vb = b.taskCounts?.nuevo ?? 0; }
      else if (sortCol === 'enProgreso') { va = a.taskCounts?.enProgreso ?? 0; vb = b.taskCounts?.enProgreso ?? 0; }
      else if (sortCol === 'hecho') { va = a.taskCounts?.hecho ?? 0; vb = b.taskCounts?.hecho ?? 0; }
      else if (sortCol === 'description') { va = a.description ?? ''; vb = b.description ?? ''; }
      else if (sortCol === 'title') { va = a.title; vb = b.title; }
      else { va = a.createdAt; vb = b.createdAt; }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortCol, sortDir]);

  const totalPages = Math.ceil(sorted.length / pageSize) || 1;
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize);

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
          <button className={styles.btnIcon} title="Recargar" onClick={() => void refetch()}>
            <IconRefresh />
          </button>
          <button className={styles.btnPrimary} onClick={() => setShowCreate(true)}>
            Añadir
          </button>
          <button
            className={`${styles.btnSecondary} ${showFilters ? styles.btnSecondaryActive : ''}`}
            onClick={() => setShowFilters(v => !v)}
          >
            <IconFilter /> Filtrar
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className={styles.body}>
        <div className={styles.tableSection}>
          {/* Table controls */}
          <div className={styles.tableControls}>
            <div className={styles.pageSizeControl}>
              <span>Mostrar</span>
              <select className={styles.pageSizeSelect} value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>registros</span>
            </div>
            <div className={styles.searchControl}>
              <span className={styles.searchIcon}><IconSearch /></span>
              <input
                className={styles.searchInput}
                placeholder="Buscar..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
          </div>

          {/* Table */}
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.thSortable} onClick={() => handleSort('id')}>
                    ID <SortIcon col="id" sortCol={sortCol} sortDir={sortDir} />
                  </th>
                  <th className={styles.thSortable} onClick={() => handleSort('title')}>
                    Título <SortIcon col="title" sortCol={sortCol} sortDir={sortDir} />
                  </th>
                  <th className={styles.thSortable} onClick={() => handleSort('nuevo')}>
                    Nuevo <SortIcon col="nuevo" sortCol={sortCol} sortDir={sortDir} />
                  </th>
                  <th className={styles.thSortable} onClick={() => handleSort('enProgreso')}>
                    En progreso <SortIcon col="enProgreso" sortCol={sortCol} sortDir={sortDir} />
                  </th>
                  <th className={styles.thSortable} onClick={() => handleSort('hecho')}>
                    Hecho <SortIcon col="hecho" sortCol={sortCol} sortDir={sortDir} />
                  </th>
                  <th className={styles.thSortable} onClick={() => handleSort('description')}>
                    Descripción <SortIcon col="description" sortCol={sortCol} sortDir={sortDir} />
                  </th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={7} className={styles.empty}>Cargando...</td></tr>
                ) : paginated.length === 0 ? (
                  <tr><td colSpan={7} className={styles.empty}>No hay proyectos.</td></tr>
                ) : (
                  paginated.map((p, i) => (
                    <tr key={p.id} className={styles.row}>
                      <td className={styles.idCell}>{(page - 1) * pageSize + i + 1}</td>
                      <td className={styles.titleCell}>
                        <button
                          className={styles.titleLink}
                          onClick={() => navigate(`/admin/scheduling?projectId=${p.id}`)}
                        >
                          {p.title}
                        </button>
                      </td>
                      <td className={styles.countCell} data-color="blue">{p.taskCounts?.nuevo ?? 0}</td>
                      <td className={styles.countCell} data-color="gray">{p.taskCounts?.enProgreso ?? 0}</td>
                      <td className={styles.countCell} data-color="blue">{p.taskCounts?.hecho ?? 0}</td>
                      <td className={styles.descCell}>{p.description ?? '—'}</td>
                      <td className={styles.actionsCell}>
                        <button className={styles.actionBtn} title="Editar" onClick={() => setEditing(p)}>
                          <IconPencil />
                        </button>
                        <button
                          className={styles.actionBtn}
                          title="Ver tareas"
                          onClick={() => navigate(`/admin/scheduling?projectId=${p.id}`)}
                        >
                          <IconExternalLink />
                        </button>
                        <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} title="Eliminar" onClick={() => setDeleting(p)}>
                          <IconTrash />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className={styles.pagination}>
            <span className={styles.paginationInfo}>
              {filtered.length > 0
                ? `Mostrando registros del ${(page - 1) * pageSize + 1} al ${Math.min(page * pageSize, filtered.length)} de un total de ${filtered.length} registros`
                : 'Sin registros'}
            </span>
            <div className={styles.paginationBtns}>
              <button className={styles.pageBtn} onClick={() => setPage(1)} disabled={page === 1}>|‹</button>
              <button className={styles.pageBtn} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
              <span className={styles.pageCurrent}>{page}</span>
              <button className={styles.pageBtn} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</button>
              <button className={styles.pageBtn} onClick={() => setPage(totalPages)} disabled={page === totalPages}>›|</button>
            </div>
          </div>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className={styles.filterPanel}>
            <h3 className={styles.filterTitle}>Filtros</h3>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Búsqueda</label>
              <input className={styles.filterInput} placeholder="Buscar proyecto..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className={styles.filterActions}>
              <button className={styles.btnSecondary} onClick={() => setSearch('')}>Limpiar</button>
              <button className={styles.btnPrimary} onClick={() => setShowFilters(false)}>Aplicar</button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreate && <ProjectModal onClose={() => setShowCreate(false)} onSave={handleCreate} loading={createMutation.isPending} />}
      {editing && <ProjectModal initial={editing} onClose={() => setEditing(null)} onSave={handleEdit} loading={updateMutation.isPending} />}
      {deleting && <ConfirmDialog title={deleting.title} onConfirm={handleDelete} onCancel={() => setDeleting(null)} />}
    </div>
  );
}
