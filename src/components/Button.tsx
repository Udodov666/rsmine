import { useEffect, useState } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Check, Loader2 } from 'lucide-react';

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger' | 'outline';
  children: ReactNode;
  loading?: boolean;
  success?: boolean;
  loadingText?: string;
}

/** .btn из 04 §1.2. Один primary на экран (04 §0 / 01 §7.7). */
export function Button({
  variant = 'ghost',
  className,
  children,
  loading = false,
  success = false,
  loadingText,
  disabled,
  ...rest
}: BtnProps) {
  const [showLoader, setShowLoader] = useState(false);

  useEffect(() => {
    if (!loading) {
      setShowLoader(false);
      return;
    }
    const timer = window.setTimeout(() => setShowLoader(true), 140);
    return () => window.clearTimeout(timer);
  }, [loading]);

  const state = success ? 'success' : loading ? 'loading' : 'idle';
  return (
    <button
      className={`btn ${variant} ${className ?? ''}`}
      data-state={state}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      {...rest}
    >
      <span className="btn-content" aria-hidden={showLoader || success}>
        {children}
      </span>
      <span className="btn-state" aria-hidden={!showLoader && !success}>
        {success ? (
          <Check className="btn-check" size={15} strokeWidth={2.2} />
        ) : showLoader ? (
          <>
            <Loader2 className="spin" size={15} strokeWidth={2} />
            {loadingText && <span>{loadingText}</span>}
          </>
        ) : null}
      </span>
    </button>
  );
}
