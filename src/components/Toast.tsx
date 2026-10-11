import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Info, X } from 'lucide-react';

interface ToastState {
  msg: string;
  key: number;
  leaving?: boolean;
}

const ToastCtx = createContext<(msg: string) => void>(() => {});

/** Тосты вместо alert; текст ошибки ≤120 символов (04 §1.11, 03 §7). */
export function ToastProvider(props: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const timers = useRef<number[]>([]);

  const dismiss = useCallback((key: number) => {
    setToasts((items) => items.map((item) => item.key === key ? { ...item, leaving: true } : item));
    const remove = window.setTimeout(() => {
      setToasts((items) => items.filter((item) => item.key !== key));
    }, 190);
    timers.current.push(remove);
  }, []);

  const show = useCallback((msg: string) => {
    const trimmed = msg.length > 120 ? `${msg.slice(0, 117)}…` : msg;
    const key = Date.now() + Math.random();
    setToasts((items) => {
      const withoutDuplicate = items.filter((item) => item.msg !== trimmed);
      return [...withoutDuplicate, { msg: trimmed, key }].slice(-3);
    });
    const timer = window.setTimeout(() => dismiss(key), 3500);
    timers.current.push(timer);
  }, [dismiss]);

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  return (
    <ToastCtx.Provider value={show}>
      {props.children}
      {toasts.length > 0 &&
        createPortal(
          <div className="toast-stack" aria-live="polite">
            {toasts.map((toast) => (
              <div
                className={`toast ${toast.leaving ? 'is-leaving' : ''}`}
                role="status"
                key={toast.key}
              >
                {toast.msg.toLowerCase().includes('ошиб') ? (
                  <Info size={15} strokeWidth={2} />
                ) : (
                  <CheckCircle2 size={15} strokeWidth={2} />
                )}
                <span>{toast.msg}</span>
                <button className="toast-close" aria-label="Закрыть" onClick={() => dismiss(toast.key)}>
                  <X size={13} strokeWidth={2} />
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}
