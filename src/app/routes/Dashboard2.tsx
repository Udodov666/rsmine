import { useEffect, useMemo, useRef, useState } from 'react';
import { getProvider } from '../../data/providerSwitch';
import type { ReactNode } from 'react';
import rankGold from '../assets/rank-1.svg';
import rankSilver from '../assets/rank-2.svg';
import rankBronze from '../assets/rank-3.svg';
import { ArrowUpRight, Check, ChevronsDown, ChevronsUp, EyeOff, Pencil, Plus, Repeat } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHandHoldingDollar, faLink, faPlus, faRepeat, faSackDollar } from '@fortawesome/free-solid-svg-icons';
import { confirmTotals } from '../../data/provider';
import type { DataProvider } from '../../data/provider';
import { getMockProvider } from '../../data/mock/MockProvider';
import { avatarStyle, copyText, money, startOfToday } from '../../lib/format';
import { EmptyState, Sparkline, Tip } from '../../components/Bits';
import { maskBannedWords } from '../../lib/moderation';
import { CountUp } from '../../components/CountUp';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { Seg } from '../../components/Seg';
import { sendTestToOverlay } from '../../components/AlertPreview';
import { getTwitch, isAuthed } from '../../data/live/auth';
import { useToast } from '../../components/Toast';
import { navigate } from '../../router';
import type { Donation } from '../../data/types';

/**
 * Панель управления. Структура:
 * 1) строка ключевых цифр (сегодня / 7 дней / всего / средний);
 * 2) «Динамика» с рабочим переключателем периода и ховером + «Последние сообщения»;
 * 3) «Цель сбора» (если не создана — честный empty-state) + «Топ донатеров».
 */
