import { useState } from 'react';
import {
  useTicketAreas,
  useCreateTicketArea,
  useUpdateTicketArea,
  useDeleteTicketArea,
} from '@/hooks/useTicketAreas';
import type { TicketArea } from '@/types/ticketArea';
import { Can } from '@/components/auth/Can';
import { useConfirm } from '@/context/ConfirmContext';
import styles from './TicketAreasBody.module.css';

/** #69 — default pill color for a new area (índigo, mirrors the BE seed default). */
const DEFAULT_AREA_COLOR = '#6366f1';

/**
 * portal-topic-admin — payload shape shared by create/update. A blank text field
 * MUST travel as `null`, never `""`: the BE rejects an empty string with 400
 * (`.trim().min(1)`), while `null` is the documented way to clear the field.
 */
interface PortalFieldsPayload {
  portalVisible: boolean;
  portalLabel: string | null;
  portalDescription: string | null;
  portalOrder: number;
}

function toNullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * El BE exige un ENTERO (`z.number().int()` en CreateTicketAreaSchema), pero un
 * `<input type="number">` entrega string y deja pasar decimales y estados
 * intermedios invalidos ("-", "1e"), que `Number()` convierte en 1.5 o NaN.
 * Cualquiera de los dos se come un 400 que el operador ve como "No se pudo
 * guardar el area", sin pista de cual campo lo causo.
 *
 * La basura cae al valor SEGURO (0), no al ultimo tipeado: 0 es el mismo default
 * de la columna y el unico valor que no puede reordenar los topicos por accidente.
 */
