import { useRef } from 'react';

export interface SegOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

/** .seg — взаимоисключающий выбор (04 §1.4), роль радиогруппы, стрелки. */
export function Seg<T extends string>(props: {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel?: string;
}) {
  const { options, value, onChange, ariaLabel } = props;
  const ref = useRef<HTMLDivElement>(null);
  const enabled = options.filter((o) => !o.disabled);

  function onKey(e: React.KeyboardEvent) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const idx = enabled.findIndex((o) => o.value === value);
    const next =
      e.key === 'ArrowRight'
        ? enabled[(idx + 1) % enabled.length]
        : enabled[(idx - 1 + enabled.length) % enabled.length];
    onChange(next.value);
    const btns = ref.current?.querySelectorAll<HTMLButtonElement>('button');
    btns?.[options.indexOf(next)]?.focus();
  }

  return (
    <div className="seg" role="radiogroup" aria-label={ariaLabel} ref={ref} onKeyDown={onKey}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? 'on' : ''}
          disabled={o.disabled}
          tabIndex={o.value === value ? 0 : -1}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
