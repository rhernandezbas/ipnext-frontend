import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Select, type SelectOption } from '@/components/molecules/Select/Select';
import { useTicketAreas } from '@/hooks/useTicketAreas';
import { parseArDecimal, toDecimalNumber } from '@/utils/decimal';
import { formatMoney } from '@/utils/formatMoney';
import {
  validateStoreProductImage,
  STORE_PRODUCT_IMAGE_ACCEPT,
} from '@/utils/validateStoreProductImage';
import type { CreateStoreProductInput } from '@/api/store.api';
import type { StoreProductDto } from '@/types/store';
import styles from './ProductFormModal.module.css';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusable(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

const DEFAULT_WARRANTY = '6 meses legal + garantía del fabricante';
const MIN_INSTALLMENTS = 1;
const MAX_INSTALLMENTS = 12;
const TITLE_ID = 'product-form-title';

/** Formatea un `number` como string editable es-AR (precarga del input de precio, edit mode). */
function toArDecimalInput(n: number): string {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(n);
}

export type ProductImageAction = { type: 'none' } | { type: 'upload'; file: File } | { type: 'remove' };

interface ProductFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initial?: StoreProductDto | null;
  busy?: boolean;
  serverError?: string | null;
  onSubmit: (input: CreateStoreProductInput, imageAction: ProductImageAction) => void;
  onCancel: () => void;
}

/**
 * ProductFormModal (store-admin) — form de crear/editar un producto de la
 * tienda. Molde de `PromoFormModal` (focus-trap, Esc, scroll-lock, portal,
 * `key={productId}` a cargo del container) MÁS el manejo de imagen que promos
 * deliberadamente no tiene: acá el BE SÍ soporta upload/delete
 * (`POST`/`DELETE /store/products/:id/image`), así que el form arma un
 * `ProductImageAction` que el container ejecuta DESPUÉS de crear/actualizar el
 * producto (necesita el `id` — en 'create' todavía no existe hasta que el
 * POST responde). El preview de imagen es SIEMPRE local
 * (`URL.createObjectURL` del archivo elegido) — nunca se arma una URL a partir
 * de `imageStorageKey` (no hay endpoint GET documentado para el panel, ver
 * `types/store.ts`).
 *
 * El precio es un input de TEXTO es-AR ('.' miles, ',' decimal) — el payload
 * real que sale de acá es SIEMPRE un `number` (`parseArDecimal`), nunca el
 * string crudo.
 */
