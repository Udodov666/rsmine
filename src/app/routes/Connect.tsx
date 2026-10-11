import { useEffect, useState } from 'react';
import { getProvider } from '../../data/providerSwitch';
import { apiBase, authHeaders, getTwitch, isAuthed, twitchAuthorizeUrl } from '../../data/live/auth';
import { Check, Copy, Download, ExternalLink, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRotateRight } from '@fortawesome/free-solid-svg-icons';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';
import type { DataProvider } from '../../data/provider';
import type { Donation } from '../../data/types';
import { sendTestToOverlay, showDonationPreview } from '../../components/AlertPreview';
import { copyText } from '../../lib/format';

const DEMO_SECRET = 'demo-secret-123';
const DEMO_STEPS = ['Ключ', 'Ссылка', 'OBS', 'Проверка'];
const LIVE_STEPS = ['Программа', 'Связь', 'OBS', 'Тест'];
const LS_SECRET = 'rsmine.appSecret';

/** Актуальная версия программы (должна совпадать с APP_VERSION в desktop/main.js). */
const APP_VERSION = '1.2.0';

/** true, если версия программы старее требуемой (semver из чисел). */
function progOutdated(v: string, need: string): boolean {
  const pa = v.split('.').map((x) => Number(x) || 0);
  const pb = need.split('.').map((x) => Number(x) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const a = pa[i] ?? 0;
    const b = pb[i] ?? 0;
    if (a !== b) return a < b;
  }
  return false;
}

/** Подключение: live — единый визард «программа → связь → OBS → тест»;
 *  демо (лендинг/лабы) — прежний четырёхшаговый мастер на моке. */
export default function Connect({ demoProvider, initialStep = 0, onPreview, demoOverlayUrl }: { demoProvider?: DataProvider; initialStep?: number; onPreview?: (d: Donation | null) => void; demoOverlayUrl?: string } = {}) {
  if (demoProvider) {
    return <DemoWizard demoProvider={demoProvider} initialStep={initialStep} onPreview={onPreview} demoOverlayUrl={demoOverlayUrl} />;
  }
  return <LiveConnect />;
}

/* ================= LIVE: программа → связь → OBS → тест ================= */

