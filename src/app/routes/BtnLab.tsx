import { useState } from 'react';
import { ArrowUpRight, Check, ChevronRight, FlaskConical, Gift, HandCoins, History, Link2, MonitorPlay, Repeat } from 'lucide-react';
import { getMockProvider } from '../../data/mock/MockProvider';
import { showDonationPreview } from '../../components/AlertPreview';
import { useToast } from '../../components/Toast';
import { copyText } from '../../lib/format';

/** Лаборатория кнопок: 5 вариантов «Быстрых действий» на выбор. Временный инструмент. */
export default function BtnLab() {
  const provider = getMockProvider();
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const last = provider.listDonations()[0];

  function fireTest() {
    const d = provider.simulateTest();
    if (!d) { toast('Нет активного варианта для теста'); return; }
    showDonationPreview(d);
    toast('Тест: превью справа снизу и в оверлее.');
  }

  function replayLast() {
    if (!last) return;
    const r = provider.simulateReplay(last);
    showDonationPreview(r);
    toast('Повтор последнего: превью справа снизу и в оверлее.');
  }

  async function copyOverlay() {
    const ok = await copyText(`${window.location.origin}/#/overlay/demo-secret-123`);
    toast(ok ? 'Ссылка оверлея скопирована' : 'Не удалось скопировать ссылку');
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="qalab">
      <h1 className="page-h1">Лаборатория кнопок</h1>
      <div className="page-sub">5 вариантов «Быстрых действий». Все кнопки живые. Выберешь — перенесу в дашборд.</div>

      <section className="card">
        <div className="sec-head"><div className="card-title">Вариант 1 — Строки (текущий)</div></div>
        <div className="quick-actions-list">
          <button className="quick-action" onClick={fireTest}>
            <span className="quick-action-icon" aria-hidden="true"><FlaskConical size={18} strokeWidth={1.8} /></span>
            <span className="quick-action-text"><span className="quick-action-label">Тестовый донат</span><span className="quick-action-hint">Проверить алерт, звук и эффект</span></span>
          </button>
          <button className="quick-action" onClick={replayLast} disabled={!last}>
            <span className="quick-action-icon" aria-hidden="true"><Repeat size={18} strokeWidth={1.8} /></span>
            <span className="quick-action-text"><span className="quick-action-label">Повторить последний</span><span className="quick-action-hint">Показать заново без статистики</span></span>
          </button>
          <button className="quick-action" onClick={copyOverlay}>
            <span className="quick-action-icon" aria-hidden="true">{copied ? <Check size={18} strokeWidth={2} /> : <Link2 size={18} strokeWidth={1.8} />}</span>
            <span className="quick-action-text"><span className="quick-action-label">{copied ? 'Ссылка скопирована' : 'Скопировать оверлей'}</span><span className="quick-action-hint">Источник для OBS-браузера</span></span>
          </button>
        </div>
      </section>

      <section className="card">
        <div className="sec-head"><div className="card-title">Вариант 2 — Плитки</div></div>
        <div className="qa-tiles">
          <button className="qa-tile" onClick={fireTest}>
            <HandCoins size={26} strokeWidth={1.6} />
            <span className="qa-tile-label">Тестовый донат</span>
            <span className="qa-tile-hint">алерт · звук · эффект</span>
          </button>
          <button className="qa-tile" onClick={replayLast} disabled={!last}>
            <History size={26} strokeWidth={1.6} />
            <span className="qa-tile-label">Повторить</span>
            <span className="qa-tile-hint">последний, без статистики</span>
          </button>
          <button className="qa-tile" onClick={copyOverlay}>
            {copied ? <Check size={26} strokeWidth={1.8} /> : <MonitorPlay size={26} strokeWidth={1.6} />}
            <span className="qa-tile-label">{copied ? 'Скопировано' : 'Оверлей'}</span>
            <span className="qa-tile-hint">ссылка для OBS</span>
          </button>
        </div>
      </section>

      <section className="card">
        <div className="sec-head"><div className="card-title">Вариант 3 — Главная + запасные</div></div>
        <div className="qa-contrast">
          <button className="qa-primary" onClick={fireTest}>
            <span className="qa-primary-main"><HandCoins size={18} strokeWidth={1.8} /> Тестовый донат</span>
          </button>
          <div className="qa-contrast-row">
            <button className="qa-ghost" onClick={replayLast} disabled={!last}>
              <History size={17} strokeWidth={1.8} /> Повторить
            </button>
            <button className="qa-ghost" onClick={copyOverlay}>
              {copied ? <Check size={17} strokeWidth={2} /> : <MonitorPlay size={17} strokeWidth={1.8} />} {copied ? 'Скопировано' : 'Оверлей'}
            </button>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="sec-head"><div className="card-title">Вариант 4 — Список</div></div>
        <div className="qa-list">
          <button className="qa-list-row" onClick={fireTest}>
            <Gift size={20} strokeWidth={1.7} />
            <span className="qa-list-text"><span className="qa-list-label">Тестовый донат</span><span className="qa-list-hint">Проверить алерт, звук и эффект</span></span>
            <ChevronRight size={16} strokeWidth={1.8} />
          </button>
          <button className="qa-list-row" onClick={replayLast} disabled={!last}>
            <History size={20} strokeWidth={1.7} />
            <span className="qa-list-text"><span className="qa-list-label">Повторить последний</span><span className="qa-list-hint">Показать заново без статистики</span></span>
            <ChevronRight size={16} strokeWidth={1.8} />
          </button>
          <button className="qa-list-row" onClick={copyOverlay}>
            {copied ? <Check size={20} strokeWidth={2} /> : <MonitorPlay size={20} strokeWidth={1.7} />}
            <span className="qa-list-text"><span className="qa-list-label">{copied ? 'Ссылка скопирована' : 'Скопировать оверлей'}</span><span className="qa-list-hint">Источник для OBS-браузера</span></span>
            <ChevronRight size={16} strokeWidth={1.8} />
          </button>
        </div>
      </section>

      <section className="card">
        <div className="sec-head"><div className="card-title">Вариант 5 — Герои</div></div>
        <div className="qa-heros">
          <button className="qa-hero" onClick={fireTest}>
            <span className="qa-hero-ring" aria-hidden="true"><HandCoins size={22} strokeWidth={1.7} /></span>
            <span className="qa-hero-text"><span className="qa-hero-label">Тестовый донат</span><span className="qa-hero-hint">Проверить алерт, звук и эффект</span></span>
            <ArrowUpRight size={17} strokeWidth={1.8} />
          </button>
          <button className="qa-hero" onClick={replayLast} disabled={!last}>
            <span className="qa-hero-ring" aria-hidden="true"><History size={22} strokeWidth={1.7} /></span>
            <span className="qa-hero-text"><span className="qa-hero-label">Повторить последний</span><span className="qa-hero-hint">Показать заново без статистики</span></span>
            <ArrowUpRight size={17} strokeWidth={1.8} />
          </button>
          <button className="qa-hero" onClick={copyOverlay}>
            <span className="qa-hero-ring" aria-hidden="true">{copied ? <Check size={22} strokeWidth={2} /> : <MonitorPlay size={22} strokeWidth={1.7} />}</span>
            <span className="qa-hero-text"><span className="qa-hero-label">{copied ? 'Ссылка скопирована' : 'Скопировать оверлей'}</span><span className="qa-hero-hint">Источник для OBS-браузера</span></span>
            <ArrowUpRight size={17} strokeWidth={1.8} />
          </button>
        </div>
      </section>
      <section className="card">
        <div className="sec-head"><div className="card-title">CTA — 3 зелёных</div></div>
        <div className="qa-ctas">
          {[
            { name: '1 · Изумруд', cls: 'cta-1' },
            { name: '2 · Мята', cls: 'cta-2' },
            { name: '3 · Неон-трава', cls: 'cta-3' },
          ].map(({ name, cls }) => (
            <div key={cls}>
              <span className="qa-cta-name">{name}</span>
              <button type="button" className={`qa-cta ${cls}`} onClick={() => toast(`CTA «${name}» — говоришь, ставлю`)}>
                Отправить 500 ₽
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