function toPortalOrder(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

interface ModalProps {
  initial?: TicketArea;
  onClose: () => void;
  onSave: (data: { name: string; color: string } & PortalFieldsPayload) => Promise<void>;
  loading: boolean;
}

function TicketAreaModal({ initial, onClose, onSave, loading }: ModalProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? DEFAULT_AREA_COLOR);
  const [error, setError] = useState<string | null>(null);

  // portal-topic-admin — kept in separate state so toggling portalVisible off/on
  // never clears what the operator already typed (contract: apagar y prender
  // conserva lo escrito).
  const [portalVisible, setPortalVisible] = useState(initial?.portalVisible ?? false);
  const [portalLabel, setPortalLabel] = useState(initial?.portalLabel ?? '');
  const [portalDescription, setPortalDescription] = useState(initial?.portalDescription ?? '');
  const [portalOrder, setPortalOrder] = useState(initial?.portalOrder ?? 0);

  async function handleSave() {
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        color,
        portalVisible,
        portalLabel: toNullableText(portalLabel),
        portalDescription: toNullableText(portalDescription),
        portalOrder,
      });
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { code?: string } } };
      if (e.response?.status === 409 && e.response.data?.code === 'TICKET_AREA_NAME_CONFLICT') {
        setError('Ya existe un area con ese nombre.');
      } else {
        setError('No se pudo guardar el area.');
      }
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>
          {initial ? 'Editar area' : 'Nueva area'}
        </h2>
        {error && <p className={styles.error}>{error}</p>}
        <label className={styles.label}>
          Nombre *
          <input
            className={styles.input}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ej: Soporte tecnico"
            autoFocus
          />
        </label>
        <label className={styles.label}>
          Color
          <input
            type="color"
            aria-label="Color del area"
            value={color}
            onChange={e => setColor(e.target.value)}
            style={{ width: 56, height: 36, padding: 2, border: '1px solid #cbd5e1', borderRadius: 8, cursor: 'pointer' }}
          />
        </label>

        <div className={styles.portalSection}>
          <h3 className={styles.portalSectionTitle}>Visible en la app de clientes</h3>

          <div className={styles.switchRow}>
            <span className={styles.switchRowLabel}>
              Mostrar este tópico en la app de clientes
            </span>
            <label className={styles.switch}>
              <input
                type="checkbox"
                checked={portalVisible}
                onChange={e => setPortalVisible(e.target.checked)}
                aria-label="Mostrar este tópico en la app de clientes"
              />
              <span className={styles.switchTrack} aria-hidden="true" />
            </label>
          </div>

          <label className={styles.label} htmlFor="portalLabel">
            Nombre en la app
            <input
              id="portalLabel"
              className={styles.input}
              value={portalLabel}
              onChange={e => setPortalLabel(e.target.value)}
              placeholder={name.trim() || 'Nombre interno del área'}
              disabled={!portalVisible}
            />
            <span className={styles.helper}>
              Es el nombre que ve el cliente al elegir este tópico. Si lo dejás
              vacío, se usa el nombre interno del área.
            </span>
          </label>

          <label className={styles.label} htmlFor="portalDescription">
            Descripción en la app
            <textarea
              id="portalDescription"
              className={styles.input}
              value={portalDescription}
              onChange={e => setPortalDescription(e.target.value)}
              disabled={!portalVisible}
              rows={2}
            />
            <span className={styles.helper}>
              Línea de ayuda que aparece debajo del tópico, para que el cliente
              sepa cuándo elegir esta opción.
            </span>
          </label>

          <label className={styles.label} htmlFor="portalOrder">
            Orden en la app
            <input
              id="portalOrder"
              type="number"
              className={styles.input}
              value={portalOrder}
              onChange={e => setPortalOrder(toPortalOrder(e.target.value))}
              disabled={!portalVisible}
            />
          </label>
        </div>

        <div className={styles.modalActions}>
          <button className={styles.btnSecondary} onClick={onClose} disabled={loading}>Cancelar</button>
          <button className={styles.btnPrimary} onClick={handleSave} disabled={!name.trim() || loading}>
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Areas de tickets: toolbar + tabla + modales, sin header de pagina. */
export function TicketAreasBody() {
  const { data: areas = [], isLoading } = useTicketAreas();
  const createMutation = useCreateTicketArea();
  const updateMutation = useUpdateTicketArea();
  const deleteMutation = useDeleteTicketArea();

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<TicketArea | null>(null);
  const confirm = useConfirm();

  async function handleCreate(data: { name: string; color: string }) {
    await createMutation.mutateAsync(data);
  }

  async function handleEdit(data: { name: string; color: string }) {
    if (!editing) return;
    await updateMutation.mutateAsync({ id: editing.id, data });
    setEditing(null);
  }

  async function handleDelete(area: TicketArea) {
    if (!(await confirm({ message: `Eliminar el area "${area.name}"?`, tone: 'danger', confirmLabel: 'Eliminar' }))) return;
    try {
      await deleteMutation.mutateAsync(area.id);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { code?: string } } };
      if (e.response?.status === 409 && e.response.data?.code === 'TICKET_AREA_IN_USE') {
        window.alert('No se puede eliminar: hay tickets que usan esta area.');
      } else {
        window.alert('No se pudo eliminar el area.');
      }
    }
  }

  return (
    <>
      <div className={styles.toolbar}>
        <Can permission="tickets.manage">
          <button className={styles.btnPrimary} onClick={() => setShowCreate(true)}>+ Nueva area</button>
        </Can>
      </div>

      <div className={styles.card}>
        {isLoading ? (
          <p className={styles.empty}>Cargando...</p>
        ) : areas.length === 0 ? (
          <p className={styles.empty}>No hay areas. Crea la primera.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Color</th>
                <th>Nombre</th>
                <th>Portal</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {areas.map(area => (
                <tr key={area.id}>
                  <td>
                    <span
                      aria-label={`Color de ${area.name}`}
                      style={{
                        display: 'inline-block',
                        width: 18,
                        height: 18,
                        borderRadius: 9999,
                        background: area.color,
                        border: '1px solid #00000022',
                        verticalAlign: 'middle',
                      }}
                    />
                  </td>
                  <td>{area.name}</td>
                  <td>
                    {area.portalVisible && (
                      <span className={styles.portalCell}>
                        <span className={styles.portalChip}>En la app</span>
                        {area.portalLabel && (
                          <span className={styles.portalLabelText}>{area.portalLabel}</span>
                        )}
                      </span>
                    )}
                  </td>
                  <td className={styles.actions}>
                    <Can permission="tickets.manage">
                      <button className={styles.linkBtn} onClick={() => setEditing(area)}>Editar</button>
                      <button className={styles.linkDanger} onClick={() => handleDelete(area)}>Eliminar</button>
                    </Can>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <TicketAreaModal
          onClose={() => setShowCreate(false)}
          onSave={handleCreate}
          loading={createMutation.isPending}
        />
      )}
      {editing && (
        <TicketAreaModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={handleEdit}
          loading={updateMutation.isPending}
        />
      )}
    </>
  );
}