function LiveConnect() {
  const toast = useToast();
  const slug = getTwitch()?.slug ?? '';
  const [step, setStep] = useState(0);
  const [secret, setSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<'unknown' | 'checking' | 'online' | 'offline'>('unknown');
  const [progVersion, setProgVersion] = useState<string | null>(null);
  const [regCount, setRegCount] = useState<number | null>(null);

  useEffect(() => {
    setSecret(localStorage.getItem(LS_SECRET));
  }, []);

  // связью проверяем автоматически при входе на шаг «Связь»
  useEffect(() => {
    if (step === 1 && status === 'unknown') void check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  if (!isAuthed()) {
    return (
      <div className="settings-wrap">
        <h1 className="page-h1">Подключение</h1>
        <div className="page-sub">
          Сначала войди через Twitch — в этом же браузере. Сессия хранится в браузере
          и привязана к аккаунту.
        </div>
        <div className="gcard" style={{ marginTop: 20 }}>
          <Button variant="primary" onClick={() => { const u = twitchAuthorizeUrl(); if (u) window.location.href = u; }}>
            Войти через Twitch
          </Button>
        </div>
      </div>
    );
  }

  async function generate() {
    setBusy(true);
    try {
      const res = await fetch(apiBase() + '/api/profile/me/app-secret', {
        method: 'POST',
        headers: { ...authHeaders() },
      });
      const data = (await res.json().catch(() => null)) as { appSecret?: string; error?: string } | null;
      if (res.ok && data?.appSecret) {
        localStorage.setItem(LS_SECRET, data.appSecret);
        setSecret(data.appSecret);
        toast('Секрет создан — скопируй сейчас, больше не покажем');
      } else if (res.status === 401) {
        toast('Сессия истекла — войди через Twitch заново');
      } else {
        toast(`Не удалось создать секрет (${res.status}): ${data?.error ?? 'неизвестно'}`);
      }
    } catch (e) {
      toast(`Ошибка сети: ${e instanceof Error ? e.message : 'unknown'}`);
    } finally {
      setBusy(false);
    }
  }

  async function check() {
    setStatus('checking');
    try {
      const res = await fetch(`${apiBase()}/api/relay/${encodeURIComponent(slug)}/status`);
      const data = (await res.json().catch(() => null)) as { online?: boolean; version?: string | null; donations?: number | null } | null;
      setStatus(data?.online ? 'online' : 'offline');
      setProgVersion(typeof data?.version === 'string' ? data.version : null);
      setRegCount(typeof data?.donations === 'number' ? data.donations : null);
    } catch {
      setStatus('offline');
      setProgVersion(null);
      setRegCount(null);
    }
  }

  const origin = window.location.origin;
  const overlayKey = localStorage.getItem(LS_SECRET) ?? '';
  const overlayUrl = `${origin}/#/overlay/${encodeURIComponent(slug)}?k=${encodeURIComponent(overlayKey)}`;
  const goalUrl = `${origin}/#/goal/${encodeURIComponent(slug)}`;
  const downloadUrl = (import.meta.env.VITE_DESKTOP_URL as string | undefined) ?? '/download';

  async function copyUrl() {
    if (await copyText(overlayUrl)) toast('Ссылка скопирована');
  }

  async function copyGoalUrl() {
    if (await copyText(goalUrl)) toast('Ссылка виджета скопирована');
  }

  return (
    <div className="settings-wrap">
      <h1 className="page-h1">Подключение</h1>
      <div className="page-sub">
        Программа на твоём ПК держит платежи (LZT-токен не покидает компьютер),
        оверлей в OBS показывает оповещения. Четыре шага — и донаты идут на стрим.
      </div>

      <div className="steps">
        {LIVE_STEPS.map((label, i) => (
          <span key={label} style={{ display: 'contents' }}>
            {i > 0 && <span className="step-line" />}
            <button
              className={`step ${i === step ? 'on' : ''} ${i < step ? 'done' : ''}`}
              onClick={() => i < step && setStep(i)}
            >
              <span className="n">{i < step ? <Check size={12} strokeWidth={2.4} /> : i + 1}</span>
              {label}
            </button>
          </span>
        ))}
      </div>

      <div className="gcard">
        {step === 0 && (
          <>
            <div className="pg-title">Скачай программу и привяжи аккаунт</div>
            <div className="pg-desc">
              Windows x64, живёт в трее. Секрет связывает программу с этим аккаунтом:
              на сервере лежит только хеш, сам секрет показывается один раз.
            </div>
            <div style={{ marginTop: 12 }}>
              <Button variant="primary" onClick={() => window.open(downloadUrl, '_blank')}>
                <Download size={14} strokeWidth={1.8} style={{ marginRight: 6, verticalAlign: -2 }} />
                Скачать RSMine для Windows
              </Button>
            </div>
            <div style={{ marginTop: 18 }}>
              <span className="glabel" style={{ display: 'block', marginBottom: 8 }}>Секрет программы</span>
              {secret ? (
                <>
                  <span className="gkey" style={{ display: 'flex', maxWidth: 560 }}>
                    <input className="st-input mono" readOnly value={secret} onFocus={(e) => e.target.select()} />
                    <button className="icon-btn" title="Копировать" onClick={async () => { await copyText(secret); toast('Секрет скопирован'); }}>
                      <Copy size={14} strokeWidth={1.8} />
                    </button>
                  </span>
                  <div style={{ marginTop: 10 }}>
                    <Button variant="outline" disabled={busy} onClick={generate}>
                      <FontAwesomeIcon icon={faRotateRight} style={{ marginRight: 7, fontSize: 12 }} />
                      Пересоздать секрет
                    </Button>
                  </div>
                </>
              ) : (
                <Button variant="outline" disabled={busy} onClick={generate}>
                  <ShieldCheck size={14} strokeWidth={1.8} style={{ marginRight: 6, verticalAlign: -2 }} />
                  Сгенерировать секрет
                </Button>
              )}
            </div>
            <div className="hint" style={{ marginTop: 10 }}>
              В программе заполни те же данные: Slug, App Secret, LZT API токен (scopes
              invoice + payment), Merchant ID и ключ Cartesia — потом «Сохранить и подключить».
            </div>
            <div className="gfoot no-note">
              <Button variant="primary" onClick={() => setStep(1)}>Продолжить</Button>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div className="pg-title">Проверка связи с программой</div>
            <div className="pg-desc">
              Программа должна быть запущена и подключена к релею — в её трее точка
              зелёная («подключён»). Проверка бьёт в релей аккаунта напрямую.
            </div>
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', background: 'var(--panel)', borderRadius: 'var(--r-lg)' }}>
              <span
                className="g-dot"
                style={{
                  width: 10, height: 10, flex: 'none',
                  background: status === 'online' ? '#10a45a' : status === 'checking' ? 'var(--text3)' : 'var(--text4)',
                  animation: status === 'checking' ? 'g-pulse 1.2s ease-in-out infinite' : undefined,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>
                  {status === 'online' ? 'Программа подключена' : status === 'checking' ? 'Проверяем…' : 'Программа не запущена'}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }}>
                  Релей {slug} · {apiBase() || 'тот же origin'}{progVersion ? ` · программа v${progVersion}` : ''}{regCount !== null ? ` · в реестре: ${regCount}` : ''}
                </div>
                {status === 'online' && progVersion && progOutdated(progVersion, APP_VERSION) && (
                  <div style={{ fontSize: 12.5, color: '#f5a83d', marginTop: 6 }}>
                    Программа старая: оплаты не попадут в историю. Перезапусти её из свежих файлов.
                  </div>
                )}
              </div>
              <Button variant="outline" onClick={check}>
                <FontAwesomeIcon icon={faRotateRight} style={{ marginRight: 7, fontSize: 12 }} />
                Проверить
              </Button>
            </div>
            <div className="gfoot no-note">
              <Button variant="outline" onClick={() => setStep(0)}>Назад</Button>
              <Button variant="primary" disabled={status !== 'online'} onClick={() => setStep(2)}>Продолжить</Button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="pg-title">Оверлей в OBS</div>
            <div className="pg-desc">
              Скопируй ссылку и добавь её источником в OBS. Ссылка приватная — в ней
              ключ оверлея: не публикуй и никому не отправляй. Если скомпрометирована —
              «Пересоздать секрет» на шаге 1 и заменить ссылку в OBS.
            </div>
            <div className="gfield">
              <span className="glabel">URL оверлея</span>
              <span className="gkey">
                <input className="st-input mono" readOnly value={overlayUrl} onFocus={(e) => e.target.select()} />
                <button className="icon-btn" title="Копировать ссылку" onClick={copyUrl}>
                  <Copy size={14} strokeWidth={1.8} />
                </button>
              </span>
            </div>
            <div className="gfield" style={{ marginTop: 14 }}>
              <span className="glabel">URL виджета цели</span>
              <span className="gkey">
                <input className="st-input mono" readOnly value={goalUrl} onFocus={(e) => e.target.select()} />
                <button className="icon-btn" title="Копировать ссылку" onClick={copyGoalUrl}>
                  <Copy size={14} strokeWidth={1.8} />
                </button>
              </span>
            </div>
            <div className="hint" style={{ marginTop: 8 }}>
              Виджет — второй источник в OBS (тоже Browser, 1920 × 1080). Ссылка публичная:
              цель всё равно видна на стриме. Без активной цели виджет пуст и невидим.
            </div>
            <ol className="obs-ol" style={{ marginTop: 14 }}>
              <li>В OBS: Источники → «+» → <b>Browser</b>.</li>
              <li>Вставьте скопированную ссылку в поле URL.</li>
              <li>Размер источника — <span className="num">1920 × 1080</span>: алерт встанет как на сцене «Дизайн».</li>
              <li>Где будет донат и какого размера — настрой в панели: Настройки → Дизайн (перетаскивание прямо на сцене).</li>
              <li>Галочку «Завершить работу источника, когда он не виден» — снять.</li>
            </ol>
            <div className="gfoot no-note">
              <Button variant="outline" onClick={() => setStep(1)}>Назад</Button>
              <Button variant="primary" onClick={() => setStep(3)}>Продолжить</Button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="pg-title">Проверка</div>
            <div className="pg-desc">
              «Тестовый донат» прогоняет полный цикл алерта без платежа — превью появится
              справа снизу и в оверлее. Тест не является денежным событием и не попадает
              в статистику.
            </div>
            <div className="grow-actions" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Button
                variant="primary"
                onClick={() => {
                  const d = getProvider().simulateTest();
                  sendTestToOverlay(d);
                }}
              >
                Тестовый донат
              </Button>
              <Button variant="outline" onClick={() => window.open(overlayUrl, '_blank')}>
                <ExternalLink size={13} strokeWidth={1.8} /> Открыть оверлей
              </Button>
              <button
                className="icon-btn"
                style={{ marginLeft: 'auto', width: 32, height: 32 }}
                title="Начать заново"
                onClick={() => { setStep(0); setStatus('unknown'); }}
              >
                <FontAwesomeIcon icon={faRotateRight} style={{ fontSize: 13 }} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ================= ДЕМО: прежний мастер на моке (лендинг/лабы) ================= */

function DemoWizard({ demoProvider, initialStep = 0, onPreview, demoOverlayUrl }: { demoProvider: DataProvider; initialStep?: number; onPreview?: (d: Donation | null) => void; demoOverlayUrl?: string }) {
  const toast = useToast();
  const provider = demoProvider;
  const [step, setStep] = useState(initialStep);
  const [key, setKey] = useState(() => provider.getConfig().lztToken ?? '');
  const [merchant, setMerchant] = useState(() => String(provider.getConfig().merchantId ?? ''));
  const [showKey, setShowKey] = useState(false);
  const [showMerchant, setShowMerchant] = useState(false);
  const [savedKey, setSavedKey] = useState(() => !!provider.getConfig().lztToken);
  const [tested, setTested] = useState(false);

  // Автосохранение ключа и мерчанта в localStorage на каждое изменение,
  // чтобы значения не терялись при уходе со страницы до нажатия «Продолжить».
  useEffect(() => {
    const newToken = key.trim();
    const newMerchant = merchant.trim();
    const c = provider.getConfig();
    if (c.lztToken === newToken && c.merchantId === newMerchant) return;
    provider.saveConfig({ ...c, lztToken: newToken, merchantId: newMerchant });
    setSavedKey(newToken.length > 0);
  }, [key, merchant, provider]);

  const origin = window.location.origin;
  const overlayUrl = demoOverlayUrl ?? `${origin}/#/overlay/${DEMO_SECRET}#lzt_token=${encodeURIComponent(key || 'ВСТАВЬТЕ_КЛЮЧ')}`;
  const keyOk = key.trim().length >= 20;

  async function copyUrl() {
    if (await copyText(overlayUrl)) toast('Ссылка скопирована');
  }

  return (
    <div className="settings-wrap">
      <h1 className="page-h1">Подключение OBS</h1>
      <div className="page-sub">
        Четыре шага, чтобы зрители могли отправлять донаты, а оверлей в OBS — показывать
        оповещения. Токен стримера передаётся только в fragment ссылки
        (<code>#lzt_token=…</code>) и не попадает в сервис.
      </div>

      <div className="steps">
        {DEMO_STEPS.map((label, i) => (
          <span key={label} style={{ display: 'contents' }}>
            {i > 0 && <span className="step-line" />}
            <button
              className={`step ${i === step ? 'on' : ''} ${i < step ? 'done' : ''}`}
              onClick={() => i < step && setStep(i)}
            >
              <span className="n">{i < step ? <Check size={12} strokeWidth={2.4} /> : i + 1}</span>
              {label}
            </button>
          </span>
        ))}
      </div>

      <div className="gcard">
        {step === 0 && (
          <>
            <div className="pg-title">API-ключ LolzTeam со scopes invoice + payment</div>
            <div className="pg-desc">
              <b>invoice</b> — создание счетов на оплату, <b>payment</b> — просмотр
              истории операций (успешные и нет). Больше ничего не нужно.
              В демо хранится локально в браузере,
              в ссылку уходит только фрагментом <code>#lzt_token=…</code>.
            </div>
            <div className="gfield">
              <span className="glabel">Ключ</span>
              <span className="gkey">
                <input
                  className="st-input"
                  type={showKey ? 'text' : 'password'}
                  placeholder="Вставьте ключ (сохранится локально)"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                />
                <button
                  className="icon-btn" onClick={() => setShowKey((v) => !v)}
                  title={showKey ? 'Скрыть' : 'Показать'}
                >
                  {showKey ? <EyeOff size={14} strokeWidth={1.8} /> : <Eye size={14} strokeWidth={1.8} />}
                </button>
              </span>
            </div>
            <div className="gfield">
              <span className="glabel">Merchant ID</span>
              <span className="gkey">
                <input
                  className="st-input"
                  type={showMerchant ? 'text' : 'password'}
                  placeholder="ID мерчанта для счетов"
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value.trimStart().replace(/\s+/g, ''))}
                />
                <button
                  className="icon-btn" onClick={() => setShowMerchant((v) => !v)}
                  title={showMerchant ? 'Скрыть' : 'Показать'}
                >
                  {showMerchant ? <EyeOff size={14} strokeWidth={1.8} /> : <Eye size={14} strokeWidth={1.8} />}
                </button>
              </span>
            </div>
            <div className="gfoot">
              <span className="gfoot-note">{savedKey && key ? <><ShieldCheck size={13} strokeWidth={1.8} /> Ключ сохранён в браузере</> : <><ShieldCheck size={13} strokeWidth={1.8} /> Демо: ключ от 20 символов</>}</span>
              <div className="gfoot-actions">
                <Button variant="primary" disabled={!keyOk} onClick={() => {
                  setStep(1);
                }}>Продолжить</Button>
              </div>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div className="pg-title">Ссылка для browser source</div>
            <div className="pg-desc">
              Скопируйте ссылку и вставьте её в OBS. Не публикуйте её: любой, кто получит
              ссылку, сможет отправлять тестовые события в ваш оверлей.
            </div>
            <div className="gfield">
              <span className="glabel">URL оверлея</span>
              <span className="gkey">
                <input
                  className="st-input mono"
                  readOnly
                  value={overlayUrl}
                  onFocus={(e) => e.target.select()}
                />
                <button className="icon-btn" title="Копировать ссылку" onClick={copyUrl}>
                  <Copy size={14} strokeWidth={1.8} />
                </button>
              </span>
            </div>
            <div className="gfoot no-note">
              <Button variant="outline" onClick={() => setStep(0)}>Назад</Button>
              <Button variant="primary" onClick={() => setStep(2)}>Продолжить</Button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="pg-title">Добавление в OBS</div>
            <div className="pg-desc">Источник добавляется один раз — дальше он живёт сам.</div>
            <ol className="obs-ol">
              <li>В OBS: Источники → «+» → <b>Browser</b>.</li>
              <li>Вставьте скопированную ссылку в поле URL.</li>
              <li>Размер источника: <span className="num">1920 × 1080</span>.</li>
              <li>Галочку «Завершить работу источника, когда он не виден» — снять.</li>
            </ol>
            <div className="gfoot no-note">
              <Button variant="outline" onClick={() => setStep(1)}>Назад</Button>
              <Button variant="primary" onClick={() => setStep(3)}>Продолжить</Button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="pg-title">Проверка</div>
            <div className="pg-desc">
              «Тестовый донат» прогоняет полный цикл алерта без платежа — превью появится
              справа снизу и в оверлее. Тест не является денежным событием и не попадает
              в статистику.
            </div>
            <div className="grow-actions" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="primary"
                onClick={() => {
                  const d = provider.simulateTest();
                  (onPreview ?? showDonationPreview)(d);
                  setTested(true);
                }}
              >
                Тестовый донат
              </Button>
              {tested && <span className="badge ok">алерт показан</span>}
              <Button variant="outline" onClick={() => demoProvider ? (onPreview ?? showDonationPreview)(provider.simulateTest()) : window.open(`${origin}/#/overlay/${DEMO_SECRET}`, '_blank')}>
                <ExternalLink size={13} strokeWidth={1.8} /> Открыть оверлей
              </Button>
              <Button variant="outline" onClick={() => setStep(0)}>Начать заново</Button>
            </div>
            <div className="hint" style={{ marginTop: 14 }}>
              Статус связи оверлея (heartbeat) виден в статусе OBS на панели управления.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
