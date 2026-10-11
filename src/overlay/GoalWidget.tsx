import { useEffect, useState } from 'react';
import { apiBase } from '../data/live/auth';
import type { Config } from '../data/types';
import GoalBar from './GoalBar';

interface GoalData {
  enabled: boolean;
  title: string;
  target: number;
  progress: number;
  accent: string;
  barText: string;
}

/**
 * Отдельный виджет цели для OBS (второй browser source 1920×1080).
 * Прозрачный фон, только полоса. Прогресс — честная серверная сумма
 * реестра от goalBoundary, опрос каждые 15 сек. Без активной цели —
 * пусто (источник невидим).
 */
export default function GoalWidget({ slug }: { slug: string }) {
  const [goal, setGoal] = useState<GoalData | null>(null);

  useEffect(() => {
    document.body.classList.add('is-overlay');
    const html = document.documentElement;
    const prevBg = html.style.background;
    html.style.background = 'transparent';
    return () => {
      document.body.classList.remove('is-overlay');
      html.style.background = prevBg;
    };
  }, []);

  useEffect(() => {
    let on = true;
    const load = () => {
      fetch(`${apiBase()}/api/goal/${encodeURIComponent(slug)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { goal?: GoalData | null } | null) => {
          if (!on) return;
          setGoal(data?.goal ?? null);
        })
        .catch(() => { /* офлайн — оставляем последнее */ });
    };
    load();
    const t = window.setInterval(load, 15000);
    return () => {
      on = false;
      window.clearInterval(t);
    };
  }, [slug]);

  if (!goal || !goal.enabled) return <div className="ov-root" />;

  // минимальный конфиг для GoalBar: полоса + серверный прогресс
  const cfg = {
    goalEnabled: true,
    goalTitle: goal.title,
    goalTarget: goal.target,
    goalBarText: goal.barText,
    goalBarAccent: goal.accent,
    goalBoundary: 0,
  } as unknown as Config;

  return (
    <div className="ov-root">
      <div className="ov-goal-widget">
        <GoalBar cfg={cfg} progress={goal.progress} />
      </div>
    </div>
  );
}
