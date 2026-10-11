import { ArrowUp, ArrowUpRight, Calendar, CalendarRange, ChevronsDown, ChevronsUp, Coins, Crown, Gem, HandCoins, Medal, MoveUpRight, TrendingUp, Trophy, Wallet } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faAnglesUp, faArrowTrendUp, faArrowUp, faCaretUp, faCoins as faCoinsFa, faCrown as faCrownFa, faGem as faGemFa, faHandHoldingDollar, faMoneyBillWave, faSackDollar } from '@fortawesome/free-solid-svg-icons';
import { getMockProvider } from '../../data/mock/MockProvider';
import { confirmTotals } from '../../data/provider';
import type { Donation } from '../../data/types';
import { money, startOfToday } from '../../lib/format';

/** Лаборатория статистики: 4 варианта плиток на живых данных. Временный инструмент. */
export default function StatLab() {
  const provider = getMockProvider();
  const all = provider.listDonations();
  const donations = all.filter((d) => d.kind === 'donate');
  const finished = donations.filter((d) => d.status === 'finished');

  const todayStart = startOfToday();
  const now = Date.now();
  const since7 = now - 7 * 86400_000;
  const todaySum = sumIn(finished, todayStart, now);
  const ydaySum = sumIn(finished, todayStart - 86400_000, todayStart);
  const weekSum = sumIn(finished, since7, now);
  const prevWeekSum = sumIn(finished, since7 - 7 * 86400_000, since7);
  const allSum = confirmTotals(donations).sum;
  const biggest = finished.reduce<Donation | null>((acc, d) => (!acc || d.shownSum > acc.shownSum ? d : acc), null);
  const minTs = finished.reduce((m, d) => Math.min(m, d.ts), now);

  const tiles = [
    { key: 'today', label: 'Сегодня', cap: 'за сегодня', sum: todaySum, prev: ydaySum, prevNote: 'ко вчера', series: buckets(finished, todayStart, 6), icon: <Calendar size={15} strokeWidth={1.8} /> },
    { key: 'week', label: '7 дней', cap: 'за 7 дней', sum: weekSum, prev: prevWeekSum, prevNote: 'к прошлым 7 дням', series: buckets(finished, since7, 7), icon: <CalendarRange size={15} strokeWidth={1.8} /> },
    { key: 'all', label: 'Всё время', cap: 'за всё время', sum: allSum, prev: null as number | null, prevNote: '', series: buckets(finished, minTs, 8), icon: <Wallet size={15} strokeWidth={1.8} /> },
  ];

  return (
    <div className="stlab">
      <h1 className="page-h1">Лаборатория статистики</h1>
      <div className="page-sub">4 варианта плиток на живых данных тёмной темы. Выберешь — перенесу в дашборд.</div>

      <section className="card">
        <div className="sec-head"><div className="card-title">Вариант A — Adsome: абсолютные дельты</div></div>
        <div className="sl-row">
          {tiles.map((t) => (
            <div className="sl-a" key={t.key}>
              <div className="sl-a-head"><span className="sl-tick" aria-hidden="true" /><span className="sl-label">{t.label}</span></div>
              <div className="sl-hero num">{money(t.sum)}</div>
              <div className="sl-a-foot">
                {t.prev !== null ? <AbsDelta cur={t.sum} prev={t.prev} /> : <span className="sl-record"><FontAwesomeIcon icon={faSackDollar} /><span className="num">{biggest ? money(biggest.shownSum) : money(0)}</span></span>}
                <span className="sl-note">{t.prev !== null ? t.prevNote : 'крупнейший донат'}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="sec-head"><div className="card-title">Вариант B — Sypher: полосы периода</div></div>
        <div className="sl-row">
          {tiles.map((t) => (
            <div className="sl-b" key={t.key}>
              <div className="sl-eyebrow">{t.cap}</div>
              <div className="sl-hero num">{money(t.sum)}</div>
              <div className="sl-bars" aria-hidden="true">
                {t.series.map((v, i) => (
                  <span key={i} style={{ height: `${8 + (v / Math.max(...t.series, 1)) * 92}%` }} className={v === Math.max(...t.series) && v > 0 ? 'is-max' : undefined} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="sec-head"><div className="card-title">Вариант C — Raxon: спарклайн</div></div>
        <div className="sl-row">
          {tiles.map((t) => (
            <div className="sl-c" key={t.key}>
              <div className="sl-c-head"><span className="sl-chip" aria-hidden="true">{t.icon}</span><span className="sl-label">{t.label}</span></div>
              <div className="sl-c-body">
                <div>
                  <div className="sl-hero num">{money(t.sum)}</div>
                  <div className="sl-vs">{t.prev !== null ? <SignedDelta cur={t.sum} prev={t.prev} note={t.prevNote} /> : <span className="sl-note">за {t.cap}</span>}</div>
                </div>
                <Micro data={t.series} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="sec-head"><div className="card-title">Вариант D — Дуо-сплит: две половины</div></div>
        <div className="sl-row">
          {tiles.map((t) => (
            <DuoTile key={t.key} label={t.label} sum={t.sum} series={t.series} />
          ))}
        </div>
      </section>

      <section className="card">
        <div className="sec-head"><div className="card-title">Иконка рекорда — lucide, 6 вариантов</div></div>
        <div className="sl-icons">
          {[
            { Icon: Trophy, name: 'кубок' },
            { Icon: HandCoins, name: 'рука с монетой' },
            { Icon: Coins, name: 'монеты' },
            { Icon: Gem, name: 'алмаз' },
            { Icon: Crown, name: 'корона' },
            { Icon: Medal, name: 'медаль' },
          ].map(({ Icon, name }) => (
            <span className="sl-icon-pick" key={name}>
              <span className="sl-record"><Icon size={13} strokeWidth={2} /><span className="num">{biggest ? money(biggest.shownSum) : money(0)}</span></span>
              <span>{name}</span>
            </span>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="sec-head"><div className="card-title">Иконка рекорда — font awesome, 6 вариантов</div></div>
        <div className="sl-icons">
          {[
            { icon: faSackDollar, name: 'мешок денег' },
            { icon: faHandHoldingDollar, name: 'рука с долларом' },
            { icon: faMoneyBillWave, name: 'купюра' },
            { icon: faCoinsFa, name: 'монеты' },
            { icon: faCrownFa, name: 'корона' },
            { icon: faGemFa, name: 'алмаз' },
          ].map(({ icon, name }) => (
            <span className="sl-icon-pick" key={name}>
              <span className="sl-record"><FontAwesomeIcon icon={icon} /><span className="num">{biggest ? money(biggest.shownSum) : money(0)}</span></span>
              <span>{name}</span>
            </span>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="sec-head"><div className="card-title">Стрелка роста — варианты</div></div>
        <div className="sl-icons">
          {[
            { name: 'тренд', node: <TrendingUp size={13} strokeWidth={2} /> },
            { name: 'вверх-вправо', node: <ArrowUpRight size={13} strokeWidth={2} /> },
            { name: 'вверх', node: <ArrowUp size={13} strokeWidth={2} /> },
            { name: 'двойной шеврон', node: <ChevronsUp size={13} strokeWidth={2} /> },
            { name: 'диагональ', node: <MoveUpRight size={13} strokeWidth={2} /> },
            { name: 'fa-тренд', node: <FontAwesomeIcon icon={faArrowTrendUp} /> },
            { name: 'fa-стрелка', node: <FontAwesomeIcon icon={faArrowUp} /> },
            { name: 'fa-двойная', node: <FontAwesomeIcon icon={faAnglesUp} /> },
            { name: 'fa-каретка', node: <FontAwesomeIcon icon={faCaretUp} /> },
          ].map(({ name, node }) => (
            <span className="sl-icon-pick" key={name}>
              <span className="sl-delta up"><span className="sl-arrow">{node}</span><span className="num">{signed(weekSum - prevWeekSum)}</span></span>
              <span>{name}</span>
            </span>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="sec-head"><div className="card-title">Вариант E — оставить как есть</div></div>
        <div className="sl-note">Текущие плитки с иконками-плашками. Ничего не делать.</div>
      </section>
    </div>
  );
}

function sumIn(list: Donation[], from: number, to: number): number {
  return list.filter((d) => d.ts >= from && d.ts < to).reduce((s, d) => s + d.shownSum, 0);
}

function buckets(list: Donation[], since: number, n: number): number[] {
  const now = Date.now();
  const out = new Array<number>(n).fill(0);
  const span = Math.max(1, now - since);
  for (const d of list) {
    if (d.ts < since) continue;
    const i = Math.min(n - 1, Math.floor(((d.ts - since) / span) * n));
    out[i] += d.shownSum;
  }
  return out;
}

function signed(n: number): string {
  if (n > 0) return money(n);
  if (n < 0) return `−${money(Math.abs(n))}`;
  return money(0);
}

function AbsDelta({ cur, prev }: { cur: number; prev: number }) {
  const diff = cur - prev;
  const dir = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
  const Icon = diff < 0 ? ChevronsDown : ChevronsUp;
  return (
    <span className={`sl-delta ${dir}`}>
      <Icon size={13} strokeWidth={2} />
      <span className="num">{signed(diff)}</span>
    </span>
  );
}

function SignedDelta({ cur, prev, note }: { cur: number; prev: number; note: string }) {
  const diff = cur - prev;
  const dir = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
  return <span className={`sl-inline-delta ${dir}`}><span className="num">{signed(diff)}</span> {note}</span>;
}

function Micro({ data }: { data: number[] }) {
  const w = 104;
  const h = 38;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => `${((i / (data.length - 1)) * w).toFixed(1)},${(h - 4 - (v / max) * (h - 10)).toFixed(1)}`).join(' ');
  const lastX = w;
  const lastY = h - 4 - ((data[data.length - 1] ?? 0) / max) * (h - 10);
  return (
    <svg className="sl-micro" viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true">
      <polygon points={`0,${h} ${pts} ${w},${h}`} className="sl-micro-area" />
      <polyline points={pts} className="sl-micro-line" />
      <circle cx={lastX - 1} cy={lastY} r="2.5" className="sl-micro-dot" />
    </svg>
  );
}

function DuoTile({ label, sum, series }: { label: string; sum: number; series: number[] }) {
  const half = Math.floor(series.length / 2);
  const first = series.slice(0, half).reduce((s, v) => s + v, 0);
  const second = series.slice(half).reduce((s, v) => s + v, 0);
  const total = first + second;
  const w2 = total > 0 ? Math.round((second / total) * 100) : 50;
  return (
    <div className="sl-d">
      <div className="sl-label">{label}</div>
      <div className="sl-hero num">{money(sum)}</div>
      <div className="sl-duo" aria-hidden="true">
        <span style={{ width: `${100 - w2}%` }} className="is-old" />
        <span style={{ width: `${w2}%` }} className="is-new" />
      </div>
      <div className="sl-duo-legend num">
        <span>{money(first)}</span>
        <span>{money(second)}</span>
      </div>
    </div>
  );
}
