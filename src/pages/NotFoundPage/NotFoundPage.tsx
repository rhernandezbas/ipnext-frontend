import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
      <h1 style={{ fontSize: '4rem', fontWeight: 700, color: '#6f42c1' }}>404</h1>
      <p style={{ fontSize: '1.25rem', marginTop: '1rem', color: '#495057' }}>
        Página no encontrada
      </p>
      <Link
        to="/admin/customers/list"
        style={{
          display: 'inline-block',
          marginTop: '2rem',
          color: '#6f42c1',
          fontWeight: 600,
        }}
      >
        Volver al inicio
      </Link>
    </div>
  );
}
