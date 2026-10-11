import { useEffect, useRef, useState } from 'react';
import { money } from '../lib/format';

const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

/** Счётчик в стиле React Bits CountUp: число всплывает от нуля, когда элемент
 *  попадает на экран. Живые обновления значения доигрывают с текущего числа,
 *  а не с нуля (панель обновляется демо-донатами). Уважает reduced motion. */
export function CountUp({
  to,
  duration = 1400,
  format = money,
  className,
}: {
  to: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(0);
  const current = useRef(0);
  const started = useRef(false);
  const raf = useRef(0);
  const toRef = useRef(to);
  toRef.current = to;
  const durationRef = useRef(duration);
  durationRef.current = duration;

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      started.current = true;
      current.current = toRef.current;
      setShown(toRef.current);
      return;
    }
    const animate = () => {
      const target = toRef.current;
      const from = current.current;
      const start = performance.now();
      const dur = from === 0 ? durationRef.current : 700;
      cancelAnimationFrame(raf.current);
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / dur);
        const v = from + (target - from) * easeOutExpo(t);
        current.current = v;
        setShown(v);
        if (t < 1) raf.current = requestAnimationFrame(step);
      };
      raf.current = requestAnimationFrame(step);
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || started.current) return;
        started.current = true;
        io.disconnect();
        animate();
      },
      { rootMargin: '0px 0px -60px 0px' },
    );
    if (ref.current) io.observe(ref.current);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf.current);
    };
  }, []);

  useEffect(() => {
    if (!started.current) return;
    const target = to;
    const from = current.current;
    if (from === target) return;
    const start = performance.now();
    const dur = 700;
    cancelAnimationFrame(raf.current);
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const v = from + (target - from) * easeOutExpo(t);
      current.current = v;
      setShown(v);
      if (t < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [to]);

  return (
    <span ref={ref} className={className}>
      {format(shown)}
    </span>
  );
}
