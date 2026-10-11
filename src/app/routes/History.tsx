import { useEffect, useMemo, useState } from 'react';
import { getProvider } from '../../data/providerSwitch';
import { Download, Plus, Repeat, Search, Info } from 'lucide-react';
import { getMockProvider } from '../../data/mock/MockProvider';
import { getTwitch } from '../../data/live/auth';
import { addManualDonation } from '../../data/live/api';
import { maskBannedWords } from '../../lib/moderation';
import { avatarStyle, money, plural } from '../../lib/format';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { sendTestToOverlay } from '../../components/AlertPreview';
import { useToast } from '../../components/Toast';
import type { Donation, OpStatus } from '../../data/types';

type StatusFilter = 'all' | OpStatus;
const PAGE_SIZE = 20;

/** Сообщения: лента донатов с группировкой по дням, фильтры и повтор алерта. */
export default function History() {
  const toast = useToast();
  const provider = getProvider();
  const [, force] = useState(0);
  const [q, setQ] = useState('');
  const [period, setPeriod] = useState<'all' | 'today' | 'week'>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [detail, setDetail] = useState<Donation | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  // ручное внесение — только live-панель с серверным реестром
  const refreshLive = (provider as unknown as { refreshDonations?: () => Promise<void> }).refreshDonations;
  const banned: string[] = provider.getConfig().bannedWords ?? [];

  useEffect(() => provider.subscribe(() => force((v) => v + 1)), [provider]);
  const all = provider.listDonations();

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const now = Date.now();
    const since = period === 'today' ? new Date().setHours(0, 0, 0, 0) : period === 'week' ? now - 7 * 86400_000 : 0;
    const rows = all.filter((d) => {
      if (d.kind !== 'donate') return false;
      if (status !== 'all' && d.status !== status) return false;
      if (d.ts < since) return false;
      if (!query) return true;
      const name = (d.anonymous ? 'аноним' : d.username).toLowerCase();
      return name.includes(query) || d.text.toLowerCase().includes(query);
    });
    rows.sort((a, b) => b.ts - a.ts);
    return rows;
  }, [all, q, status, period]);

  const sumTotal = filtered.reduce((s, d) => s + d.shownSum, 0);
  const pageItems = filtered.slice(0, visible);

  // лента группируется по дням: Сегодня / Вчера / дата
  const groups: Array<{ label: string; items: Donation[]; sum: number }> = [];
  const fmtDay = (ts: number) =>
    new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  for (const d of pageItems) {
    const label = dayLabel(d.ts);
    const last = groups[groups.length - 1];
    if (last && last.label === label) { last.items.push(d); last.sum += d.shownSum; }
    else groups.push({ label, items: [d], sum: d.shownSum });
  }

  function dayLabel(ts: number): string {
    const d = new Date(ts);
    const today = new Date();
    const yest = new Date(Date.now() - 86400_000);
    if (d.toDateString() === today.toDateString()) return 'Сегодня';
    if (d.toDateString() === yest.toDateString()) return 'Вчера';
    return fmtDay(ts);
  }
  const fmtTime = (ts: number) =>
    new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const initials = (name: string) => name.slice(0, 2).toUpperCase();

  function exportCsv() {
    const rows = [
      ['время', 'ник', 'показано', 'фактически', 'фичи', 'срезано', 'текст', 'статус', 'тип', 'operation_id'],
      ...filtered.map((d) => [
        new Date(d.ts).toISOString(),
        d.anonymous ? 'Аноним' : d.username,
        String(d.shownSum),
        String(d.incomingSum),
        d.features.map((f) => f.code).join(' '),
        d.removedFeatures.map((f) => f.code).join(' '),
        d.text.replace(/\r?\n/g, ' '),
        d.status,
        d.kind,
        d.operationId,
      ]),
    ];
    // ячейки с =,+,-,@ в начале экранируем апострофом — иначе Excel выполнит формулу (CSV-инъекция из ника/текста)
    const safe = (c: string) => (/^[=+\-@]/.test(c) ? `'${c}` : c);
    const csv = '\ufeff' + rows.map((r) => r.map((c) => `"${safe(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'lolzdonat-history.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    toast(`Экспортировано записей: ${filtered.length}`);
  }

  const STATUS_CHIPS: Array<[StatusFilter, string]> = [
    ['all', 'Все'],
    ['finished', 'Подтверждены'],
    ['pending', 'Ожидаются'],
    ['cancelled', 'Отменены'],
  ];

  return (
    <div className="settings-wrap msg-page">
      <h1 className="page-h1">Сообщения</h1>
      <div className="page-sub">
        Все донаты, тесты и повторы. Нажмите на сообщение — детали и повтор алерта.
      </div>

      <div className="msg-search">
          <Search size={14} strokeWidth={1.8} className="msg-search-ico" />
          <input
            className="st-input"
            placeholder="Поиск по имени или тексту сообщения"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setVisible(PAGE_SIZE);
            }}
          />
          {refreshLive && (
            <Button variant="outline" onClick={() => setManualOpen(true)}>
              <Plus size={13} strokeWidth={1.8} /> Внести вручную
            </Button>
          )}
          <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download size={13} strokeWidth={1.8} /> Экспорт
          </Button>
        </div>
      <div className="msg-chips">
          {STATUS_CHIPS.map(([v, label]) => (
            <button
              key={v}
              className={`chip ${status === v ? 'on' : ''}`}
              onClick={() => {
                setStatus(v as StatusFilter);
                setVisible(PAGE_SIZE);
              }}
            >
              {label}
            </button>
          ))}
          <span style={{ flex: 1 }} />
          <div className="seg" role="group" aria-label="Период">
            {([['all', 'За всё время'], ['today', 'Сегодня'], ['week', '7 дней']] as const).map(([v, label]) => (
              <button
                key={v}
                type="button"
                className={period === v ? 'on' : ''}
                onClick={() => {
                  setPeriod(v as typeof period);
                  setVisible(PAGE_SIZE);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

      {pageItems.length === 0 ? (
        <div className="gcard">
          <div className="gempty">
            <div className="gempty-title">Ничего не найдено</div>
            <div className="gempty-sub">Измените поиск или фильтры — или отправьте тестовый донат.</div>
          </div>
        </div>
      ) : (
        <div className="feed-list">
          {groups.map((g) => (
            <div className="msg-group" key={g.label}>
              <div className="msg-day">
                <span>{g.label}</span>
              </div>
              {g.items.map((d, index) => {
                const name = d.anonymous ? 'Аноним' : d.username;
                return (
                  <div
                    key={d.operationId}
                    className={`msg-row motion-row ${d.status === 'cancelled' ? 'cancelled' : ''}`}
                    style={{ '--row-index': index } as React.CSSProperties}
                    onClick={() => setDetail(d)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.code === 'Enter' && setDetail(d)}
                  >
                    <span className="msg-ava" style={avatarStyle(name)}>{d.anonymous ? 'А' : initials(name)}</span>
                    <div className="msg-main">
                      <div className="msg-top">
                        <span className="msg-name">{name}</span>
                        {d.kind !== 'donate' && (
                          <span className="badge">{d.kind === 'test' ? 'тест' : 'повтор'}</span>
                        )}
                        {d.status === 'pending' && <span className="badge hold">подтверждается</span>}
                        {d.status === 'cancelled' && <span className="badge cancelled">отменён</span>}
                      </div>
                      <div className="msg-text">{maskBannedWords(d.text || '— без сообщения', banned)}</div>
                    </div>
                    <div className="msg-right">
                      <span className="msg-sum num">{money(d.shownSum)}</span>
                      <span className="msg-time num">{fmtTime(d.ts)}</span>
                    </div>
                    <div className="msg-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="icon-btn" title="Повторить оповещение"
                        onClick={() => {
                          const r = provider.simulateReplay(d);
                          sendTestToOverlay(r);
                          toast('Повтор: превью справа снизу и в оверлее. Статистика не изменена.');
                        }}
                      >
                        <Repeat size={14} strokeWidth={1.8} />
                      </button>
                      <button className="icon-btn" title="Детали" onClick={() => setDetail(d)}>
                        <Info size={14} strokeWidth={1.8} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          {visible < filtered.length && (
            <button
              className="msg-more"
              onClick={() => setVisible((v) => v + PAGE_SIZE)}
            >
              Показать ещё · {filtered.length - visible}
            </button>
          )}
        </div>
      )}

      {detail && <Details d={detail} onClose={() => setDetail(null)} />}
      {manualOpen && refreshLive && (
        <ManualDonation
          onClose={() => setManualOpen(false)}
          onDone={() => refreshLive()}
        />
      )}
    </div>
  );
}

/** Внести пропущенный донат в серверный реестр (прошёл мимо — старая программа, сбой). */
function ManualDonation({ onClose, onDone }: { onClose: () => void; onDone: () => Promise<void> }) {
  const toast = useToast();
  const [sumText, setSumText] = useState('');
  const [nick, setNick] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const sum = Math.round(Number(sumText.replace(',', '.')));
  const sumOk = Number.isFinite(sum) && sum >= 1 && sum <= 10000000;

  async function submit() {
    if (!sumOk || busy) return;
    setBusy(true);
    const slug = getTwitch()?.slug ?? '';
    const good = await addManualDonation(slug, { sum, username: nick.trim(), text: text.trim().slice(0, 180) });
    setBusy(false);
    if (!good) {
      toast('Не удалось внести — проверь сеть или перевойди через Twitch');
      return;
    }
    await onDone();
    toast('Донат внесён в историю');
    onClose();
  }

  return (
    <Modal
      title="Внести донат вручную"
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button variant="primary" disabled={!sumOk || busy} onClick={() => void submit()}>
            {busy ? 'Вносим…' : 'Внести'}
          </Button>
        </>
      }
    >
      <div className="modal-sub">Для платежей, прошедших мимо реестра. Попадёт в историю и статистику как обычный донат.</div>
      <div className="trow">
        <span className="tlabel">Сумма</span>
        <span className="st-money">
          <input
            className={`st-input num${sumOk || !sumText ? '' : ' error'}`}
            inputMode="numeric"
            maxLength={9}
            value={sumText}
            onChange={(e) => setSumText(e.target.value.replace(/[^\d]/g, '').slice(0, 8))}
            onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
            aria-label="Сумма доната, ₽"
          />
        </span>
      </div>
      <div className="trow" style={{ marginTop: 12 }}>
        <span className="tlabel">Ник</span>
        <input
          className="st-input wide" maxLength={64} value={nick}
          onChange={(e) => setNick(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
          placeholder="Кто отправил (пусто — зритель)"
          aria-label="Ник донатера"
        />
      </div>
      <div className="trow" style={{ marginTop: 12 }}>
        <span className="tlabel">Текст</span>
        <input
          className="st-input wide" maxLength={180} value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
          placeholder="Сообщение доната"
          aria-label="Текст доната"
        />
      </div>
    </Modal>
  );
}

/** Детали операции: человек сверху, деньги героем, техника под катом. */
function Details({ d, onClose }: { d: Donation; onClose: () => void }) {
  const toast = useToast();
  const provider = getProvider();
  const name = d.anonymous ? 'Аноним' : d.username;
  const kindLabel = d.kind === 'test' ? 'Тест' : d.kind === 'replay' ? 'Повтор' : 'Донат';
  const status = d.status === 'finished'
    ? { text: 'Подтверждён', cls: 'is-ok' }
    : d.status === 'pending'
      ? { text: 'Ожидает', cls: 'is-hold' }
      : { text: 'Отменён', cls: 'is-off' };
  return (
    <Modal
      title={`${kindLabel} · ${money(d.incomingSum)}`}
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Закрыть
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              const r = provider.simulateReplay(d);
              sendTestToOverlay(r);
              toast('Повтор: превью справа снизу и в оверлее. Статистика не изменена.');
              onClose();
            }}
          >
            Повторить алерт
          </Button>
        </>
      }
    >
      <div className="dd-head">
        <span className="msg-ava" style={avatarStyle(name)}>{name.slice(0, 2).toUpperCase()}</span>
        <span className="dd-who">
          <span className="dd-name" title={d.anonymous ? `приватно: ${d.username}` : d.username}>{name}</span>
          <span className="dd-time num">{new Date(d.ts).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
        </span>
        <span className={`dd-status ${status.cls}`}>{status.text}</span>
      </div>
      <div className="dd-hero">
        <span className="num">{money(d.shownSum)}</span>
        <span>показано на стриме · пришло {money(d.incomingSum)}</span>
      </div>
      {d.text && (
        <>
          <div className="dd-label">Сообщение</div>
          <div className="dd-text">{maskBannedWords(d.text, getProvider().getConfig().bannedWords ?? [])}</div>
        </>
      )}
      {d.features.length > 0 && (
        <>
          <div className="dd-label">Озвучка и эффекты</div>
          <div className="dd-chips">
            {d.features.map((f) => (
              <span key={f.code} className="dd-chip">{f.kind === 'voice' ? 'Голос' : 'Эффект'} · {f.code}</span>
            ))}
          </div>
        </>
      )}
      {d.removedFeatures.length > 0 && (
        <div className="dd-cut">Не хватило суммы: срезано {d.removedFeatures.map((f) => f.code).join(', ')}.</div>
      )}
      <details className="dd-tech">
        <summary>Технические детали</summary>
        <div><span>revision</span><span className="num">{d.configRevision}</span></div>
        <div><span>operation_id</span><span className="num dd-op">{d.operationId}</span></div>
        {d.anonymous && <div><span>приватно</span><span>{d.username}</span></div>}
      </details>
    </Modal>
  );
}
