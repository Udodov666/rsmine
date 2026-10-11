import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Небольшой presence-контейнер без тяжёлой animation-зависимости:
 * сначала аккуратно выводит старую страницу, затем вводит новую.
 */
export function PageTransition(props: { pageKey: string; children: ReactNode }) {
  const [shown, setShown] = useState({ key: props.pageKey, node: props.children });
  const [phase, setPhase] = useState<'idle' | 'exit' | 'enter'>('idle');
  const next = useRef({ key: props.pageKey, node: props.children });

  next.current = { key: props.pageKey, node: props.children };

  useEffect(() => {
    if (shown.key === props.pageKey) return;
    setPhase('exit');
    const swap = window.setTimeout(() => {
      setShown(next.current);
      setPhase('enter');
      requestAnimationFrame(() => requestAnimationFrame(() => setPhase('idle')));
    }, 130);
    return () => window.clearTimeout(swap);
  }, [props.pageKey, shown.key]);

  const node = shown.key === props.pageKey && phase === 'idle' ? props.children : shown.node;
  return (
    <div className={`page-transition is-${phase}`} aria-live="polite">
      {node}
    </div>
  );
}