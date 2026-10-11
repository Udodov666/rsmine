import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

/**
 * .modal (04 §1.10): z1500, Esc закрывает (кроме critical),
 * клик по фону закрывает информационные, critical — только кнопками.
 * Начальный фокус внутрь, возврат фокуса якорю.
 */
export function Modal(props: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  critical?: boolean;
  actions?: ReactNode;
}) {
  const { title, children, onClose, critical, actions } = props;
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    boxRef.current?.querySelector<HTMLElement>('button, input, textarea')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !critical) {
        e.stopPropagation();
        onClose();
      }
      if (e.key === 'Tab') {
        const els = boxRef.current?.querySelectorAll<HTMLElement>(
          'button, input, textarea, select, a[href], [tabindex]:not([tabindex="-1"])',
        );
        if (!els || els.length === 0) return;
        const list = Array.from(els);
        const idx = list.indexOf(document.activeElement as HTMLElement);
        e.preventDefault();
        const next = e.shiftKey
          ? list[(idx - 1 + list.length) % list.length]
          : list[(idx + 1) % list.length];
        next.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      prev?.focus?.();
    };
  }, [onClose, critical]);

  return createPortal(
    <div
      className="modal-bg"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !critical) onClose();
      }}
    >
      <div className="modal" ref={boxRef} role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        <div className="modal-body">{children}</div>
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>,
    document.body,
  );
}