export default function Dashboard2({ demoProvider, onPreview, previewSlot }: { demoProvider?: DataProvider; onPreview?: (d: Donation) => void; previewSlot?: ReactNode } = {}) {
  const provider = demoProvider ?? getProvider();
  const preview = onPreview ?? sendTestToOverlay;
  const toast = useToast();
  const [, force] = useState(0);
  const [range, setRange] = useState<'7' | '30'>('7');
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const unsub = provider.subscribe(() => force((v) => v + 1));
    return unsub;
  }, [provider]);

  // мини-версия vibe-анимации внутри стат-карточек (снято на время — вернём при необходимости)
  // useEffect(() => {
  //   const VibeBG = (window as unknown as { VibeBG?: { attach: (t: string, o?: object) => () => void } }).VibeBG;
  //   if (!VibeBG) return;
  //   return VibeBG.attach('.stat-tile', { palette: 'green', scale: 0.85, offset: [0.78, 0.5] });
  // }, []);

  const cfg = provider.getConfig();
  const all = provider.listDonations();
  const donations = all.filter((d) => d.kind === 'donate');
  const finished = donations.filter((d) => d.status === 'finished');

  const today = confirmTotals(donations, startOfToday()).sum;
  const week = confirmTotals(
    donations.filter((d) => d.ts >= Date.now() - 7 * 86400_000),
  ).sum;
  const todayStart = startOfToday();
  const ydaySum = confirmTotals(
    donations.filter((d) => d.ts >= todayStart - 86400_000 && d.ts < todayStart),
  ).sum;
  const prevWeekSum = confirmTotals(
    donations.filter((d) => d.ts >= Date.now() - 14 * 86400_000 && d.ts < Date.now() - 7 * 86400_000),
  ).sum;
  const biggest = finished.reduce<Donation | null>((acc, d) => (!acc || d.shownSum > acc.shownSum ? d : acc), null);
  const total = confirmTotals(donations);
  const avg = total.count > 0 ? Math.round(total.sum / total.count) : 0;

  const days = useMemo(() => {
    const n = Number(range);
    const out: { label: string; value: number }[] = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const next = d.getTime() + 86400_000;
      out.push({
        label: `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`,
        value: finished
          .filter((x) => x.ts >= d.getTime() && x.ts < next)
          .reduce((s, x) => s + x.shownSum, 0),
      });
    }
    return out;
  }, [finished, range]);

  // повторы (kind replay) в ленту не кладём: «Повторить» — это показ в OBS,
  // а не новое сообщение. Тесты видно с бейджем.
  const recent = all.filter((d) => d.kind !== 'replay');
  const visibleRecent = recent.filter((d) => !hidden.has(d.operationId));

  // свежеприлетевшие: всё, чего не было на первом рендере; полоска живёт 10 сек
  const seenRef = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<string[]>([]);
  useEffect(() => {
    const ids = new Set(all.map((d) => d.operationId));
    if (seenRef.current === null) {
      seenRef.current = ids;
      return;
    }
    const arrived = [...ids].filter((id) => !seenRef.current!.has(id));
    seenRef.current = ids;
    if (arrived.length === 0) return;
    setFresh((prev) => [...prev, ...arrived.filter((id) => !prev.includes(id))]);
    arrived.forEach((id) => {
      window.setTimeout(() => setFresh((prev) => prev.filter((x) => x !== id)), 10_000);
    });
  });

  // красивое скрытие: сначала схлопывание, потом изъятие из ленты
  const [hiding, setHiding] = useState<string[]>([]);
  function hideMessage(id: string) {
    if (hidden.has(id)) return;
    setHiding((prev) => (prev.includes(id) ? prev : [...prev, id]));
    window.setTimeout(() => {
      setHidden((prev) => new Set(prev).add(id));
      setHiding((prev) => prev.filter((x) => x !== id));
      toast('Сообщение скрыто из ленты.');
    }, 300);
  }

  const top = Object.values(
    donations
      .filter((d) => d.status === 'finished' && !d.anonymous)
      .reduce<Record<string, { name: string; sum: number }>>((acc, d) => {
        acc[d.username] ??= { name: d.username, sum: 0 };
        acc[d.username].sum += d.shownSum;
        return acc;
      }, {}),
  )
    .sort((a, b) => b.sum - a.sum)
    .slice(0, 5);

  const hasGoal = !!cfg.goalTitle;
  const goalProgress = confirmTotals(
    donations.filter((d) => d.ts >= cfg.goalBoundary),
  ).sum;

  const percent = hasGoal && cfg.goalTarget > 0 ? Math.min(100, Math.max(0, goalProgress / cfg.goalTarget * 100)) : 0;
  const goalStateText = !hasGoal ? '' : !cfg.goalEnabled ? 'на паузе' : goalProgress >= cfg.goalTarget ? 'достигнута' : '';

  const lastDonation = all[0];
  // live — личная ссылка с ключом (как в Подключении), демо — демо-секрет
  const overlayUrl = (() => {
    const tw = isAuthed() ? getTwitch() : null;
    if (!tw) return `${window.location.origin}/#/overlay/demo-secret-123`;
    let key = '';
    try { key = localStorage.getItem('rsmine.appSecret') ?? ''; } catch { /* приватный режим */ }
    return `${window.location.origin}/#/overlay/${encodeURIComponent(tw.slug)}?k=${encodeURIComponent(key)}`;
  })();

  const [testOpen, setTestOpen] = useState(false);

  function fireTest(sum: number, text: string) {
    const d = provider.simulateTestWith(sum, text);
    if (!d) { toast('Нет активного варианта для теста'); return; }
    preview(d);
    toast('Тест: превью справа снизу и в оверлее. Статистика не изменена.');
  }

  function replayLast() {
    if (!lastDonation) return;
    const r = provider.simulateReplay(lastDonation);
    if (r) preview(r);
    toast('Повтор последнего: превью справа снизу и в оверлее. Статистика не изменена.');
  }

  async function copyOverlay() {
    const ok = await copyText(overlayUrl);
    toast(ok ? 'Ссылка оверлея скопирована' : 'Не удалось скопировать ссылку');
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }
  return (
    <div className="dashboard-two">
      <div>
        <h1 className="page-h1">Панель управления</h1>
      </div>
      <div className="stats-row dashboard-two-stats">
        <div className="card stat-tile motion-card" style={{ '--card-index': 0 } as React.CSSProperties}>
          <div className="sl-a-head"><span className="sl-tick" aria-hidden="true" /><span className="sl-label">Сегодня</span></div>
          <div className="sl-hero num"><CountUp to={today} /></div>
          <div className="sl-a-foot">
            <AbsDelta cur={today} prev={ydaySum} />
            <span className="sl-note">ко вчера</span>
          </div>
        </div>
        <div className="card stat-tile motion-card" style={{ '--card-index': 1 } as React.CSSProperties}>
          <div className="sl-a-head"><span className="sl-tick" aria-hidden="true" /><span className="sl-label">7 дней</span></div>
          <div className="sl-hero num"><CountUp to={week} /></div>
          <div className="sl-a-foot">
            <AbsDelta cur={week} prev={prevWeekSum} />
            <span className="sl-note">к прошлым 7 дням</span>
          </div>
        </div>
        <div className="card stat-tile motion-card" style={{ '--card-index': 2 } as React.CSSProperties}>
          <div className="sl-a-head"><span className="sl-tick" aria-hidden="true" /><span className="sl-label">Всё время</span></div>
          <div className="sl-hero num"><CountUp to={total.sum} /></div>
          <div className="sl-a-foot">
            <span className="sl-record"><FontAwesomeIcon icon={faSackDollar} /><span className="num"><CountUp to={biggest ? biggest.shownSum : 0} /></span></span>
            <span className="sl-note">крупнейший донат</span>
          </div>
        </div>
        <button className={`goal-mini-widget${hasGoal && !cfg.goalEnabled ? ' is-paused' : ''}`} onClick={() => demoProvider ? document.getElementById('features')?.scrollIntoView({ block: 'start', behavior: 'smooth' }) : navigate('/app/goal')} aria-label={hasGoal ? `Открыть цель: ${cfg.goalTitle}` : 'Создать цель'}>
          <span className="goal-mini-copy">
            {hasGoal ? (
              <>
                <span className="sl-a-head"><span className="sl-tick" aria-hidden="true" /><span className="sl-label" title={`${cfg.goalTitle} — ${money(goalProgress)} из ${money(cfg.goalTarget)}`}>Цель</span></span>
                <span className="sl-hero num"><CountUp to={Math.round(percent)} format={(n) => `${Math.round(n)}%`} /></span>
                <span className="gl-bar" aria-hidden="true"><span style={{ width: `${percent}%` }} /></span>
                <span className="gl-foot">
                  <span className="num"><CountUp to={goalProgress} /> <span>из {money(cfg.goalTarget)}</span></span>
                  {goalStateText && <span className="sl-note">{goalStateText}</span>}
                </span>
              </>
            ) : (
              <span className="goal-mini-copy is-empty">
                <span className="goal-empty-plus" aria-hidden="true"><FontAwesomeIcon icon={faPlus} /></span>
                <span className="goal-empty-title">Создайте цель</span>
                <span className="sl-note">Прогресс сбора будет жить здесь и в оверлее.</span>
              </span>
            )}
          </span>
        </button>
      </div>
      <div className="dashboard-two-grid">
        <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
          <div className="sec-head">
            <div className="card-title">Последние сообщения</div>
          </div>
          <div className="msg-list">
            {visibleRecent.length === 0 ? (
              <div className="zero">
                <div className="zero-title">Пока тихо</div>
                <div className="zero-sub">Сюда упадут первые донаты.<br />Проверьте алерт тестовым донатом.</div>
              </div>
            ) : (
              visibleRecent.map((d) => (
                <MsgCard key={d.operationId} d={d} banned={cfg.bannedWords ?? []}
                  isFresh={fresh.includes(d.operationId)}
                  isHiding={hiding.includes(d.operationId)}
                  onReplay={() => {
                    const r = provider.simulateReplay(d);
                    if (r) preview(r);
                    toast('Повтор: превью справа снизу и в оверлее. Статистика не изменена.');
                  }}
                  onHide={() => hideMessage(d.operationId)} />
              ))
            )}
          </div>
          <div className="msg-fade" />
        </div>        <div className="card dashboard-two-chart">
          <div className="sec-head">
            <div>
              <div className="card-title">Динамика</div>
              <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 3 }}>подтверждённые донаты по дням</div>
            </div>
            <Seg
              ariaLabel="Период"
              value={range}
              onChange={setRange}
              options={[
                { value: '7', label: '7 дней' },
                { value: '30', label: '30 дней' },
              ]}
            />
          </div>
          <div className="chart-flex">
            <Sparkline points={days} />
          </div>
        </div>

        <div className="dashboard-two-side">
          {previewSlot ?? <div className="card dashboard-top-donors">
            <div className="sec-head">
              <div className="card-title">Топ-5 донатеров</div>
            </div>
            <ol className="top-donors-list" aria-label="Рейтинг донатеров">
              {top.map((t, i) => (
                <li key={t.name} className="top-donor-row" data-rank={i + 1}>
                  <span className="top-donor-place">{i < 3 ? <img src={[rankGold, rankSilver, rankBronze][i]} alt={`${i + 1} место`} width="34" height="34"/> : <span className="top-donor-number num" aria-label={`${i + 1} место`}>{i + 1}</span>}</span>
                  <span className="top-donor-person"><span className="top-donor-name" title={t.name}>{t.name}</span></span>
                  <span className="top-donor-sum num">{money(t.sum)}</span>
                </li>
              ))}
            </ol>
            {top.length === 0 && <div className="top-donors-empty">Здесь появятся ваши первые донатеры</div>}
          </div>}

          <div className="card quick-actions">
            <div className="sec-head">
              <div className="card-title">Быстрые действия</div>
            </div>
            <div className="qa-contrast">
              <button className="qa-primary" onClick={() => setTestOpen(true)}>
                <span className="qa-primary-main"><FontAwesomeIcon icon={faHandHoldingDollar} style={{ fontSize: 17 }} /> Тестовый донат</span>
              </button>
              <div className="qa-contrast-row">
                <button className="qa-ghost" onClick={replayLast} disabled={!lastDonation}
                  title={lastDonation ? `Повторить алерт: ${lastDonation.anonymous ? 'Аноним' : lastDonation.username} · ${money(lastDonation.shownSum)}` : 'Пока нечего повторять'}>
                  <FontAwesomeIcon icon={faRepeat} style={{ fontSize: 16 }} /> Повтор доната
                </button>
                <button className="qa-ghost" onClick={copyOverlay}>
                  {copied ? <Check size={17} strokeWidth={2} /> : <FontAwesomeIcon icon={faLink} style={{ fontSize: 16 }} />} {copied ? 'Скопировано' : 'Оверлей'}
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
      {testOpen && (
        <TestDonationModal
          initialSum={provider.peekTestSum()}
          onClose={() => setTestOpen(false)}
          onFire={(sum, text) => { setTestOpen(false); fireTest(sum, text); }}
        />
      )}
    </div>
  );
}

