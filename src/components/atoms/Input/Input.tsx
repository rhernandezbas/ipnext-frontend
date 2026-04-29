import React from 'react';
import styles from './Input.module.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export function Input({ error, className, ...rest }: InputProps) {
  return (
    <div className={styles.wrapper}>
      <input
        className={[styles.input, error ? styles.hasError : '', className].filter(Boolean).join(' ')}
        {...rest}
      />
      {error && <span className={styles.errorMsg}>{error}</span>}
    </div>
  );
}
