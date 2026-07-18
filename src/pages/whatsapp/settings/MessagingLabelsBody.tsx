import { useState } from 'react';
import {
  useMessagingLabels,
  useCreateMessagingLabel,
  useUpdateMessagingLabel,
  useDeleteMessagingLabel,
} from '@/hooks/useWhatsapp';
import type { WhatsappLabel } from '@/types/whatsapp';
import { readableTextColor } from '@/utils/contrastColor';
import { Can } from '@/components/auth/Can';
import { useConfirm } from '@/context/ConfirmContext';
import styles from './MessagingLabelsBody.module.css';

/**
 * Paleta de arranque del picker — mirror de la familia de color del design
 * system (`tokens/variables.css`: status/brand/semantic). NO es "hex crudo de
 * estilo": son las CHOICES que se ofrecen al operador (data), el mismo criterio
 * con el que el BE seedea colores de labels. El color final es dato editable de
 * la label, nunca un hardcode de layout. El primero es el default de una label
 * nueva (--color-accent).
 */
const LABEL_COLOR_PRESETS = [
  '#6f42c1', // --color-accent / crm-purple
  '#0d6efd', // --color-primary / status-active
  '#28a745', // --color-success / company-green
  '#dc3545', // --color-danger / status-late
  '#fd7e14', // --color-status-blocked
  '#6c757d', // --color-status-inactive
] as const;

const DEFAULT_LABEL_COLOR = LABEL_COLOR_PRESETS[0];

interface ModalProps {
  initial?: WhatsappLabel;
  onClose: () => void;
  onSave: (data: { name: string; color: string }) => Promise<void>;
  loading: boolean;
}

function LabelModal({ initial, onClose, onSave, loading }: ModalProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? DEFAULT_LABEL_COLOR);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    try {
      await onSave({ name: name.trim(), color });
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { code?: string } } };
      if (e.response?.status === 409 && e.response.data?.code === 'CONVERSATION_LABEL_NAME_CONFLICT') {
        setError('Ya existe una etiqueta con ese nombre.');
      } else if (e.response?.status === 400) {
        setError('El nombre o el color no son válidos.');
      } else {
        setError('No se pudo guardar la etiqueta.');
      }
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={initial ? 'Editar etiqueta' : 'Nueva etiqueta'}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className={styles.modalTitle}>{initial ? 'Editar etiqueta' : 'Nueva etiqueta'}</h2>
        {error && <p className={styles.error} role="alert">{error}</p>}

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Nombre *</span>
          <input
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Urgente"
            autoFocus
          />
        </label>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>Color</span>
          <div className={styles.colorRow}>
            <span
              className={styles.preview}
              style={{ backgroundColor: color, color: readableTextColor(color) }}
              data-testid="label-color-preview"
            >
              {name.trim() || 'Etiqueta'}
            </span>
            <input
              type="color"
              className={styles.colorInput}
              aria-label="Color de la etiqueta"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </div>
          <div className={styles.presets} role="group" aria-label="Colores sugeridos">
            {LABEL_COLOR_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={styles.presetSwatch}
                style={{ backgroundColor: preset }}
                aria-label={`Usar color ${preset}`}
                aria-pressed={color.toLowerCase() === preset.toLowerCase()}
                onClick={() => setColor(preset)}
              />
            ))}
          </div>
        </div>

        <div className={styles.modalActions}>
          <button type="button" className={styles.btnSecondary} onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button
            type="button"
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

/**
 * MessagingLabelsBody — ABM del catálogo de etiquetas de conversación (Ola 5 —
 * labels). Molde `TicketAreasBody` (toolbar + tabla + modales), pero con CSS de
 * TOKENS (sin px/hex crudo nuevo) y errores 409/400 legibles en el modal. Todo
 * gateado por `messaging.manage` (la sección entera lo está en
 * `WhatsappSettingsPage`; los botones repiten el gate por defensa).
 */
export function MessagingLabelsBody() {
  const { data: labels = [], isLoading } = useMessagingLabels();
  const createMutation = useCreateMessagingLabel();
  const updateMutation = useUpdateMessagingLabel();
  const deleteMutation = useDeleteMessagingLabel();

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<WhatsappLabel | null>(null);
  const confirm = useConfirm();

  async function handleCreate(data: { name: string; color: string }) {
    await createMutation.mutateAsync(data);
  }

  async function handleEdit(data: { name: string; color: string }) {
    if (!editing) return;
    await updateMutation.mutateAsync({ id: editing.id, data });
    setEditing(null);
  }

  async function handleDelete(label: WhatsappLabel) {
    const ok = await confirm({
      message: `Eliminar la etiqueta "${label.name}"? Se quitará de las conversaciones que la tengan.`,
      tone: 'danger',
      confirmLabel: 'Eliminar',
    });
    if (!ok) return;
    try {
      await deleteMutation.mutateAsync(label.id);
    } catch {
      window.alert('No se pudo eliminar la etiqueta.');
    }
  }

  return (
    <>
      <div className={styles.toolbar}>
        <Can permission="messaging.manage">
          <button type="button" className={styles.btnPrimary} onClick={() => setShowCreate(true)}>
            + Nueva etiqueta
          </button>
        </Can>
      </div>

      <div className={styles.card}>
        {isLoading ? (
          <p className={styles.empty}>Cargando…</p>
        ) : labels.length === 0 ? (
          <p className={styles.empty}>No hay etiquetas. Creá la primera.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Etiqueta</th>
                <th scope="col" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {labels.map((label) => (
                <tr key={label.id}>
                  <td>
                    <span
                      className={styles.chip}
                      style={{ backgroundColor: label.color, color: readableTextColor(label.color) }}
                      data-testid="label-chip"
                    >
                      {label.name}
                    </span>
                  </td>
                  <td className={styles.actions}>
                    <Can permission="messaging.manage">
                      <button type="button" className={styles.linkBtn} onClick={() => setEditing(label)}>
                        Editar
                      </button>
                      <button type="button" className={styles.linkDanger} onClick={() => handleDelete(label)}>
                        Eliminar
                      </button>
                    </Can>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <LabelModal onClose={() => setShowCreate(false)} onSave={handleCreate} loading={createMutation.isPending} />
      )}
      {editing && (
        <LabelModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={handleEdit}
          loading={updateMutation.isPending}
        />
      )}
    </>
  );
}