export function ProductFormModal({ open, mode, initial, busy = false, serverError, onSubmit, onCancel }: ProductFormModalProps) {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [priceInput, setPriceInput] = useState('');
  const [maxInstallments, setMaxInstallments] = useState(MIN_INSTALLMENTS);
  const [warrantyText, setWarrantyText] = useState(DEFAULT_WARRANTY);
  const [badge, setBadge] = useState('');
  const [ticketAreaId, setTicketAreaId] = useState('');
  const [sortOrderInput, setSortOrderInput] = useState('0');
  const [attempted, setAttempted] = useState(false);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const { data: ticketAreas } = useTicketAreas();

  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset + precarga (edit) + foco inicial al ABRIR — keyed solo en `open`
  // (mismo criterio que PromoFormModal), no se pisa lo que tipea el operador.
  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? '');
    setSummary(initial?.summary ?? '');
    setDescription(initial?.description ?? '');
    setPriceInput(initial ? toArDecimalInput(toDecimalNumber(initial.priceArs)) : '');
    setMaxInstallments(initial?.maxInstallments ?? MIN_INSTALLMENTS);
    setWarrantyText(initial?.warrantyText ?? DEFAULT_WARRANTY);
    setBadge(initial?.badge ?? '');
    setTicketAreaId(initial?.ticketAreaId ?? '');
    setSortOrderInput(String(initial?.sortOrder ?? 0));
    setAttempted(false);
    setImageFile(null);
    setImagePreviewUrl(null);
    setRemoveImage(false);
    setImageError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    firstFieldRef.current?.focus();
    return () => {
      const el = restoreFocusRef.current;
      if (el && typeof el.focus === 'function') el.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir/cerrar, ver PromoFormModal
  }, [open]);

  // Revoca el object URL del preview al reemplazarlo/desmontar — evita leaks.
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  // Scroll-lock + Esc cancela + Tab atrapa el foco dentro del diálogo.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCancel();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = getFocusable(dialogRef.current);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      const outside = !dialogRef.current?.contains(active);
      if (e.shiftKey) {
        if (active === first || outside) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || outside) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onCancel]);

  if (!open) return null;

  const trimmedTitle = title.trim();
  const trimmedSummary = summary.trim();
  const trimmedDescription = description.trim();
  const trimmedWarranty = warrantyText.trim();
  const trimmedBadge = badge.trim();

  const priceValue = parseArDecimal(priceInput);
  const sortOrderValue = Number(sortOrderInput);

  const titleError = trimmedTitle.length === 0;
  const summaryError = trimmedSummary.length === 0;
  const descriptionError = trimmedDescription.length === 0;
  const priceError = priceValue === null || priceValue <= 0;
  const maxInstallmentsError =
    !Number.isInteger(maxInstallments) || maxInstallments < MIN_INSTALLMENTS || maxInstallments > MAX_INSTALLMENTS;
  const warrantyError = trimmedWarranty.length === 0;
  const sortOrderError = sortOrderInput.trim().length === 0 || !Number.isFinite(sortOrderValue);

  const isValid =
    !titleError && !summaryError && !descriptionError && !priceError && !maxInstallmentsError && !warrantyError && !sortOrderError;

  const installmentPreview =
    priceValue !== null && priceValue > 0 && !maxInstallmentsError
      ? `${maxInstallments} cuota${maxInstallments === 1 ? '' : 's'} de ${formatMoney(priceValue / maxInstallments, 'ARS')}`
      : null;

  const ticketAreaOptions: SelectOption[] = [
    { value: '', label: 'Sin área asociada' },
    ...(ticketAreas ?? []).map((a) => ({ value: a.id, label: a.name })),
  ];

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (!file) return;
    const invalid = validateStoreProductImage(file);
    if (invalid) {
      setImageError(invalid.message);
      return;
    }
    setImageError(null);
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    setRemoveImage(false);
  }

  function handleRemoveImage() {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImageFile(null);
    setImagePreviewUrl(null);
    setImageError(null);
    setRemoveImage(true);
  }

  function handleSubmit() {
    setAttempted(true);
    if (!isValid || busy || priceValue === null) return;

    const input: CreateStoreProductInput = {
      title: trimmedTitle,
      summary: trimmedSummary,
      description: trimmedDescription,
      priceArs: priceValue,
      maxInstallments,
      warrantyText: trimmedWarranty,
      badge: trimmedBadge === '' ? null : trimmedBadge,
      ticketAreaId: ticketAreaId === '' ? null : ticketAreaId,
      sortOrder: sortOrderValue,
    };

    const imageAction: ProductImageAction = imageFile
      ? { type: 'upload', file: imageFile }
      : removeImage && initial?.imageStorageKey
        ? { type: 'remove' }
        : { type: 'none' };

    onSubmit(input, imageAction);
  }

  const titleLabel = mode === 'edit' ? 'Editar producto' : 'Nuevo producto';
  const submitLabel = mode === 'edit' ? 'Guardar cambios' : 'Crear producto';
  const hasExistingImage = !!initial?.imageStorageKey && !removeImage && !imageFile;

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={TITLE_ID}
    >
      <div className={styles.dialog} ref={dialogRef}>
        <h2 id={TITLE_ID} className={styles.title}>
          {titleLabel}
        </h2>

        {serverError && (
          <p className={styles.error} role="alert">
            {serverError}
          </p>
        )}

        <div className={styles.field}>
          <label htmlFor="product-title" className={styles.label}>
            Título
          </label>
          <input
            ref={firstFieldRef}
            id="product-title"
            type="text"
            className={styles.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-invalid={(attempted && titleError) || undefined}
          />
          {attempted && titleError && (
            <span className={styles.fieldError} role="alert">
              El título es obligatorio.
            </span>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="product-summary" className={styles.label}>
            Resumen
          </label>
          <input
            id="product-summary"
            type="text"
            className={styles.input}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            aria-invalid={(attempted && summaryError) || undefined}
          />
          {attempted && summaryError && (
            <span className={styles.fieldError} role="alert">
              El resumen es obligatorio.
            </span>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="product-description" className={styles.label}>
            Descripción
          </label>
          <textarea
            id="product-description"
            className={styles.textarea}
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            aria-invalid={(attempted && descriptionError) || undefined}
          />
          {attempted && descriptionError && (
            <span className={styles.fieldError} role="alert">
              La descripción es obligatoria.
            </span>
          )}
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor="product-price" className={styles.label}>
              Precio (ARS)
            </label>
            <input
              id="product-price"
              type="text"
              inputMode="decimal"
              className={styles.input}
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              placeholder="Ej. 45.000,00"
              aria-invalid={(attempted && priceError) || undefined}
            />
            {attempted && priceError && (
              <span className={styles.fieldError} role="alert">
                Ingresá un precio válido mayor a cero.
              </span>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="product-max-installments" className={styles.label}>
              Cuotas máximas
            </label>
            <input
              id="product-max-installments"
              type="number"
              min={MIN_INSTALLMENTS}
              max={MAX_INSTALLMENTS}
              step={1}
              className={styles.input}
              value={maxInstallments}
              onChange={(e) => setMaxInstallments(Number(e.target.value))}
              aria-invalid={(attempted && maxInstallmentsError) || undefined}
            />
            {attempted && maxInstallmentsError && (
              <span className={styles.fieldError} role="alert">
                Entre 1 y 12 cuotas.
              </span>
            )}
          </div>
        </div>

        {installmentPreview && <p className={styles.preview}>{installmentPreview}</p>}

        <div className={styles.field}>
          <label htmlFor="product-warranty" className={styles.label}>
            Garantía
          </label>
          <input
            id="product-warranty"
            type="text"
            className={styles.input}
            value={warrantyText}
            onChange={(e) => setWarrantyText(e.target.value)}
            aria-invalid={(attempted && warrantyError) || undefined}
          />
          {attempted && warrantyError && (
            <span className={styles.fieldError} role="alert">
              La garantía es obligatoria.
            </span>
          )}
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor="product-badge" className={styles.label}>
              Badge (opcional)
            </label>
            <input
              id="product-badge"
              type="text"
              className={styles.input}
              value={badge}
              onChange={(e) => setBadge(e.target.value)}
              placeholder="Ej. Nuevo"
            />
          </div>

          <div className={styles.field}>
            <Select
              label="Área del reclamo (opcional)"
              options={ticketAreaOptions}
              value={ticketAreaId}
              onChange={setTicketAreaId}
            />
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="product-sort-order" className={styles.label}>
            Orden
          </label>
          <input
            id="product-sort-order"
            type="number"
            step={1}
            className={styles.input}
            value={sortOrderInput}
            onChange={(e) => setSortOrderInput(e.target.value)}
            aria-invalid={(attempted && sortOrderError) || undefined}
          />
          {attempted && sortOrderError && (
            <span className={styles.fieldError} role="alert">
              Ingresá un número de orden válido.
            </span>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="product-image" className={styles.label}>
            Imagen del producto (opcional)
          </label>
          <input
            ref={fileInputRef}
            id="product-image"
            type="file"
            accept={STORE_PRODUCT_IMAGE_ACCEPT}
            className={styles.fileInput}
            onChange={handleFileChange}
            aria-describedby="product-image-hint"
          />
          <span id="product-image-hint" className={styles.hint}>
            Imagen (jpg, png, webp, gif), hasta 8MB.
          </span>
          {imageError && (
            <span className={styles.fieldError} role="alert">
              {imageError}
            </span>
          )}
          {imagePreviewUrl && (
            <div className={styles.imagePreviewRow}>
              <img src={imagePreviewUrl} alt="Vista previa de la imagen elegida" className={styles.imagePreview} />
              <button type="button" className={styles.removeImageBtn} onClick={handleRemoveImage}>
                Quitar imagen
              </button>
            </div>
          )}
          {hasExistingImage && (
            <div className={styles.imagePreviewRow}>
              <span className={styles.hint}>Este producto ya tiene una imagen cargada.</span>
              <button type="button" className={styles.removeImageBtn} onClick={handleRemoveImage}>
                Quitar imagen
              </button>
            </div>
          )}
          {removeImage && !imagePreviewUrl && (
            <span className={styles.hint}>La imagen se va a eliminar al guardar.</span>
          )}
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button type="button" className={styles.confirm} onClick={handleSubmit} disabled={busy}>
            {busy ? 'Guardando…' : submitLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
