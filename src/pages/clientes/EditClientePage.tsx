import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useClientDetail, useUpdateCustomer } from '../../hooks/useClients';
import styles from './EditClientePage.module.css';

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  status: string;
}

const emptyForm: FormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  status: 'active',
};

export default function EditClientePage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: customer, isLoading } = useClientDetail(id);
  const updateCustomer = useUpdateCustomer();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errorMessage, setErrorMessage] = useState('');
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (customer && !initialized) {
      const nameParts = customer.name?.split(' ') ?? [];
      setForm({
        firstName: (customer as unknown as Record<string, string>)['firstName'] ?? nameParts[0] ?? '',
        lastName: (customer as unknown as Record<string, string>)['lastName'] ?? nameParts.slice(1).join(' ') ?? '',
        email: customer.email ?? '',
        phone: customer.phone ?? '',
        address: customer.address ?? '',
        status: customer.status ?? 'active',
      });
      setInitialized(true);
    }
  }, [customer, initialized]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleCancel() {
    navigate(`/admin/customers/view/${id}`);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage('');

    try {
      await updateCustomer.mutateAsync({
        id,
        data: {
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          address: form.address,
        },
      });
      navigate(`/admin/customers/view/${id}`);
    } catch {
      setErrorMessage('Error al guardar. Intente nuevamente.');
    }
  }

  const isSubmitting = updateCustomer.isPending;

  if (isLoading) {
    return <div className={styles.loading}>Cargando...</div>;
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Editar cliente</h1>

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
            <option value="blocked">Bloqueado</option>
          </select>
        </div>

        <div className={styles.actions}>
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
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
