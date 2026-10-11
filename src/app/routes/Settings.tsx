import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getProvider } from '../../data/providerSwitch';
import { Images, Trash2 } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay } from '@fortawesome/free-solid-svg-icons';
import { getMockProvider } from '../../data/mock/MockProvider';
import type { DataProvider } from '../../data/provider';
import type { Donation } from '../../data/types';
import { pickMedia, isVideoUrl, isReadyMedia, READY_MEDIA, FREE_VOICE_CODE, streamerAvatar, DEMO_STREAMER, DEFAULT_BIO } from '../../data/defaults';
import type { Config, Preset } from '../../data/types';
import { Button } from '../../components/Button';
import { Seg } from '../../components/Seg';
import { PRow, SwitchYN, PGroup, NumInput, Pick } from '../../components/Bits';
import { CARTESIA_RU_VOICES, cartesiaSpeak, stopCartesiaAudio } from '../../lib/cartesia';
import { getTwitch, isAuthed } from '../../data/live/auth';
import { getMe, putTtsKey } from '../../data/live/api';
import { EFFECT_META, runEffect } from '../../lib/effects';
import { DEFAULT_BANNED_WORDS, maskAlertText } from '../../lib/moderation';
import { ALERT_SOUNDS, playAlertSound } from '../../lib/sounds';
import { sendTestToOverlay } from '../../components/AlertPreview';
import { useToast } from '../../components/Toast';

const STAGE_W = 1920;
const STAGE_H = 1080;
const SNAP = 8;
const SAMPLE = { name: 'Nick', sum: 20, text: 'Привет! Лучший стрим' };
const ALERT_COLORS = ['#f7941d', '#b36bf5', '#17d985', '#e5484d', '#5E9FE8', '#ffffff'];

type Tab = 'profile' | 'sums' | 'messages' | 'voice' | 'effects' | 'design';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'profile', label: 'Профиль' },
  { id: 'sums', label: 'Основные' },
  { id: 'messages', label: 'Сообщения' },
  { id: 'voice', label: 'Озвучка' },
  { id: 'effects', label: 'Эффекты' },
  { id: 'design', label: 'Дизайн' },
];

/** Миниатюра загруженного медиа в редакторе. */
function MediaThumb({ url }: { url: string }) {
  if (isVideoUrl(url)) {
    return <video src={url} muted autoPlay loop playsInline
      style={{ width: 56, height: 32, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--line2)' }} />;
  }
  return <img src={url} alt=""
    style={{ width: 56, height: 32, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--line2)' }} />;
}

/** Настройки донатов — структура DA: табы с иконками, строки «метка — контрол», автосохранение. */
export default function Settings({ demoProvider, initialTab = 'profile', onPreview, mediaLibrary }: { demoProvider?: DataProvider & { peekTestSum(): number }; initialTab?: Tab; onPreview?: (d: Donation | null) => void; mediaLibrary?: string[] } = {}) {
  const provider = demoProvider ?? getProvider();
  const [cfg, setCfg] = useState<Config>(() => provider.getConfig());
  const [tab, setTab] = useState<Tab>(initialTab);

  useEffect(() => {
    const unsub = provider.subscribe(() => setCfg(provider.getConfig()));
    return unsub;
  }, [provider]);

  function update(fn: (draft: Config) => void) {
    const draft: Config = JSON.parse(JSON.stringify(cfg));
    fn(draft);
    // автосохранение: любое изменение сразу попадает в провайдер
    provider.saveConfig(draft);
    setCfg(provider.getConfig());
  }

  return (
    <div className="settings-wrap">
      <h1 className="page-h1">Настройки</h1>
      <div className="page-sub">Всё сохраняется автоматически — просто меняйте значения.</div>
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="tab-panel" key={tab}>
        {tab === 'profile' && <ProfileTab cfg={cfg} update={update} />}
        {tab === 'sums' && <SumsTab cfg={cfg} update={update} />}
        {tab === 'messages' && <MessagesTab cfg={cfg} update={update} />}
        {tab === 'voice' && <VoiceTab cfg={cfg} update={update} safeDemo={!!demoProvider} />}
        {tab === 'effects' && <EffectsTab cfg={cfg} update={update} />}
        {tab === 'design' && <DesignTab cfg={cfg} update={update} demoProvider={demoProvider} onPreview={onPreview} mediaLibrary={mediaLibrary} />}
      </div>
    </div>
  );
}

/* ---------- ПРОФИЛЬ: ник, аватарка, описание для страницы доната ---------- */
function ProfileTab({ cfg, update }: { cfg: Config; update: (fn: (d: Config) => void) => void }) {
  const twitch = isAuthed() ? getTwitch() : null;
  const name = cfg.profileName.trim() || twitch?.displayName || DEMO_STREAMER.username;
  const avatar = cfg.profileAvatar || twitch?.avatar || streamerAvatar(name);
  return (
    <div className="form-col">
      <PGroup
        title="Профиль стримера"
        desc="Так зрители видят вас на странице доната. Пустой ник и аватарка — подтянем из Twitch, пустое описание — скроем на странице."
      >
        <PRow label="Никнейм">
          <input className="st-input wide" maxLength={25} placeholder={twitch?.displayName || DEMO_STREAMER.username}
            value={cfg.profileName}
            onChange={(e) => update((d) => { d.profileName = e.target.value; })} />
        </PRow>
        <PRow label="Ссылка на донат">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 0, color: 'var(--text3)', fontSize: 12.5 }}>#/d/
            <input className="st-input mono" style={{ width: 160 }} maxLength={30} placeholder="udodov"
              value={cfg.slug}
              onChange={(e) => update((d) => { d.slug = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''); })}
              onBlur={(e) => { if (!e.target.value) update((d) => { d.slug = 'udodov'; }); }} />
          </span>
        </PRow>
        <PRow label="Аватарка">
          <img src={avatar} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flex: 'none' }} />
          <label className="btn ghost" style={{ cursor: 'pointer' }}>
            Загрузить
            <input type="file" accept="image/*" hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const r = new FileReader();
                r.onload = () => update((d) => { d.profileAvatar = String(r.result); });
                r.readAsDataURL(f);
              }} />
          </label>
          {cfg.profileAvatar && <Button variant="outline" onClick={() => update((d) => { d.profileAvatar = ''; })}>Сбросить</Button>}
        </PRow>
        <PRow
          label={
            <span className="plabel" style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
              <span>Описание</span>
              <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text3)' }}>
                Показывается под ником на странице доната.
              </span>
            </span>
          }
          className="bio-row"
        >
          <textarea className="st-textarea" rows={2} maxLength={50} placeholder={DEFAULT_BIO + ' — если пусто, скроем'}
            value={cfg.profileBio}
            onChange={(e) => update((d) => { d.profileBio = e.target.value; })} />
        </PRow>
      </PGroup>
    </div>
  );
}

