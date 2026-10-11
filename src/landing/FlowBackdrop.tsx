import { useEffect, useRef } from 'react';

/** Local decorative canvas, independent of the app. No images, services or user data. */
export default function FlowBackdrop({ variant = 'hero', paused = false }: { variant?: 'hero' | 'footer'; paused?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const phase = useRef(0);
  useEffect(() => {
    const el = canvas.current;
    const host = el?.parentElement;
    const ctx = el?.getContext('2d');
    if (!el || !host || !ctx) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    let width = 1, height = 1, frame = 0, visible = false, last = 0, time = phase.current;
    const dark = variant === 'footer';
    function draw(t: number) {
      ctx!.clearRect(0, 0, width, height);
      // Fine continuous strands rather than a colored card or a generic gradient.
      const count = width < 600 ? 22 : 38;
      for (let band = 0; band < 3; band++) {
        for (let i = 0; i < count; i++) {
          const depth = i / count;
          ctx!.beginPath();
          for (let k = 0; k <= 64; k++) {
            const u = k / 64;
            const x = (u * 1.24 - .12) * width;
            const wave = Math.sin(u * Math.PI * 2 * .78 + band * 1.9 + t * .21);
            const twist = Math.sin(u * Math.PI * 2 * 1.26 - t * .15 + depth * .62);
            const base = dark ? .48 : .53;
            const y = height * (base + band * .045) + wave * height * .17 + twist * height * .065 + (depth - .5) * height * .22 + (u - .5) ** 2 * height * .24;
            if (k === 0) ctx!.moveTo(x, y); else ctx!.lineTo(x, y);
          }
          const fade = .5 + .5 * Math.sin(depth * Math.PI);
          ctx!.strokeStyle = dark
            ? (band === 1 ? `rgba(112,159,136,${.115 * fade})` : `rgba(216,220,226,${.18 * fade})`)
            : (band === 1 ? `rgba(56,106,81,${.18 * fade})` : `rgba(85,92,103,${.16 * fade})`);
          ctx!.lineWidth = dark ? .8 : .85;
          ctx!.stroke();
        }
      }
      el!.dataset.frames = String(Number(el!.dataset.frames || 0) + 1);
    }
    function tick(now: number) {
      frame = 0;
      if (!visible || document.hidden || reduce.matches || paused || !dark) return;
      if (now - last >= 1000 / 24) {
        time += Math.min((now - (last || now)) / 1000, .1);
        phase.current = time;
        last = now;
        draw(time);
      }
      frame = requestAnimationFrame(tick);
    }
    function sync() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
      draw(time);
      if (visible && !document.hidden && !reduce.matches && !paused && dark) frame = requestAnimationFrame(tick);
    }
    function resize() {
      const box = host!.getBoundingClientRect();
      width = Math.max(1, box.width); height = Math.max(1, box.height);
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      el!.width = Math.round(width * ratio); el!.height = Math.round(height * ratio);
      ctx!.setTransform(ratio, 0, 0, ratio, 0, 0);
      sync();
    }
    const observer = new ResizeObserver(resize); observer.observe(host);
    const intersection = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); });
    intersection.observe(host);
    document.addEventListener('visibilitychange', sync);
    reduce.addEventListener('change', sync);
    resize();
    return () => { if (frame) cancelAnimationFrame(frame); observer.disconnect(); intersection.disconnect(); document.removeEventListener('visibilitychange', sync); reduce.removeEventListener('change', sync); };
  }, [variant, paused]);
  return <div className={`lp-flow lp-flow-${variant}`} aria-hidden="true"><canvas ref={canvas} aria-hidden="true" data-variant={variant}/></div>;
}
