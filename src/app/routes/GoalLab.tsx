import { getMockProvider } from '../../data/mock/MockProvider';
import { confirmTotals } from '../../data/provider';
import { money } from '../../lib/format';

/** Лаборатория цели: 5 вариантов плитки на живых данных. Временный инструмент. */
export default function GoalLab() {
  const provider = getMockProvider();
  const cfg = provider.getConfig();
  const donations = provider.listDonations().filter((d) => d.kind === 'donate');
  const hasGoal = !!cfg.goalTitle;
  const progress = confirmTotals(donations.filter((d) => d.ts >= cfg.goalBoundary)).sum;
  const percent = hasGoal && cfg.goalTarget > 0 ? Math.min(100, Math.max(0, (progress / cfg.goalTarget) * 100)) : 0;
  const done = hasGoal && progress >= cfg.goalTarget;
  const stateText = !hasGoal ? 'цель не создана' : !cfg.goalEnabled ? 'на паузе' : done ? 'достигнута' : `осталось ${money(Math.max(0, cfg.goalTarget - progress))}`;
  const name = hasGoal ? cfg.goalTitle : 'На что собираем?';

  return (
    <div className="stlab">
      <h1 className="page-h1">Лаборатория цели</h1>
      <div className="page-sub">5 вариантов плитки цели на твоей реальной цели. Показано активное состояние; пауза/пусто — докрутим у победителя.</div>

      <section className="card gl-demo">
        <div className="sec-head"><div className="card-title">Вариант 1 — текущий (кольцо)</div></div>
        <div className="goal-mini-widget">
          <span className="goal-mini-copy">
            <span className="goal-mini-amount num">{hasGoal ? <>{money(progress)} <span>/ {money(cfg.goalTarget)}</span></> : '+'}</span>
            <span className="goal-mini-name">{hasGoal ? <>{name} <span>· {stateText}</span></> : 'На что собираем?'}</span>
          </span>
          <span className="goal-mini-progress" role="img" aria-label={`Прогресс цели ${Math.round(percent)} процентов`}>
            <svg viewBox="0 0 80 80" aria-hidden="true"><defs><linearGradient id="goal-ring-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3ce88b" /><stop offset="1" stopColor="#0da453" /></linearGradient></defs><circle cx="40" cy="40" r="33" className="goal-mini-track" /><circle cx="40" cy="40" r="33" className="goal-mini-fill" stroke="url(#goal-ring-grad)" pathLength="100" strokeDasharray={`${percent} 100`} transform="rotate(-90 40 40)" /></svg>
            <span className="num">{hasGoal ? `${Math.round(percent)}%` : ''}</span>
          </span>
        </div>
      </section>

      <section className="card gl-demo">
        <div className="sec-head"><div className="card-title">Вариант 2 — Adsome: полоса + строка</div></div>
        <div className="gl-adsome">
          <div className="sl-a-head"><span className="sl-tick" aria-hidden="true" /><span className="sl-label">{name}</span></div>
          <div className="sl-hero num">{hasGoal ? `${Math.round(percent)}%` : '—'}</div>
          <div className="gl-bar" aria-hidden="true"><span style={{ width: `${percent}%` }} /></div>
          <div className="gl-foot">
            <span className="num">{hasGoal ? <>{money(progress)} <span>из {money(cfg.goalTarget)}</span></> : '—'}</span>
            <span className="sl-note">{stateText}</span>
          </div>
        </div>
      </section>

      <section className="card gl-demo">
        <div className="sec-head"><div className="card-title">Вариант 3 — Sypher: кепс + метка цели</div></div>
        <div className="gl-sypher">
          <div className="sl-eyebrow">Цель сбора · {name}</div>
          <div className="sl-hero num">{hasGoal ? `${Math.round(percent)}%` : '—'}</div>
          <div className="gl-track" aria-hidden="true">
            <span className="gl-fill" style={{ width: `${percent}%` }} />
            <span className="gl-target" title={`Цель ${hasGoal ? money(cfg.goalTarget) : '—'}`} />
          </div>
          <div className="gl-foot num">
            <span>собрано {hasGoal ? money(progress) : '—'}</span>
            <span>цель {hasGoal ? money(cfg.goalTarget) : '—'}</span>
          </div>
        </div>
      </section>

      <section className="card gl-demo">
        <div className="sec-head"><div className="card-title">Вариант 4 — Raxon: пилюля статуса</div></div>
        <div className="gl-raxon">
          <div className="sl-hero num">{hasGoal ? <>{money(progress)} <span>/ {money(cfg.goalTarget)}</span></> : '—'}</div>
          <div className="gl-raxon-row">
            <span className="sl-label">{name}</span>
            <span className={`gl-pill${done ? ' is-done' : ''}`}>{stateText}</span>
          </div>
          <div className="gl-bar gl-bar-tall" aria-hidden="true"><span style={{ width: `${percent}%` }} /></div>
        </div>
      </section>

      <section className="card gl-demo">
        <div className="sec-head"><div className="card-title">Вариант 5 — Radial: пунктирное кольцо</div></div>
        <div className="gl-radial">
          <span className="gl-ring" role="img" aria-label={`Прогресс цели ${Math.round(percent)} процентов`}>
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <circle cx="60" cy="60" r="52" className="gl-ring-track" pathLength="100" strokeDasharray="2.2 3.4" transform="rotate(-90 60 60)" />
              <circle cx="60" cy="60" r="52" className="gl-ring-fill" pathLength="100" strokeDasharray={dashFor(percent)} strokeLinecap="round" transform="rotate(-90 60 60)" />
            </svg>
            <span className="gl-ring-center"><span className="num">{hasGoal ? `${Math.round(percent)}%` : '—'}</span><span>{stateText}</span></span>
          </span>
          <span className="gl-legend">
            <span><i className="is-got" />собрано <b className="num">{hasGoal ? money(progress) : '—'}</b></span>
            <span><i className="is-left" />цель <b className="num">{hasGoal ? money(cfg.goalTarget) : '—'}</b></span>
          </span>
        </div>
      </section>
    </div>
  );
}

/** Пунктирная дуга прогресса: сегменты 2.2/3.4 ровно на percent, дальше пустота. */
function dashFor(p: number): string {
  if (p <= 0) return '0 100';
  if (p >= 100) return '100 0';
  const segs: string[] = [];
  let used = 0;
  while (used + 5.6 <= p) {
    segs.push('2.2 3.4');
    used += 5.6;
  }
  const rest = p - used;
  segs.push(rest > 0.4 ? `${rest.toFixed(1)} ${(100 - p).toFixed(1)}` : `${(100 - p).toFixed(1)}`);
  return segs.join(' ');
}