/* ---------- СУММЫ: минималка + цель сбора ---------- */
function SumsTab({ cfg, update }: { cfg: Config; update: (fn: (d: Config) => void) => void }) {
  return (
    <div className="form-col">
      <PGroup
        title="Приём донатов"
        desc="Минимальная сумма и условия приёма донатов на странице. Цель сбора живёт на отдельной странице «Цель сбора»."
      >
        <PRow label="Минимальная сумма доната">
          <div className="st-money">
            <NumInput
              value={cfg.minimum} min={1} max={1000000}
              onCommit={(v) => update((d) => { d.minimum = v; })}
            />
          </div>
        </PRow>
        <PRow label="Принимать донаты с холдом">
          <SwitchYN value={cfg.acceptHeld} onChange={(v) => update((d) => { d.acceptHeld = v; })} />
        </PRow>
        <PRow label="Разрешать анонимные донаты">
          <SwitchYN value={cfg.allowAnonymous} onChange={(v) => update((d) => { d.allowAnonymous = v; })} />
        </PRow>
        <div className="hint">
          Холд — период до подтверждения перевода на LZT. Донаты на холде показываются в
          статистике и цели с пометкой, пока не подтвердятся. Анонимные — зритель сам
          скрывает свой ник.
        </div>
      </PGroup>
    </div>
  );
}

/* ---------- СООБЩЕНИЯ: лимит, шаблон, правила ---------- */
function MessagesTab({ cfg, update }: { cfg: Config; update: (fn: (d: Config) => void) => void }) {
  return (
    <div className="form-col">
      <PGroup
        title="Лимит текста"
        desc="Максимальная длина сообщения в донате. Технический потолок — лимит комментария перевода LZT."
      >
        <PRow label="Количество символов">
          <input
            type="range" className="st-range" min={20} max={180} step={10}
            value={cfg.textLimit}
            onChange={(e) => update((d) => { d.textLimit = +e.target.value; })}
          />
          <NumInput
            value={cfg.textLimit} min={10} max={180}
            onCommit={(v) => update((d) => { d.textLimit = v; })}
          />
        </PRow>
      </PGroup>
      <PGroup
        title="Формат на стриме"
        desc="Шаблон текста задаётся у каждого варианта окна на вкладке «Дизайн». Плейсхолдеры: {имя} {сумма} {текст}."
      >
        <div className="hint">
          Символ «|» в сообщениях запрещён — это разметка payload LD1. Payload собирается
          на странице доната: <code>LD1|v=голос|e=эффект|a=аноним|текст</code>. Сумма и ник
          в payload не пишутся — они берутся только из фактического перевода.
        </div>
      </PGroup>
      <PGroup
        title="Фильтр слов"
        desc="Донат с такими словами проходит, но в алерте и озвучке они видны как ****. Ссылки (www, https://, домены) в алерте тоже скрываются, а в панели остаются как есть."
      >
        <div style={{ marginTop: 4 }}>
          <span className="glabel" style={{ display: 'block', marginBottom: 8 }}>Свои слова — по одному на строке</span>
          <textarea
            className="st-textarea" rows={4} maxLength={2000}
            style={{ minHeight: 88 }}
            placeholder={'спам\nреклама\nмой-пример'}
            value={(cfg.bannedWords ?? []).join('\n')}
            onChange={(e) => update((d) => {
              d.bannedWords = e.target.value
                .split(/[\n,]+/)
                .map((s) => s.trim().slice(0, 40))
                .filter(Boolean)
                .slice(0, 200);
            })}
          />
          <details className="dd-tech" style={{ borderTop: 0, paddingTop: 0 }}>
            <summary>Встроенный словарь: {DEFAULT_BANNED_WORDS.length} слов (работает всегда, показать)</summary>
            <div style={{ display: 'block', lineHeight: 1.9, overflowWrap: 'anywhere' }}>
              {DEFAULT_BANNED_WORDS.join(', ')}
            </div>
          </details>
        </div>
      </PGroup>
    </div>
  );
}