/** Тестовый донат с суммой и текстом: превью в панели и алерт в оверлее, без платежа. */
function TestDonationModal({ initialSum, onClose, onFire }: {
  initialSum: number; onClose: () => void; onFire: (sum: number, text: string) => void;
}) {
  const [sumText, setSumText] = useState(String(initialSum || 100));
  const [text, setText] = useState('Тестовый донат — деньги не переводились');
  const sum = Math.round(Number(sumText.replace(',', '.')));
  const sumOk = Number.isFinite(sum) && sum >= 1 && sum <= 1000000;
  const QUICK = [50, 100, 300, 500, 1000];

  function submit() {
    if (!sumOk) return;
    onFire(sum, text);
  }

  return (
    <Modal
      title="Тестовый донат"
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button variant="primary" disabled={!sumOk} onClick={submit}>Показать алерт</Button>
        </>
      }
    >
      <div className="modal-sub">Превью появится в панели и в оверлее OBS. Деньги не списываются, в статистику не попадает.</div>
      <div className="trow">
        <span className="tlabel">Сумма</span>
        <span className="st-money">
          <input
            className={`st-input num${sumOk ? '' : ' error'}`}
            inputMode="numeric"
            maxLength={9}
            value={sumText}
            onChange={(e) => setSumText(e.target.value.replace(/[^\d]/g, '').slice(0, 7))}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            aria-label="Сумма тестового доната, ₽"
          />
        </span>
      </div>
      <div className="tchips" role="group" aria-label="Быстрый выбор суммы">
        {QUICK.map((v) => (
          <button
            key={v}
            type="button"
            className={`chip${sum === v ? ' on' : ''}`}
            onClick={() => setSumText(String(v))}
          >
            <span className="num">{v}</span>
          </button>
        ))}
      </div>
      <div className="trow" style={{ marginTop: 12 }}>
        <span className="tlabel">Текст</span>
        <input
          className="st-input wide"
          maxLength={180}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          placeholder="Что покажет алерт"
          aria-label="Текст тестового доната"
        />
      </div>
    </Modal>
  );
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

