import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

export interface MenuItem {
  value: string;
  label: string;
  hint?: string;
  danger?: boolean;
  selected?: boolean;
}

/**
 * Кастомное выпадающее меню (04 §1.9): портал в body, fixed, z1600,
 * закрытие по клику вне и Esc, клавиатура ↑/↓/Enter, флип у края вьюпорта.
 */
export function Menu(props: {
  /** контрол-якорь; получает aria-expanded и toggle */
  button: (open: boolean, toggle: () => void) => React.ReactNode;
  items: MenuItem[];
  onSelect: (value: string) => void;
  align?: 'start' | 'end';
}) {
  const { items, onSelect, align = 'start' } = props;
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const anchorRef = useRef<HTMLSpanElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    const h = items.length * 32 + 16;
    const top = r.bottom + h > window.innerHeight ? Math.max(8, r.top - h - 4) : r.bottom + 4;
    const left = align === 'end' ? r.right - 230 : r.left;
    setPos({ top, left: Math.max(8, Math.min(left, window.innerWidth - 238)) });
  }, [open, items.length, align]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (
        !listRef.current?.contains(e.target as Node) &&
        !anchorRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        anchorRef.current?.querySelector<HTMLElement>('button')?.focus();
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const btns = Array.from(
          listRef.current?.querySelectorAll<HTMLButtonElement>('.menu-item') ?? [],
        );
        const idx = btns.indexOf(document.activeElement as HTMLButtonElement);
        const next =
          e.key === 'ArrowDown'
            ? btns[(idx + 1) % btns.length]
            : btns[(idx - 1 + btns.length) % btns.length];
        next?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        listRef.current
          ?.querySelector<HTMLButtonElement>('.menu-item.selected, .menu-item')
          ?.focus();
      });
    }
  }, [open]);

  return (
    <span ref={anchorRef} style={{ position: 'relative', display: 'inline-flex' }}>
      {props.button(open, () => setOpen((v) => !v))}
      {open &&
        createPortal(
          <div
            className="menu"
            ref={listRef}
            role="menu"
            style={{ top: pos.top, left: pos.left, visibility: pos.top ? 'visible' : 'hidden' }}
          >
            {items.map((it) => (
              <button
                key={it.value}
                type="button"
                role="menuitem"
                className={`menu-item ${it.danger ? 'danger' : ''} ${it.selected ? 'selected' : ''}`}
                onClick={() => {
                  setOpen(false);
                  onSelect(it.value);
                }}
              >
                {it.selected && <Check size={14} strokeWidth={1.8} />}
                <span style={{ flex: 1 }}>{it.label}</span>
                {it.hint && <span className="hint num">{it.hint}</span>}
              </button>
            ))}
          </div>,
          document.body,
        )}
      {/* чебокс-иконка не рендерится здесь: якорь сам её рисует */}
      <span style={{ display: 'none' }}>
        <ChevronDown size={1} />
      </span>
    </span>
  );
}

/** Готовый контрол-кнопка в стиле .st-select для Menu. */
export function SelectButton(props: {
  label: string;
  open: boolean;
  onClick: () => void;
  width?: number;
}) {
  return (
    <button
      type="button"
      className="st-select"
      style={{ width: props.width ?? 150, display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'space-between' }}
      aria-haspopup="menu"
      aria-expanded={props.open}
      onClick={props.onClick}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{props.label}</span>
      <ChevronDown size={14} strokeWidth={1.8} style={{ flex: 'none', color: 'var(--text3)' }} />
    </button>
  );
}
