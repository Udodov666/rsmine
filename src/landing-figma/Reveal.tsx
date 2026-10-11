import { motion, useReducedMotion } from 'motion/react';
import type { CSSProperties, ReactNode } from 'react';

/** Дорогое скролл-появление: мягкий подъём + проявление, срабатывает один раз.
 *  Трансформации только на этом div — position: sticky внутри восстанавливается
 *  после завершения (motion убирает transform в identity). */
export function Reveal({
  children,
  delay = 0,
  y = 28,
  scale,
  duration = 0.9,
  className,
  style,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  scale?: number;
  duration?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const reduce = useReducedMotion();
  const hidden = reduce
    ? false
    : { opacity: 0, y, ...(scale !== undefined ? { scale } : {}) };
  const shown = { opacity: 1, y: 0, ...(scale !== undefined ? { scale: 1 } : {}) };
  return (
    <motion.div
      className={className}
      style={style}
      initial={hidden}
      whileInView={reduce ? undefined : shown}
      viewport={{ once: true, margin: '0px 0px -90px 0px' }}
      transition={{ duration, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
