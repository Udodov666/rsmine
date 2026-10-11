import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Copy, Loader2 } from 'lucide-react';

/** Тултип слева от иконки через fixed-портал (не клипается скролл-контейнерами). */
export function Tip(props: { tip: string; children: ReactNode }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={(e) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setPos({ x: r.left - 8, y: r.top + r.height / 2 });
      }}
      onMouseLeave={() => setPos(null)}
    >
      {props.children}
      {pos &&
        createPortal(
          <div
            style={{
              position: 'fixed', left: pos.x, top: pos.y, transform: 'translate(-100%, -50%)',
              background: '#1e1e22', color: 'var(--text)', fontSize: 11.5, padding: '5px 10px',
              borderRadius: 8, whiteSpace: 'nowrap', boxShadow: '0 8px 24px rgba(0,0,0,.4)',
              pointerEvents: 'none', zIndex: 1600,
            }}
          >
            {props.tip}
          </div>,
          document.body,
        )}
    </span>
  );
}
import { copyText } from '../lib/format';

/* ---------- мелкие компоненты из 04 ---------- */

export function Spinner({ size = 14 }: { size?: number }) {
  return <Loader2 className="spin" size={size} strokeWidth={1.8} />;
}

/** .ibar (04 §1.13): fill — только confirmed суммы. */
export function Progress(props: { value: number; max: number }) {
  const pct = props.max > 0 ? Math.min(100, Math.max(0, (props.value / props.max) * 100)) : 0;
  return (
    <div className="ibar">
      <div style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Пустое состояние: 12px --text3, подсказка 1–2 строки, опционально одно действие (04 §1.14). */
export function EmptyState(props: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div>{props.children}</div>
      {props.action}
    </div>
  );
}

export function Skeleton(props: { w?: number | string; h?: number; style?: React.CSSProperties }) {
  return <div className="skeleton" style={{ width: props.w ?? '100%', height: props.h ?? 14, ...props.style }} />;
}

/** Строка свойств «метка слева — контрол справа». */
export function PRow(props: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`prow${props.className ? ` ${props.className}` : ''}`}>
      {typeof props.label === 'string' ? <label>{props.label}</label> : props.label}
      <div className="ctl">{props.children}</div>
    </div>
  );
}

/**
 * Числовое поле с автосохранением. Кламп min/max НЕ на каждый чирк, а на blur/Enter:
 * промежуточное значение («1» при цели «10») просто показывается, а не превращается
 * клампом в «2» — иначе набрать число ниже min первой цифры невозможно.
 * Валидные значения (в том числе стрелки/спиннер) коммитятся сразу, как раньше.
 */
export function NumInput(props: {
  value: number;
  min: number;
  max: number;
  onCommit: (v: number) => void;
  title?: string;
  className?: string;
}) {
  const [raw, setRaw] = useState<string | null>(null);
  const clamp = (text: string) =>
    Math.min(props.max, Math.max(props.min, +text || props.min));
  return (
    <input
      type="number"
      className={props.className ?? 'st-input'}
      title={props.title}
      value={raw ?? String(props.value)}
      onChange={(e) => {
        const text = e.target.value;
        const v = +text;
        if (text !== '' && v >= props.min && v <= props.max) {
          setRaw(null);
          props.onCommit(v);
        } else {
          setRaw(text);
        }
      }}
      onBlur={() => {
        if (raw !== null) {
          props.onCommit(clamp(raw));
          setRaw(null);
        }
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Enter') return;
        props.onCommit(clamp(e.currentTarget.value));
        setRaw(null);
        e.currentTarget.blur();
      }}
    />
  );
}

/** Группа свойств с заголовком-капсом 11px uppercase (04 §1.17). */
export function PGroup(props: { title: string; desc?: ReactNode; children: ReactNode }) {
  return (
    <div className="pgroup">
      <div className="pg-title">{props.title}</div>
      {props.desc && <div className="pg-desc">{props.desc}</div>}
      {props.children}
    </div>
  );
}

/** Слайдер со значением (04 §1.8). */
export function SliderRow(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <PRow label={props.label}>
      <input
        type="range"
        className="st-range"
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
      <span className="num" style={{ fontSize: 12, color: 'var(--text2)', width: 42, textAlign: 'right' }}>
        {props.value}
        {props.suffix ?? ''}
      </span>
    </PRow>
  );
}

/** Иконка-кнопка копирования с подтверждением. */
export function CopyButton(props: { text: string; onCopied?: () => void; title?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="icon-btn"
      title={props.title ?? 'Копировать'}
      onClick={async () => {
        if (await copyText(props.text)) {
          setDone(true);
          props.onCopied?.();
          setTimeout(() => setDone(false), 1500);
        }
      }}
    >
      {done ? <Check size={15} strokeWidth={1.8} /> : <Copy size={15} strokeWidth={1.8} />}
    </button>
  );
}

/** DA-тумблер: Нет [switch] Да (структура из скринов DonationAlerts). */
export function SwitchYN(props: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.value}
      className={`switch ${props.value ? 'on' : ''}`}
      onClick={() => props.onChange(!props.value)}
    />
  );
}

