import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateCustomer } from '../../hooks/useClients';
import styles from './AddClientePage.module.css';

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  status: 'active' | 'inactive';
}

const initialForm: FormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  status: 'active',
};

export default function AddClientePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(initialForm);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const createCustomer = useCreateCustomer();

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleCancel() {
    navigate('/admin/customers/list');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await createCustomer.mutateAsync({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        address: form.address || undefined,
        status: form.status,
      });
      setSuccessMessage('Cliente creado exitosamente.');
      setTimeout(() => navigate('/admin/customers/list'), 800);
    } catch {
      setErrorMessage('Error al crear el cliente. Intente nuevamente.');
    }
  }

  const isSubmitting = createCustomer.isPending;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Nuevo cliente</h1>

      {successMessage && <p className={styles.success}>{successMessage}</p>}
      {errorMessage && <p className={styles.error}>{errorMessage}</p>}

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label htmlFor="firstName" className={styles.label}>Nombre</label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            className={styles.input}
            value={form.firstName}
            onChange={handleChange}
            required
            disabled={isSubmitting}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="lastName" className={styles.label}>Apellido</label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            className={styles.input}
            value={form.lastName}
            onChange={handleChange}
            required
            disabled={isSubmitting}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="email" className={styles.label}>Email</label>
          <input
            id="email"
            name="email"
            type="email"
            className={styles.input}
            value={form.email}
            onChange={handleChange}
            required
            disabled={isSubmitting}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="phone" className={styles.label}>Teléfono</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            className={styles.input}
            value={form.phone}
            onChange={handleChange}
            required
            disabled={isSubmitting}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="address" className={styles.label}>Dirección</label>
          <input
            id="address"
            name="address"
            type="text"
            className={styles.input}
            value={form.address}
            onChange={handleChange}
            disabled={isSubmitting}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="status" className={styles.label}>Estado</label>
          <select
            id="status"
            name="status"
            className={styles.select}
            value={form.status}
            onChange={handleChange}
            disabled={isSubmitting}
          >
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
          </select>
        </div>

        <div className={styles.actions}>
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Guardando...' : 'Guardar cliente'}
          </button>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
