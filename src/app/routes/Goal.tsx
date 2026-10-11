import { useEffect, useState } from 'react';
import { getProvider } from '../../data/providerSwitch';
import { MoreHorizontal } from 'lucide-react';
import { getMockProvider } from '../../data/mock/MockProvider';
import { confirmTotals } from '../../data/provider';
import { money } from '../../lib/format';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { Menu } from '../../components/Menu';
import { NumInput } from '../../components/Bits';
import { useToast } from '../../components/Toast';
import { goalsStore, type PastGoal } from '../../data/goalsStore';

const GOAL_ACCENTS = ['#f7941d', '#17d985', '#e5484d', '#5E9FE8', '#ffffff'];

/** Страница цели сбора: карточка активной цели, дизайн полосы и история сборов. Автосохранение. */
export default function GoalPage() {
  const provider = getProvider();
  const toast = useToast();
  const [cfg, setCfg] = useState(() => provider.getConfig());
  const [past, setPast] = useState<PastGoal[]>(() => goalsStore.getAll());
  const [resetOpen, setResetOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => provider.subscribe(() => setCfg(provider.getConfig())), [provider]);
  useEffect(() => goalsStore.subscribe(() => setPast(goalsStore.getAll())), []);

  function update(fn: (draft: typeof cfg) => void) {
    const draft = JSON.parse(JSON.stringify(cfg));
    fn(draft);
    provider.saveConfig(draft);
    setCfg(provider.getConfig());
  }

  const donations = provider.listDonations().filter((d) => d.kind === 'donate');
  const collected = confirmTotals(
    donations.filter((d) => d.status === 'finished' && d.ts >= cfg.goalBoundary),
  ).sum;
  const percent = cfg.goalTarget > 0
    ? Math.min(100, Math.round((collected / cfg.goalTarget) * 100))
    : 0;
  const hasGoal = Boolean(cfg.goalTitle.trim());
  const barText = cfg.goalBarText
    .replace('{собрано}', collected.toLocaleString('ru-RU'))
    .replace('{цель}', cfg.goalTarget.toLocaleString('ru-RU'))
    .replace('{процент}', String(percent));

  async function archiveCurrent() {
    setArchiving(true);
    await new Promise((resolve) => window.setTimeout(resolve, 520));
    goalsStore.archive({
      title: cfg.goalTitle || 'Без названия',
      target: cfg.goalTarget,
      collected,
      startedTs: cfg.goalBoundary,
    });
    update((d) => {
      d.goalTitle = '';
      d.goalEnabled = false;
      d.goalBoundary = Date.now();
    });
    setArchiving(false);
    setArchiveOpen(false);
    toast('Цель перенесена в архив.');
  }

  const fmtDay = (ts: number) =>
    new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  const countWord = (n: number) =>
    n % 10 === 1 && n % 100 !== 11 ? 'цель' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'цели' : 'целей';

  return (
    <div className="goal-page">
      <h1 className="page-h1">Цель сбора</h1>
      <div className="page-sub">Управляйте текущей целью и историей сборов. На стрим цель выводится отдельным виджетом — ссылка в Подключении.</div>

      {/* ─── Текущая цель ─── */}
      <div className="g-overline">Текущая цель</div>
      <section className="gcard">
        {hasGoal ? (
          <div className="ghead">
            <div className="ghead-info">
              <div className="ghead-name">{cfg.goalTitle}</div>
              <div className="ghead-state">
                <span className={`g-dot ${cfg.goalEnabled ? '' : 'off'}`} />
                {cfg.goalEnabled
                  ? 'Активна — видна в виджете'
                  : 'Скрыта — виджет пуст'}
              </div>
            </div>
            <span className="gswitch">
              <button
                type="button"
                role="switch"
                aria-checked={cfg.goalEnabled}
                aria-label="Показывать цель в виджете"
                className={`switch ${cfg.goalEnabled ? 'on' : ''}`}
                onClick={() => update((d) => { d.goalEnabled = !cfg.goalEnabled; })}
              />
            </span>
          </div>
        ) : (
          <div className="gempty">
            <div className="gempty-title">Активной цели пока нет</div>
            <div className="gempty-sub">
              Укажите название и сумму — после этого цель можно вывести на стрим виджетом из Подключения.
            </div>
          </div>
        )}

        {/* живое превью полосы — как она выглядит на стриме */}
        <div className="goalbar-preview in-card">
          <div className="goalbar-preview-title">{(cfg.goalTitle || 'Название цели').toUpperCase()}</div>
          <div className="goalbar-preview-bar">
            <span className="goalbar-preview-fill" style={{ width: percent + '%' }} />
            <span className="goalbar-preview-accent" style={{ background: cfg.goalBarAccent }} />
            <span className="goalbar-preview-text">{barText}</span>
          </div>
        </div>

        <div className="g-params-label">Параметры цели</div>
        <div className="gfields">
          <label className="gfield">
            <span className="glabel">Название цели</span>
            <input
              className="st-input"
              placeholder="Например: Новый микрофон"
              value={cfg.goalTitle}
              onChange={(e) => update((d) => { d.goalTitle = e.target.value; })}
            />
          </label>
          <label className="gfield">
            <span className="glabel">Сумма цели</span>
            <span className="st-money">
              <NumInput
                value={cfg.goalTarget} min={1} max={10000000}
                onCommit={(v) => update((d) => { d.goalTarget = v; })}
              />
            </span>
          </label>
        </div>

        <div style={{ position: 'relative', marginTop: 18 }}>
          <label style={{ fontSize: 13, color: 'var(--text)', display: 'block', marginBottom: 5 }}>Акцент</label>
          <div className="hint">Цвет полосы виджета цели. Ссылка на виджет — в Подключении.</div>
          {/* цвета справа, по вертикальному центру блока «заголовок + описание» */}
          <span style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', display: 'inline-flex', gap: 6 }}>
            {GOAL_ACCENTS.map((c) => (
              <span key={c} title={c}
                onClick={() => update((d) => { d.goalBarAccent = c; })}
                style={{
                  width: 18, height: 18, borderRadius: 6, background: c, cursor: 'pointer',
                  outline: cfg.goalBarAccent === c ? '2px solid var(--text)' : 'none', outlineOffset: 1,
                }}
              />
            ))}
          </span>
        </div>

        {hasGoal && (
          <div className="gfoot">
            <span className="gfoot-note">Изменения сохраняются автоматически</span>
            <div className="gfoot-actions">
              <Button variant="outline" onClick={() => setArchiveOpen(true)}>
                Завершить цель
              </Button>
              <Button variant="ghost" className="gbtn-danger" onClick={() => setResetOpen(true)}>
                Сбросить прогресс
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* ─── История ─── */}
      <section className="ghistory">
        <div className="g-overline-row">
          <span className="g-overline" style={{ margin: 0 }}>История</span>
          <span className="g-sec-count">{past.length} {countWord(past.length)}</span>
        </div>
        <div className="gcard gcard-list">
          {past.length === 0 && (
            <div className="gempty-inline">Архив пуст — завершённые цели будут появляться здесь.</div>
          )}
          {past.map((g, index) => (
            <div className="grow motion-row" style={{ '--row-index': index } as React.CSSProperties} key={g.id}>
              <div className="grow-info">
                <div className="grow-line1">
                  <span className="grow-name">{g.title}</span>
                  {g.status === 'completed' ? (
                    <span className="badge ok">Выполнена</span>
                  ) : (
                    <span className="badge">Закрыта</span>
                  )}
                </div>
                <div className="grow-line2">
                  {money(g.collected)} из {money(g.target)} · {fmtDay(g.startedTs)} — {fmtDay(g.endedTs)}
                </div>
              </div>
              <Menu
                align="end"
                button={(open, toggle) => (
                  <button
                    type="button"
                    className={`icon-btn ${open ? 'on' : ''}`}
                    aria-label="Действия с целью"
                    onClick={toggle}
                  >
                    <MoreHorizontal size={16} strokeWidth={1.8} />
                  </button>
                )}
                items={[
                  ...(g.status !== 'completed'
                    ? [{ value: 'complete', label: 'Отметить выполненной' }]
                    : []),
                  { value: 'delete', label: 'Удалить навсегда', danger: true },
                ]}
                onSelect={(v) => {
                  if (v === 'complete') goalsStore.markCompleted(g.id);
                  if (v === 'delete') goalsStore.remove(g.id);
                }}
              />
            </div>
          ))}
        </div>
      </section>

      {resetOpen && (
        <Modal
          title="Сбросить прогресс цели?"
          critical
          onClose={() => setResetOpen(false)}
          actions={
            <>
              <Button variant="ghost" onClick={() => setResetOpen(false)}>Отмена</Button>
              <Button
                variant="danger"
                loading={resetting}
                loadingText="Сбрасываем"
                onClick={async () => {
                  setResetting(true);
                  await new Promise((resolve) => window.setTimeout(resolve, 520));
                  provider.resetGoalBoundary();
                  setResetting(false);
                  setResetOpen(false);
                  toast('Прогресс цели сброшен.');
                }}
              >
                Сбросить
              </Button>
            </>
          }
        >
          Отсчёт начнётся заново с текущего момента. История донатов сохранится, но прогресс
          и топ посчитаются только по новым операциям.
        </Modal>
      )}
      {archiveOpen && (
        <Modal
          title="Завершить цель и убрать в архив?"
          critical
          onClose={() => setArchiveOpen(false)}
          actions={
            <>
              <Button variant="ghost" onClick={() => setArchiveOpen(false)}>Отмена</Button>
              <Button variant="danger" loading={archiving} loadingText="Завершаем" onClick={archiveCurrent}>
                Завершить
              </Button>
            </>
          }
        >
          Цель исчезнет из виджета и появится в истории со статусом
          «{collected >= cfg.goalTarget ? 'Выполнена' : 'Закрыта'}». Собранный прогресс сохранится.
        </Modal>
      )}
    </div>
  );
}