/* ---------- ОЗВУЧКА: каталог голосов ---------- */
export function VoiceTab({ cfg, update, safeDemo = false }: { cfg: Config; update: (fn: (d: Config) => void) => void; safeDemo?: boolean }) {
  const toast = useToast();
  const demoAudio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const authed = isAuthed();
  const [ttsKey, setTtsKey] = useState('');
  const [ttsKeySet, setTtsKeySet] = useState<boolean | null>(null);
  const [ttsSaving, setTtsSaving] = useState(false);

  // статус ключа с сервера (сам ключ назад не читается — только флаг).
  // В localStorage ключ и его части НЕ храним вообще.
  // Повторы: у KV eventual consistency, свежая запись видна не сразу —
  // один быстрый опрос после сохранения/refresh даёт ложное «не задан».
  useEffect(() => {
    if (!authed) return;
    let on = true;
    let tries = 0;
    const poll = async () => {
      tries += 1;
      try {
        const me = await getMe();
        const set = !!(me as { ttsKeySet?: boolean } | null)?.ttsKeySet;
        if (!on) return;
        if (set || tries >= 6) {
          setTtsKeySet(set);
          return;
        }
      } catch {
        if (!on || tries >= 6) {
          if (on) setTtsKeySet(false);
          return;
        }
      }
      window.setTimeout(() => { if (on) void poll(); }, 5000);
    };
    void poll();
    return () => { on = false; };
  }, [authed]);

  // явное сохранение ключа. Верим ответу самого PUT ({ok, ttsKeySet}):
  // перечитывать флаг сразу после записи нельзя — у KV eventual consistency
  // и свежее значение может быть ещё не видно (ложное «не подтвердил»).
  async function saveTtsKey() {
    const key = ttsKey.trim();
    if (!authed || !key || ttsSaving) return;
    setTtsSaving(true);
    try {
      const res = await putTtsKey(key);
      if (res?.ok) {
        setTtsKeySet(true);
        // поле НЕ чистим: введённый ключ остаётся звёздочками (type=password,
        // только в памяти вкладки — в localStorage ничего не пишем)
        toast('Ключ Cartesia сохранён на сервере');
      } else {
        throw new Error('put failed');
      }
    } catch {
      toast('Не удалось сохранить ключ — проверь сеть или перевойди через Twitch');
    } finally {
      setTtsSaving(false);
    }
  }

  function stopDemo() {
    demoAudio.current?.pause();
    stopCartesiaAudio();
    setPlaying(null);
  }

  // демо играет заранее сгенерированный нормализованный файл
  // (scripts/generate-tts-demos.mjs → public/tts-demo); живой синтез — только если файла нет
  async function playDemo(v: Config['voices'][number]) {
    if (playing === v.code) { stopDemo(); return; }
    demoAudio.current?.pause();
    stopCartesiaAudio();
    setPlaying(v.code);
    const done = () => setPlaying((cur) => (cur === v.code ? null : cur));
    try {
      const head = await fetch(`/tts-demo/${v.code}.wav`, { method: 'HEAD' });
      if (head.ok) {
        const a = new Audio(`/tts-demo/${v.code}.wav`);
        demoAudio.current = a;
        a.onended = done;
        a.onerror = done;
        await a.play();
        return;
      }
    } catch { /* файла нет — фолбэк ниже */ }
    if (safeDemo) { done(); toast('Локальный пример недоступен. Внешний синтез в демо выключен.'); return; }
    try {
      await cartesiaSpeak(`Демо-озвучка, голос ${v.name}.`, { voiceId: v.ttsId, volume: 100, slug: getTwitch()?.slug });
      done();
    } catch {
      done();
      try {
        const u = new SpeechSynthesisUtterance(`Демо-озвучка, голос ${v.name}`);
        u.lang = 'ru-RU';
        u.onend = done;
        speechSynthesis.cancel();
        speechSynthesis.speak(u);
      } catch {
        toast('Демо-озвучка недоступна — нет сети и локального синтеза.');
      }
    }
  }

  const hints = new Map(CARTESIA_RU_VOICES.map((c) => [c.id, c.hint]));
  const enabledVoices = cfg.voices.filter((v) => v.enabled);
  const testVoice =
    enabledVoices.find((v) => v.code === cfg.testVoiceCode) ?? enabledVoices[0];
  const female = cfg.voices.filter((v) => v.gender !== 'male');
  const male = cfg.voices.filter((v) => v.gender === 'male');

  const row = (v: Config['voices'][number]) => (
    <div className="voice-row" key={v.code}>
      <button
        type="button"
        className={`voice-play ${playing === v.code ? 'on' : ''}`}
        title={playing === v.code ? 'Остановить' : 'Послушать демо'}
        onClick={() => playDemo(v)}
      >
        {playing === v.code ? (
          <span className="eq"><i /><i /><i /><i /></span>
        ) : (
          <FontAwesomeIcon icon={faPlay} style={{ fontSize: 12 }} />
        )}
      </button>
      <div className="voice-info">
        <span className="voice-name">{v.name}</span>
        <span className="voice-hint">
          {hints.get(v.ttsId ?? '') ?? 'Русский голос'} · v={v.code}
        </span>
      </div>
      {v.code === FREE_VOICE_CODE ? (
        <span className="badge" title="Этот голос всегда бесплатен для зрителей и выбран по умолчанию">
          Бесплатный
        </span>
      ) : (
        <div className="st-money voice-money">
          <NumInput
            title="Цена выбора голоса зрителем, ₽"
            value={v.price} min={0} max={100000}
            onCommit={(n) => update((d) => {
              const item = d.voices.find((x) => x.code === v.code);
              if (item) item.price = n;
            })}
          />
        </div>
      )}
      <SwitchYN
        value={v.enabled}
        onChange={(val) => update((d) => {
          const item = d.voices.find((x) => x.code === v.code);
          if (item) item.enabled = val;
        })}
      />
    </div>
  );

  return (
    <div className="form-col">
      <PGroup
        title="Озвучка донатов"
        desc="Если зритель оплатил озвучку, алерт звучит выбранным им голосом. Без оплаты донат показывает только текст."
      >
        <PRow
          label={
            <span className="plabel" style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
              <span>API-ключ Cartesia</span>
              <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text3)' }}>
                {authed
                  ? (ttsKeySet
                    ? 'Ключ сохранён на сервере — браузеру не отдаётся. Чтобы заменить, вставьте новый.'
                    : ttsKeySet === null
                      ? 'Проверяем статус ключа на сервере…'
                      : <>Ключ хранится только на нашем сервере. Создаётся в консоли Cartesia: <a href="https://play.cartesia.ai/keys" target="_blank" rel="noreferrer" style={{ color: 'var(--text2)' }}>play.cartesia.ai → API Keys</a>.</>)
                  : 'Ключ хранится на сервере аккаунта — войдите через Twitch, чтобы задать его.'}
              </span>
            </span>
          }
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
            <input
              className="st-input wide"
              type="password"
              autoComplete="off"
              disabled={!authed || ttsSaving}
              placeholder={authed ? 'sk_car_…' : 'войдите через Twitch'}
              title="Ключ Cartesia (play.cartesia.ai → API Keys)"
              value={ttsKey}
              onChange={(e) => setTtsKey(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void saveTtsKey(); }}
            />
            {ttsKeySet && !ttsKey && <span className="badge ok" title="Ключ лежит на сервере">Сохранён</span>}
            <Button variant="outline" disabled={!authed || !ttsKey.trim() || ttsSaving} onClick={() => void saveTtsKey()}>
              {ttsSaving ? 'Сохраняем…' : 'Сохранить'}
            </Button>
          </span>
        </PRow>
        <PRow label="Язык">
          <Pick label="Язык озвучки" value="ru" onChange={() => {}} options={[{ value: 'ru', label: 'Русский' }]} />
        </PRow>
        <PRow
          label={
            <span className="plabel" style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
              <span>Голос тестового доната</span>
              <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text3)' }}>
                Тестовый донат звучит этим голосом. Донаты зрителей — тем, который они оплатили.
              </span>
            </span>
          }
        >
          <Pick label="Голос тестового доната"
            value={testVoice?.code ?? ''}
            onChange={(v) => update((d) => { d.testVoiceCode = v; })}
            options={enabledVoices.length === 0
              ? [{ value: '', label: 'нет включённых голосов' }]
              : enabledVoices.map((v) => ({ value: v.code, label: v.name }))}
          />
        </PRow>
      </PGroup>

      <div className="card props-card">
        <div className="pg-title" style={{ fontSize: 13 }}>Каталог голосов</div>
        <div className="pg-desc" style={{ marginBottom: 4 }}>
          Цена — стоимость выбора голоса зрителем. Демки записаны заранее и не тратят баланс синтеза.
        </div>
        <div className="voice-list">
          <div className="voice-group">Женские</div>
          {female.map(row)}
          <div className="voice-group">Мужские</div>
          {male.map(row)}
        </div>
      </div>
    </div>
  );
}

