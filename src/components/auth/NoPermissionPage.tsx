import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './NoPermissionPage.module.css';

/**
 * Full-page guard rendered when a user navigates to a route they lack
 * permission to access. Friendly, accessible, non-alarmist tone.
 *
 * - Heading auto-focuses on mount for screen reader announcement.
 * - Icon is aria-hidden (decorative).
 * - Primary CTA navigates to /admin/dashboard.
 */
export function NoPermissionPage() {
  const navigate = useNavigate();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {/* Decorative lock icon — aria-hidden so screen readers skip it */}
        <span className={styles.icon} aria-hidden="true">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={styles.iconSvg}
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </span>

        <h1
          ref={headingRef}
          tabIndex={-1}
          className={styles.heading}
        >
          No tenés permisos
        </h1>

        <p className={styles.description}>
          Esta sección requiere acceso que aún no te fue otorgado.{' '}
          Si pensás que es un error, contactá al administrador.
        </p>

        <button
          type="button"
          className={styles.cta}
          onClick={() => navigate('/admin/dashboard')}
        >
          Volver al inicio
        </button>
      </div>
    </div>
  );
}
