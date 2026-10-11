import { confirmTotals } from '../data/provider';
import { getProvider } from '../data/providerSwitch';
import { getMockProvider } from '../data/mock/MockProvider';
import type { Config } from '../data/types';

/** Индикатор цели в оверлее (06 §9): confirmed-only с boundary.
 *  Вид как у стримеров: заголовок прописными + тёмная полоса с текстом «500 / 100 000 RUB (1%)».
 *  progress — серверная сумма для виджета #/goal (иначе считается из локальной ленты). */
export default function GoalBar({ cfg, progress: progressOverride }: { cfg: Config; progress?: number }) {
  if (!cfg.goalEnabled) return null;
  const provider = getProvider();
  const progress = progressOverride ?? confirmTotals(
    provider.listDonations().filter((d) => d.ts >= cfg.goalBoundary),
  ).sum;
  const percent = cfg.goalTarget > 0
    ? Math.min(100, Math.round((progress / cfg.goalTarget) * 100))
    : 0;
  const title = cfg.goalTitle.toUpperCase();
  const text = cfg.goalBarText
    .replace('{собрано}', progress.toLocaleString('ru-RU'))
    .replace('{цель}', cfg.goalTarget.toLocaleString('ru-RU'))
    .replace('{процент}', String(percent));

  return (
    <div className="ov-goal">
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textAlign: 'center', marginBottom: 6 }}>
        {title}
      </div>
      <div className="ov-goalbar">
        <div className="ov-goalbar-fill" style={{ width: `${percent}%` }} />
        <span className="ov-goalbar-accent" style={{ background: cfg.goalBarAccent }} />
        <span className="ov-goalbar-text num">{text}</span>
      </div>
    </div>
  );
}