function MsgCard({ d, isFresh, isHiding, onReplay, onHide, banned }: {
  d: Donation; isFresh: boolean; isHiding: boolean; onReplay: () => void; onHide: () => void; banned: string[];
}) {
  const sec = Math.round((Date.now() - d.ts) / 1000);
  const ago = sec < 60 ? 'только что'
    : sec < 3600 ? `${Math.round(sec / 60)} мин назад`
    : sec < 86400 ? `${Math.round(sec / 3600)} ч назад`
    : `${Math.round(sec / 86400)} дн назад`;
  const name = d.anonymous ? 'Аноним' : d.username;
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <div className={`msg-card${isFresh ? ' is-fresh' : ''}${isHiding ? ' is-hiding' : ''}`}>
      {isFresh && !isHiding && <span className="msg-fresh" aria-hidden="true" />}
      <div className="msg-ava" style={avatarStyle(name)}>{initials}</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="who">
          {name} <span className="sent">отправил</span>{' '}
          <span className="sum num">{money(d.shownSum)}</span>
          {d.kind === 'test' && <span className="badge">тест</span>}
        </div>
        {d.text && <div className="txt">{maskBannedWords(d.text, banned)}</div>}
        <div className="msg-actions">
          <button onClick={onReplay}>
            <Repeat size={15} strokeWidth={1.8} />
            <span className="lbl">Повторить</span>
          </button>
          <button onClick={onHide}>
            <EyeOff size={15} strokeWidth={1.8} />
            <span className="lbl">Скрыть</span>
          </button>
        </div>
      </div>
      <span className="when">{ago}</span>
    </div>
  );
}
