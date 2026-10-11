/**
 * Визуальные эффекты донатов (конфетти, сердечки, вспышка).
 * runEffect(code, host, alertEl) проигрывает эффект внутри host
 * (позиционный контейнер: мини-сцена на вкладке или весь экран в оверлее).
 * Конфетти — залп веером вверх из верхней грани алерта («хлопушка»),
 * физика с сопротивлением воздуха и трепетом, масштаб от размера сцены.
 */

export interface EffectMeta {
  code: string;
  name: string;
  hint: string;
  /** длительность демо, мс — для подсветки кнопки */
  durationMs: number;
}

export const EFFECT_META: EffectMeta[] = [
  { code: 'confetti', name: 'Конфетти', hint: 'Салют конфетти по всей сцене из алерта', durationMs: 3400 },
  { code: 'hearts', name: 'Сердечки', hint: 'Туча сердечек всплывает снизу сцены', durationMs: 2800 },
  { code: 'flash', name: 'Вспышка', hint: 'Яркая двойная вспышка на всю сцену', durationMs: 900 },
];

const CONFETTI_COLORS = ['#f7941d', '#b36bf5', '#17d985', '#e5484d', '#5E9FE8', '#f2f2f2'];

function makeLayer(host: HTMLElement): HTMLElement {
  const layer = document.createElement('div');
  // host = body (полноэкранный показ в панели) → fixed; иначе позиционный контейнер
  const fixed = host === document.body;
  layer.style.cssText =
    (fixed ? 'position:fixed;' : 'position:absolute;') +
    'inset:0;overflow:hidden;pointer-events:none;z-index:2000;';
  host.appendChild(layer);
  return layer;
}

function confetti(layer: HTMLElement, alertEl: HTMLElement | null) {
  const host = layer.parentElement as HTMLElement;
  const w = host.clientWidth;
  const h = host.clientHeight;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, w * devicePixelRatio);
  canvas.height = Math.max(1, h * devicePixelRatio);
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
  layer.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(devicePixelRatio, devicePixelRatio);

  // физика масштабируется от сцены, но с потолками — чтобы и в мини-сцене,
  // и на весь экран выглядело одинаково естественно
  const speedBase = Math.min(h, 300);
  const gravity = Math.min(h, 500) * 1.8;

  // залпы по всей сцене: 7 хлопушек от края до края + главная из алерта
  const bursts: Array<{ x: number; y: number; count: number; delay: number }> = [];
  if (alertEl) {
    const hr = host.getBoundingClientRect();
    const ar = alertEl.getBoundingClientRect();
    bursts.push({
      x: ar.left - hr.left + ar.width / 2,
      y: ar.top - hr.top + 2,
      count: 90,
      delay: 0,
    });
  }
  for (let i = 0; i < 7; i++) {
    bursts.push({
      x: w * (0.06 + 0.147 * i),
      y: h * (0.72 + Math.random() * 0.1),
      count: 55,
      delay: 120 + i * 80,
    });
  }

  interface P {
    x: number; y: number; vx: number; vy: number;
    w: number; h2: number; rot: number; vr: number;
    color: string; drag: number; life: number; phase: number; born: number;
  }
  const parts: P[] = [];
  const spawn = (bx: number, by: number, count: number, born: number) => {
    for (let i = 0; i < count; i++) {
      const ang = ((40 + Math.random() * 92) * Math.PI) / 180; // веер 40–132° — только вверх
      const sp = speedBase * (2.4 + Math.random() * 2.4);
      parts.push({
        x: bx + (Math.random() - 0.5) * 36,
        y: by,
        vx: Math.cos(ang) * sp,
        vy: -Math.sin(ang) * sp,
        w: 7 + Math.random() * 5,
        h2: 4 + Math.random() * 3,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 12,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        drag: 1.5 + Math.random() * 0.8,
        life: 1900 + Math.random() * 1000,
        phase: Math.random() * Math.PI * 2,
        born,
      });
    }
  };
  bursts.forEach((b) => spawn(b.x, b.y, b.count, b.delay));

  let prev = performance.now();
  const t0 = prev;
  const maxLife = 3700;
  // предохранитель: слой снимается по таймауту, даже если rAF не тикает (скрытая вкладка)
  setTimeout(() => layer.remove(), maxLife + 500);
  const tick = (t: number) => {
    const dt = Math.min(0.05, (t - prev) / 1000);
    prev = t;
    ctx.clearRect(0, 0, w, h);
    let alive = false;
    for (const p of parts) {
      const age = t - t0 - p.born;
      if (age < 0) { alive = true; continue; }
      if (age > p.life) continue;
      alive = true;
      // воздух тормозит полёт, гравитация тянет вниз — подъём гаснет, конфетти трепеща оседает
      const dragF = Math.exp(-p.drag * dt);
      p.vx *= dragF;
      p.vy = p.vy * dragF + gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.phase += 7 * dt;
      const fade = age > p.life - 450 ? Math.max(0, (p.life - age) / 450) : 1;
      // трепет: ширина «дышит» — эффект переворота в воздухе
      const flutter = 0.35 + 0.65 * Math.abs(Math.sin(p.phase));
      ctx.globalAlpha = fade;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, flutter);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h2 / 2, p.w, p.h2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    if (t - t0 < maxLife && alive) {
      requestAnimationFrame(tick);
    } else {
      layer.remove();
    }
  };
  requestAnimationFrame(tick);
}

function hearts(layer: HTMLElement) {
  const host = layer.parentElement as HTMLElement;
  const w = host.clientWidth;
  const N = 32;
  for (let i = 0; i < N; i++) {
    const s = document.createElement('span');
    s.textContent = '❤️';
    const size = 12 + Math.random() * 18;
    s.style.cssText = `position:absolute;left:${2 + Math.random() * (w - 4)}px;bottom:-26px;` +
      `font-size:${size}px;will-change:transform,opacity;--sway:${Math.round(Math.random() * 44 - 22)}px;` +
      `animation:fx-float-up ${1400 + Math.random() * 1300}ms ease-in ${i * 45}ms forwards;`;
    s.addEventListener('animationend', () => s.remove());
    layer.appendChild(s);
  }
  // слой живёт дольше всех сердечек
  setTimeout(() => layer.remove(), 3400);
}

function flash(layer: HTMLElement) {
  const f = document.createElement('div');
  f.style.cssText = 'position:absolute;inset:0;background:#fff;opacity:0;' +
    'animation:fx-flash 900ms ease-out forwards;';
  f.addEventListener('animationend', () => layer.remove());
  layer.appendChild(f);
}

/** Проигрывает эффект внутри host. host должен быть position:relative/fixed. */
export function runEffect(code: string, host: HTMLElement | null, alertEl?: HTMLElement | null) {
  if (!host) return;
  const layer = makeLayer(host);
  if (code === 'confetti') confetti(layer, alertEl ?? null);
  else if (code === 'hearts') hearts(layer);
  else if (code === 'flash') flash(layer);
  else layer.remove();
}