/* ---------- ЭФФЕКТЫ: каталог ---------- */
/* ---------- ЭФФЕКТЫ: каталог с демо на мини-сцене ---------- */
const EFFECT_DEMO_MS: Record<string, number> = {
  confetti: 3700,
  hearts: 2800,
  flash: 900,
};

export function EffectsTab({ cfg, update }: { cfg: Config; update: (fn: (d: Config) => void) => void }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const miniRef = useRef<HTMLDivElement>(null);
  const [demo, setDemo] = useState<string | null>(null);

  // демо проигрывается на мини-сцене — так эффект выглядит ровно как на стриме
  function playDemo(code: string) {
    runEffect(code, stageRef.current, miniRef.current);
    setDemo(code);
    window.setTimeout(() => setDemo((c) => (c === code ? null : c)), EFFECT_DEMO_MS[code] ?? 1500);
  }

  const meta = new Map(EFFECT_META.map((m) => [m.code, m]));

  return (
    <div className="form-col">
      <div className="card props-card">
        <div className="pg-title">Эффекты донатов</div>
        <div className="pg-desc">
          Зритель может добавить эффект к донату — он проиграется на сцене поверх алерта.
          Нажми ▶ у эффекта, чтобы увидеть его на мини-сцене.
        </div>
        <div className="fx-stage" ref={stageRef}>
          <div className="fx-mini-alert" ref={miniRef}>
            <div className="t">Nick - 100 RUB!</div>
            <div className="m">Спасибо за донат!</div>
          </div>
        </div>
        <div className="pg-title" style={{ fontSize: 13, marginTop: 12 }}>Каталог эффектов</div>
        <div className="pg-desc" style={{ marginBottom: 4 }}>
          Цена — стоимость эффекта для зрителя. Выключенные эффекты зритель выбрать не может.
        </div>
        <div className="voice-list">
          {cfg.effects.map((e) => (
            <div className="voice-row" key={e.code}>
              <button
                type="button"
                className={`voice-play ${demo === e.code ? 'on' : ''}`}
                title={`Показать демо: ${e.name}`}
                onClick={() => playDemo(e.code)}
              >
                <FontAwesomeIcon icon={faPlay} style={{ fontSize: 12 }} />
              </button>
              <div className="voice-info">
                <span className="voice-name">{e.name}</span>
                <span className="voice-hint">
                  {meta.get(e.code)?.hint ?? 'Эффект на сцене'} · e={e.code}
                </span>
              </div>
              <div className="st-money voice-money">
                <NumInput
                  title="Цена эффекта для зрителя, ₽"
                  value={e.price} min={0} max={100000}
                  onCommit={(n) => update((d) => {
                    const item = d.effects.find((x) => x.code === e.code);
                    if (item) item.price = n;
                  })}
                />
              </div>
              <SwitchYN
                value={e.enabled}
                onChange={(val) => update((d) => {
                  const item = d.effects.find((x) => x.code === e.code);
                  if (item) item.enabled = val;
                })}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- ДИЗАЙН: сцена + библиотека + свойства ---------- */
export function DesignTab({ cfg, update, demoProvider, onPreview, mediaLibrary = READY_MEDIA }: { cfg: Config; update: (fn: (d: Config) => void) => void; demoProvider?: DataProvider & { peekTestSum(): number }; onPreview?: (d: Donation | null) => void; mediaLibrary?: string[] }) {
  const provider = demoProvider ?? getProvider();
  const toast = useToast();
  const preset = useMemo(
    () => cfg.presets.find((p) => p.id === cfg.activePresetId) ?? cfg.presets[0],
    [cfg],
  );
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageW, setStageW] = useState(STAGE_W);
  const [tierPick, setTierPick] = useState<number | null>(null);
  // смена «Появление» тут же проигрывает анимацию на сцене (класс снимается по окончании)
  const [playAnim, setPlayAnim] = useState<string | null>(null);
  useEffect(() => {
    if (preset.appear !== 'none') setPlayAnim(preset.appear);
  }, [preset.appear]);
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setStageW(el.getBoundingClientRect().width || STAGE_W);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const drag = useRef<null | {
    mode: 'move' | 'resize'; px: number; py: number; ox: number; oy: number; ow: number; oh: number; rect: DOMRect;
  }>(null);

  function updatePreset(fn: (p: Preset) => void) {
    update((draft) => {
      const p = draft.presets.find((x) => x.id === preset.id);
      if (p) fn(p);
    });
  }

  function onPointerDown(e: React.PointerEvent, mode: 'move' | 'resize') {
    if (!stageRef.current) return;
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ок */ }
    drag.current = {
      mode, px: e.clientX, py: e.clientY,
      ox: preset.x, oy: preset.y, ow: preset.w, oh: preset.h,
      rect: stageRef.current.getBoundingClientRect(),
    };
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    if (e.buttons !== 1) { onPointerUp(e); return; }
    const dx = (e.clientX - d.px) * (STAGE_W / d.rect.width);
    const dy = (e.clientY - d.py) * (STAGE_H / d.rect.height);
    const snap = (v: number, target: number) => (Math.abs(v - target) < SNAP ? target : v);
    if (d.mode === 'move') {
      let x = Math.max(0, Math.min(STAGE_W - d.ow, d.ox + dx));
      let y = Math.max(0, Math.min(STAGE_H - d.oh, d.oy + dy));
      x = snap(snap(x, 0), STAGE_W - d.ow);
      x = snap(x, (STAGE_W - d.ow) / 2);
      y = snap(snap(y, 0), STAGE_H - d.oh);
      y = snap(y, (STAGE_H - d.oh) / 2);
      updatePreset((p) => { p.x = Math.round(x); p.y = Math.round(y); });
    } else {
      updatePreset((p) => {
        p.w = Math.round(Math.max(240, Math.min(STAGE_W - d.ox, d.ow + dx)));
      });
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    drag.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch { /* ок */ }
  }

  const scale = stageW / 1920;

  // сумма демо: если в шаблоне заголовка вписано число (вместо {сумма}) — берём его,
  // превью сразу показывает гифку уровня под эту сумму; иначе — цикл тестовых уровней
  const templateNum = Number((preset.titleTemplate.match(/(\d[\d\s]*)/) ?? [])[1]?.replace(/\s+/g, ''));
  const testSum = Number.isFinite(templateNum) && templateNum > 0 ? templateNum : provider.peekTestSum();
  const media = pickMedia(preset, testSum);
  const mediaIsVideo = !!media && isVideoUrl(media);
  const readyRound = media && isReadyMedia(media) ? preset.radius : 0;
  const title = preset.titleTemplate
    .replace('{имя}', SAMPLE.name)
    .replace('{сумма}', String(testSum));
  const message = maskAlertText(preset.textTemplate.replace('{текст}', SAMPLE.text), cfg.bannedWords ?? []);
  const headShadow = preset.shadow ? '0 2px 10px rgba(0,0,0,.65)' : 'none';
  const bodyShadow = preset.shadow
    ? '-1px -1px 0 rgba(0,0,0,.95), 1px -1px 0 rgba(0,0,0,.95), -1px 1px 0 rgba(0,0,0,.95), 1px 1px 0 rgba(0,0,0,.95), 0 2px 8px rgba(0,0,0,.95), 0 4px 20px rgba(0,0,0,.75)'
    : 'none';

  return (
    <div className="ed-layout">
      <div className="ed-stage">
        <div className="stage-holder">
          <div className="stage" ref={stageRef}>
            <div className="grid-dots" />
            <div
              className={`alert-box ${playAnim ? `anim-${playAnim}` : ''}`}
              onAnimationEnd={(e) => {
                if (e.target === e.currentTarget && e.animationName.startsWith('ov-')) setPlayAnim(null);
              }}
              onPointerDown={(e) => onPointerDown(e, 'move')}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              style={{
                left: (preset.x / STAGE_W) * 100 + '%',
                top: (preset.y / STAGE_H) * 100 + '%',
                width: (preset.w / STAGE_W) * 100 + '%',
                height: 'auto',
                containerType: 'inline-size',
                borderRadius: preset.radius,
                padding: 0,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {media && (mediaIsVideo ? (
                <video src={media} autoPlay muted loop playsInline style={{ width: '100%', height: 'auto', maxHeight: '32cqw', objectFit: 'contain', borderBottomLeftRadius: readyRound, borderBottomRightRadius: readyRound, display: 'block', pointerEvents: 'none' }} />
              ) : (
                <img src={media} alt="" style={{ width: '100%', height: 'auto', maxHeight: '32cqw', objectFit: 'contain', borderBottomLeftRadius: readyRound, borderBottomRightRadius: readyRound, display: 'block', pointerEvents: 'none' }} />
              ))}
              <div style={{ padding: '8px 14px', marginTop: media ? 'auto' : undefined, textAlign: preset.titleAlign }}>
                <div style={{ color: preset.titleColor, fontWeight: 800, fontSize: Math.max(9, preset.fontSize * scale), lineHeight: 1.15, textShadow: headShadow }}>
                  {title}
                </div>
                {message.trim() && (
                  <div style={{ color: '#fff', fontSize: Math.max(7, preset.fontSize * 0.55 * scale), lineHeight: 1.35, fontWeight: 600, opacity: 1, textShadow: bodyShadow, marginTop: 4, textAlign: preset.titleAlign }}>
                    {message}
                  </div>
                )}
              </div>
            </div>
            <div
              className="resize-grip"
              title="Ширина окна"
              style={{
                left: ((preset.x + preset.w) / STAGE_W) * 100 + '%',
                top: (preset.y / STAGE_H) * 100 + '%',
                transform: 'translate(-50%, -50%)',
              }}
              onPointerDown={(e) => { e.stopPropagation(); onPointerDown(e, 'resize'); }}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            />
          </div>
        </div>
        <div className="stage-caption">
          Сцена 1920×1080 · перетаскивание мышью · снап ~8px · фон прозрачный, как в реальном оверлее
        </div>
      </div>

      <div className="ed-props">
        <div className="card props-card">
          <div className="pg-title" style={{ fontSize: 13 }}>Медиа над заголовком</div>
          <PRow label="Режим">
            <Seg ariaLabel="Режим медиа" value={preset.mediaMode}
              onChange={(v) => updatePreset((p) => {
                p.mediaMode = v as 'single' | 'tiers';
                if (v === 'tiers' && p.mediaTiers.length === 0) {
                  p.mediaTiers = [
                    { minSum: 10, url: mediaLibrary[0] ?? READY_MEDIA[0] },
                    { minSum: 100, url: mediaLibrary[1] ?? mediaLibrary[0] ?? READY_MEDIA[1] },
                    { minSum: 1000, url: mediaLibrary[2] ?? mediaLibrary[0] ?? READY_MEDIA[2] },
                  ];
                }
              })}
              options={[
                { value: 'single', label: 'Один для всех' },
                { value: 'tiers', label: 'По суммам' },
              ]} />
          </PRow>
          {preset.mediaMode === 'single' ? (
            <>
              <PRow label="Ссылка">
                <input className="st-input wide mono" placeholder="https://…gif / mp4"
                  value={preset.mediaUrl}
                  onChange={(e) => updatePreset((p) => { p.mediaUrl = e.target.value; })} />
              </PRow>
              <PRow label="Файл с ПК">
                <label className="btn ghost" style={{ cursor: 'pointer' }}>
                  Загрузить
                  <input type="file" accept="image/*,video/mp4,video/webm" hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const r = new FileReader();
                      r.onload = () => updatePreset((p) => { p.mediaUrl = String(r.result); });
                      r.readAsDataURL(f);
                    }} />
                </label>
                {preset.mediaUrl && <MediaThumb url={preset.mediaUrl} />}
              </PRow>
              <div className="media-pick-block">
                <div className="media-pick-label">или выбери готовую</div>
                <div className="media-pick">
                  {mediaLibrary.map((u) => (
                    <button key={u} type="button" title="Выбрать готовое медиа"
                      className={`media-pick-thumb ${preset.mediaUrl === u ? 'sel' : ''}`}
                      onClick={() => updatePreset((p) => { p.mediaMode = 'single'; p.mediaUrl = u; })}>
                      <img src={u} alt="" loading="lazy" />
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="tier-list">
              {preset.mediaTiers.map((t, i) => (
              <div className="tier-row" key={i}>
                <span className="tier-from">от</span>
                <div className="st-money tier-money">
                  <NumInput
                    className="st-input tier-min" title="Минимальная сумма уровня, ₽"
                    value={t.minSum} min={0} max={1000000}
                    onCommit={(v) => updatePreset((p) => { p.mediaTiers[i].minSum = v; })}
                  />
                </div>
                <label className="btn ghost tier-file" title="Загрузить файл с ПК">
                  Файл
                  <input type="file" accept="image/*,video/mp4,video/webm" hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const r = new FileReader();
                      r.onload = () => updatePreset((p) => { p.mediaTiers[i].url = String(r.result); });
                      r.readAsDataURL(f);
                    }} />
                </label>
                <input
                  className="st-input mono" placeholder="или ссылка на медиа"
                  value={t.url}
                  onChange={(e) => updatePreset((p) => { p.mediaTiers[i].url = e.target.value; })}
                />
                <span className="gpick-wrap">
                  <button type="button" className="icon-btn" title="Выбрать из готовых"
                    onClick={() => setTierPick(tierPick === i ? null : i)}>
                    <Images size={14} strokeWidth={1.8} />
                  </button>
                  {tierPick === i && (
                    <>
                      <div className="pop-backdrop" onClick={() => setTierPick(null)} />
                      <div className="gpick-pop">
                        <div className="media-pick">
                          {mediaLibrary.map((u) => (
                            <button key={u} type="button" title="Выбрать готовое медиа"
                              className={`media-pick-thumb ${t.url === u ? 'sel' : ''}`}
                              onClick={() => {
                                updatePreset((p) => { p.mediaTiers[i].url = u; });
                                setTierPick(null);
                              }}>
                              <img src={u} alt="" loading="lazy" />
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </span>
                <button className="icon-btn" title="Удалить уровень"
                  onClick={() => updatePreset((p) => { p.mediaTiers = p.mediaTiers.filter((_, x) => x !== i); })}>
                  <Trash2 size={12} strokeWidth={1.8} />
                </button>
              </div>
              ))}
              <button className="add-preset" style={{ marginTop: 16 }}
                onClick={() => updatePreset((p) => {
                  p.mediaTiers = [...p.mediaTiers, { minSum: (p.mediaTiers[p.mediaTiers.length - 1]?.minSum ?? 0) + 100, url: '' }];
                })}>
                + Добавить уровень
              </button>
            </div>
          )}
        </div>

        <div className="card props-card">
          <div className="pg-title" style={{ fontSize: 13 }}>Заголовок</div>
          <PRow label="Шаблон">
            <input className="st-input wide" value={preset.titleTemplate}
              onChange={(e) => updatePreset((p) => { p.titleTemplate = e.target.value; })} />
          </PRow>
          <PRow label="Цвет">
            <span style={{ display: 'inline-flex', gap: 6 }}>
              {ALERT_COLORS.map((c) => (
                <span key={c} title={c}
                  onClick={() => updatePreset((p) => { p.titleColor = c; })}
                  style={{
                    width: 18, height: 18, borderRadius: 6, background: c, cursor: 'pointer',
                    outline: preset.titleColor === c ? '2px solid var(--text)' : 'none', outlineOffset: 1,
                  }}
                />
              ))}
            </span>
          </PRow>
          <PRow label="Размер шрифта">
            <NumInput
              value={preset.fontSize} min={10} max={72}
              onCommit={(v) => updatePreset((p) => { p.fontSize = v; })}
            />
          </PRow>
          <PRow label="Выравнивание">
            <Seg ariaLabel="Выравнивание заголовка и сообщения" value={preset.titleAlign}
              onChange={(v) => updatePreset((p) => { p.titleAlign = v as 'left' | 'center' | 'right'; })}
              options={[
                { value: 'left', label: 'Слева' },
                { value: 'center', label: 'По центру' },
                { value: 'right', label: 'Справа' },
              ]} />
          </PRow>
          <div className="hint">Плейсхолдеры: {'{имя} {сумма}'}. Жирный, с мягкой тенью.</div>
        </div>

        <div className="card props-card">
          <div className="pg-title" style={{ fontSize: 13 }}>Сообщение</div>
          <PRow label="Шаблон">
            <input className="st-input wide" value={preset.textTemplate}
              onChange={(e) => updatePreset((p) => { p.textTemplate = e.target.value; })} />
          </PRow>
          <div className="hint">Белый текст под заголовком. Плейсхолдер: {'{текст}'} — сообщение доната. Выравнивается вместе с заголовком.</div>
        </div>

        <div className="card props-card">
          <div className="pg-title" style={{ fontSize: 13 }}>Вид</div>
          <PRow label="Тень текста">
            <SwitchYN value={preset.shadow} onChange={(v) => updatePreset((p) => { p.shadow = v; })} />
          </PRow>
          <PRow label="Скругление">
            <NumInput
              value={preset.radius} min={0} max={32}
              onCommit={(v) => updatePreset((p) => { p.radius = v; })}
            />
          </PRow>
        </div>

        <div className="card props-card">
          <div className="pg-title" style={{ fontSize: 13 }}>Поведение</div>
          <PRow label="Длительность, с">
            <NumInput
              value={preset.durationSec} min={2} max={60}
              onCommit={(v) => updatePreset((p) => { p.durationSec = v; })}
            />
          </PRow>
          <PRow label="Появление">
            <Seg ariaLabel="Эффект появления" value={preset.appear}
              onChange={(v) => updatePreset((p) => { p.appear = v; })}
              options={[
                { value: 'none', label: 'Нет' },
                { value: 'fade', label: 'Fade' },
                { value: 'slide', label: 'Slide' },
              ]} />
          </PRow>
          <PRow label="Громкость">
            <input type="range" className="st-range" min={0} max={100} value={preset.volume}
              onChange={(e) => updatePreset((p) => { p.volume = +e.target.value; })} />
            <span className="num" style={{ fontSize: 12, color: 'var(--text2)', width: 32, textAlign: 'right' }}>
              {preset.volume}%
            </span>
          </PRow>
          <PRow label="Звук доната">
            <Pick label="Звук в начале алерта"
              value={preset.alertSound || ''}
              onChange={(v) => updatePreset((p) => { p.alertSound = v; })}
              options={[
                { value: '', label: 'Без звука' },
                ...ALERT_SOUNDS.map((s) => ({ value: s.code, label: s.name })),
              ]} />
            <button
              type="button" className="icon-btn" title="Послушать"
              disabled={!preset.alertSound}
              onClick={() => playAlertSound(preset.alertSound, preset.volume)}
            >
              <FontAwesomeIcon icon={faPlay} style={{ fontSize: 12 }} />
            </button>
          </PRow>
          <div className="hint">Звучит в начале каждого алерта — и в превью, и в оверлее.</div>
        </div>

        <div className="gfoot">
          <span className="gfoot-note">Изменения сохраняются автоматически</span>
          <div className="gfoot-actions">
            <Button
              variant="primary"
              onClick={() => {
                const d = provider.simulateTest();
                (onPreview ?? sendTestToOverlay)(d);
                if (demoProvider && preset.appear !== 'none') setPlayAnim(preset.appear);
                toast(demoProvider ? 'Тестовый алерт. Деньги не переводятся; статистика не меняется.' : 'Тестовый алерт: превью справа снизу и в оверлее. В статистику не входит.');
              }}
            >
              Тестовый донат
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