/** Кастомный дропдаун вместо нативного select (у option нет дизайна). */
export function Pick(props: { value: string; onChange: (v: string) => void; options: Array<{ value: string; label: ReactNode }>; label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open ]);
  const cur = props.options.find((o) => o.value === props.value);
  return (
    <div className="pick" ref={ref}>
      <button type="button" className="pick-btn" aria-haspopup="listbox" aria-expanded={open}
        aria-label={props.label} onClick={() => setOpen((o) => !o)}>
        <span>{cur?.label ?? props.value}</span>
        <ChevronDown size={13} strokeWidth={2} />
      </button>
      {open && (
        <div className="pick-pop" role="listbox" aria-label={props.label}>
          {props.options.map((o) => (
            <button key={o.value} type="button" role="option" aria-selected={o.value === props.value}
              className={`pick-opt${o.value === props.value ? ' on' : ''}`}
              onClick={() => { props.onChange(o.value); setOpen(false); }}>
              <span className="pick-tick">{o.value === props.value && <Check size={13} strokeWidth={2.2} />}</span>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Кольцо прогресса цели (как «Активные цели сбора» в DA). */
export function Ring(props: { value: number; max: number; size?: number; children?: ReactNode }) {
  const size = props.size ?? 132;
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const pct = props.max > 0 ? Math.min(1, props.value / props.max) : 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#2a2a2e" strokeWidth="6" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="var(--chart)" strokeWidth="6" strokeLinecap="round"
        strokeDasharray={`${c * pct} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dasharray .3s ease' }}
      />
      {props.children && (
        <foreignObject x={0} y={0} width={size} height={size}>
          <div className="ring-wrap" style={{ height: size, justifyContent: 'center' }}>
            {props.children}
          </div>
        </foreignObject>
      )}
    </svg>
  );
}

/** График «Динамика»: заполняет контейнер (ширина и высота), ховер с тултипом. */
export function Sparkline(props: { points: { label: string; value: number }[]; height?: number }) {
  const { points } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const w = size.w;
  const height = size.h || 260;

  const n = points.length;
  const padL = 10, padR = 10, padT = 18, padB = 26;
  const innerW = Math.max(50, w - padL - padR);
  const max = Math.max(1, ...points.map((p) => p.value));
  const step = n > 1 ? innerW / (n - 1) : 0;
  const x = (i: number) => padL + i * step;
  const y = (v: number) => padT + (1 - v / max) * (height - padT - padB);
  const coords = points.map((p, i) => [x(i), y(p.value)] as const);
  let path = '';
  coords.forEach(([cx, cy], i) => {
    if (i === 0) {
      path += `M${cx.toFixed(1)},${cy.toFixed(1)}`;
      return;
    }
    const [px, py] = coords[i - 1];
    const mx = ((px + cx) / 2).toFixed(1);
    path += ` C${mx},${py.toFixed(1)} ${mx},${cy.toFixed(1)} ${cx.toFixed(1)},${cy.toFixed(1)}`;
  });
  const area = n > 1
    ? `${path} L${x(n - 1).toFixed(1)},${height - padB} L${x(0).toFixed(1)},${height - padB} Z`
    : '';
  const labelEvery = n <= 10 ? 1 : Math.ceil(n / 8);

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    if (n === 0 || step === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.round((e.clientX - rect.left - padL) / step);
    setHover(Math.min(n - 1, Math.max(0, i)));
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', height: '100%', minHeight: 220 }}>
      {w > 0 && n > 0 && (
        <svg
          width={w} height={height}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
          style={{ display: 'block', cursor: 'crosshair' }}
        >
          <defs>
            <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e6e6e9" stopOpacity=".2" />
              <stop offset="100%" stopColor="#e6e6e9" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((k) => (
            <line key={k} x1={padL} x2={w - padR}
              y1={padT + (height - padT - padB) * k} y2={padT + (height - padT - padB) * k}
              stroke="var(--line)" strokeWidth="1" />
          ))}
          {n > 1 && <path d={area} fill="url(#spark)" />}
          {n > 1 && <path d={path} fill="none" stroke="var(--chart)" strokeWidth="2" />}
          {hover !== null && (
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={height - padB} stroke="var(--line2)" strokeWidth="1" />
          )}
          {coords.map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r={hover === i ? 4 : 2.5} fill="var(--chart)"
              opacity={hover === null || hover === i ? 1 : .55} />
          ))}
          {hover !== null && (
            <circle cx={x(hover)} cy={y(points[hover].value)} r="5" fill="#0b0b0c"
              stroke="var(--chart)" strokeWidth="2" />
          )}
          {points.map((p, i) => (i % labelEvery === 0 || i === n - 1) && (
            <text key={i} x={x(i)} y={height - 6} textAnchor="middle" fontSize="10" fill="var(--text4)">
              {p.label}
            </text>
          ))}
        </svg>
      )}
      {hover !== null && (
        <div
          className="chart-tip"
          style={{ left: Math.min(Math.max(x(hover), 70), w - 70), top: Math.max(4, y(points[hover].value) - 14) }}
        >
          <div className="d">{points[hover].label}</div>
          <div style={{ fontWeight: 600 }}>{points[hover].value} ₽</div>
        </div>
      )}
    </div>
  );
}
