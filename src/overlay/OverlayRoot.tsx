import { useEffect, useRef, useState } from 'react';
import { getMockProvider } from '../data/mock/MockProvider';
import { getProvider, isLiveMode } from '../data/providerSwitch';
import { isAuthed, apiBase, getTwitch } from '../data/live/auth';
import { fetchPublicViaServer } from '../data/live/api';
import { pickMedia, isVideoUrl, isReadyMedia, defaultConfig } from '../data/defaults';
import { parseLd1, sanitizeText } from '../lib/ld1';
import { cartesiaSpeak, stopCartesiaAudio } from '../lib/cartesia';
import { maskAlertText } from '../lib/moderation';
import { playAlertSound, stopAlertSound } from '../lib/sounds';
import { runEffect } from '../lib/effects';
import type { Config, Donation, Feature, Preset } from '../data/types';
import GoalBar from './GoalBar';

/**
 * Runtime оверлея (05 §9, 06 §7): прозрачный browser source.
 * Никаких панелей и фона — только очередь алертов и опциональная цель.
 * Live без сессии (OBS) — RemoteOverlay: конфиг-снапшот с сервера + SSE-алерты.
 */
export default function OverlayRoot({ secret }: { secret: string }) {
  // прозрачность для OBS browser source: и body, и html (html по умолчанию --bg)
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
  if (isLiveMode()) {
    // оверлей live всегда слушает SSE-релей: тесты панели и реальные донаты программы.
    // Адрес приватный: #/overlay/<slug>?k=<ключ оверлея> — без ключа релей не отвечает.
    const token = decodeURIComponent(secret);
    const [pathSlug, query] = token.split('?');
    const key = new URLSearchParams(query ?? '').get('k') ?? '';
    const slug = isAuthed() && !key ? (getTwitch()?.slug ?? '') : pathSlug;
    return <RemoteOverlay slug={slug} overlayKey={key} />;
  }
  return <LocalOverlay />;
}

/* ============ LIVE/OBS: снапшот конфига + SSE-алерты (Step 9) ============ */

function donationFromRelay(msg: Record<string, unknown>): Donation | null {
  const sum = Number(msg.sum);
  if (!Number.isFinite(sum) || sum <= 0) return null;
  const rawText = String(msg.text ?? '');
  // комментарий перевода — LD1-payload (голос/эффект/аноним/текст) или простой текст
  const ld1 = parseLd1(rawText, 180);
  const text = ld1 ? ld1.text : sanitizeText(rawText, 180);
  const features: Feature[] = [];
  if (ld1?.voice) features.push({ kind: 'voice', code: ld1.voice });
  if (ld1?.effect) features.push({ kind: 'effect', code: ld1.effect });
  const ts = Number(msg.ts) || Date.now();
  return {
    operationId: `relay_${ts}_${Math.floor(Math.random() * 1e6)}`,
    ts,
    incomingSum: sum,
    shownSum: sum,
    features,
    removedFeatures: [],
    text,
    username: String(msg.username ?? 'зритель'),
    anonymous: !!ld1?.anonymous,
    status: 'finished',
    kind: 'donate',
    configRevision: 0,
  };
}

function RemoteOverlay({ slug, overlayKey }: { slug: string; overlayKey: string }) {
  const [preset, setPreset] = useState<Preset | null>(null);
  const [voices, setVoices] = useState<Array<{ code: string; name: string }>>([]);
  const [banned, setBanned] = useState<string[]>([]);
  const [queue, setQueue] = useState<Donation[]>([]);
  const [current, setCurrent] = useState<Donation | null>(null);

  // снапшот конфига (пресет алерта) + SSE-поток алертов.
  // Снапшот подтягиваем не только на старте, но и каждые 15 сек: иначе
  // смена гифки/позиции в «Дизайне» не доходит до уже открытого оверлея
  // в OBS (источник живёт долго и сам не перезагружается).
  useEffect(() => {
    let on = true;
    const load = () => fetchPublicViaServer(slug).then((c) => {
      if (!on || !c) return;
      // пресет из снапшота; если стример ещё не пересохранял настройки — дефолтный
      // пресет БЕЗ демо-заглушки «GIF» (только текст алерта)
      // пустые/null поля пресета (нетронутый конфиг) не должны затирать базовые:
      // без этого алерт уезжает в угол (x/y = null) и показывает заглушку
      const p = Object.fromEntries(
        Object.entries(c.preset ?? {}).filter(([, v]) => v !== null && v !== undefined),
      );
      setPreset({ ...defaultConfig(Date.now()).presets[0], ...p } as unknown as Preset);
      setVoices(c.voices.map((v) => ({ code: v.code, name: v.name })));
      setBanned(Array.isArray(c.banned) ? c.banned : []);
    });
    load();
    const t = window.setInterval(load, 15000);
    const es = new EventSource(`${apiBase()}/api/relay/${encodeURIComponent(slug)}/events?secret=${encodeURIComponent(overlayKey)}`);
    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as Record<string, unknown>;
        if (msg.type !== 'donation') return;
        const d = donationFromRelay(msg);
        if (d) setQueue((q) => [...q, d]);
      } catch { /* мусор в потоке — игнор */ }
    };
    return () => {
      on = false;
      window.clearInterval(t);
      es.close();
    };
  }, [slug]);

  // очередь: показываем по одному
  useEffect(() => {
    if (current || queue.length === 0) return;
    const [next, ...rest] = queue;
    setCurrent(next);
    setQueue(rest);
  }, [queue, current]);

  // скрытие по durationSec — отдельный эффект: таймер не должен сбрасываться
  // перезапуском очередного эффекта (иначе алерт висит вечно)
  useEffect(() => {
    if (!current) return;
    const t = window.setTimeout(() => setCurrent(null), (preset?.durationSec ?? 6) * 1000);
    return () => window.clearTimeout(t);
  }, [current, preset]);

  return (
    <div className="ov-root">
      {current && preset && <RemoteAlert key={current.operationId} d={current} preset={preset} voices={voices} slug={slug} overlayKey={overlayKey} banned={banned} />}
    </div>
  );
}

/** ttsId голоса: коды конфига → ids Cartesia из дефолтного каталога. */
function voiceTtsId(code: string): string | undefined {
  return defaultConfig(Date.now()).voices.find((v) => v.code === code)?.ttsId;
}

function RemoteAlert({ d, preset, voices, slug, overlayKey, banned }: { d: Donation; preset: Preset; voices: Array<{ code: string; name: string }>; slug: string; overlayKey: string; banned: string[] }) {
  const alertRef = useRef<HTMLDivElement>(null);
  const name = d.anonymous ? 'Аноним' : d.username;
  const title = preset.titleTemplate
    .replace('{имя}', name)
    .replace('{сумма}', String(d.shownSum));
  // мат и ссылки — **** (озвучка читает этот же текст, оригинал в панели цел)
  const message = maskAlertText(preset.textTemplate.replace('{текст}', d.text ?? ''), banned);
  const media = pickMedia(preset, d.shownSum);
  const mediaIsVideo = !!media && isVideoUrl(media);
  const readyRound = media && isReadyMedia(media) ? preset.radius : 0;
  // обводка-контур (8 направлений) + мягкий drop: текст читается и на белом, и на тёмном фоне
  const textShadow = preset.shadow
    ? '-1px -1px 0 rgba(0,0,0,.75), 1px -1px 0 rgba(0,0,0,.75), -1px 1px 0 rgba(0,0,0,.75), 1px 1px 0 rgba(0,0,0,.75), 0 2px 3px rgba(0,0,0,.5), 0 4px 14px rgba(0,0,0,.35)'
    : 'none';
  // описание — мелкий белый текст: ему нужна плотнее обводка (1px + кардинальные 2px)
  // + гало, иначе на светлом фоне игры теряется. Только текстовая тень, без подложки.
  const bodyShadow = preset.shadow
    ? '-1px -1px 0 rgba(0,0,0,.95), 1px -1px 0 rgba(0,0,0,.95), -1px 1px 0 rgba(0,0,0,.95), 1px 1px 0 rgba(0,0,0,.95), -2px 0 0 rgba(0,0,0,.95), 2px 0 0 rgba(0,0,0,.95), 0 -2px 0 rgba(0,0,0,.95), 0 2px 0 rgba(0,0,0,.95), 0 2px 8px rgba(0,0,0,.95), 0 4px 22px rgba(0,0,0,.75)'
    : 'none';

  // авто-подгонка: высокая гифка при нижнем пресете выталкивает текст за кадр —
  // алерт целиком поднимается/сдвигается внутрь источника (в OBS кадр = вьюпорт)
  useEffect(() => {
    const el = alertRef.current;
    if (!el) return;
    const fit = () => {
      const r = el.getBoundingClientRect();
      if (r.bottom > window.innerHeight - 8) {
        el.style.top = `${Math.max(4, window.innerHeight - r.height - 8)}px`;
      }
      if (r.right > window.innerWidth - 8) {
        el.style.left = `${Math.max(4, window.innerWidth - r.width - 8)}px`;
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // звук в начале алерта — сразу, не ждём синтез озвучки
  useEffect(() => {
    if (!preset.alertSound || preset.volume <= 0) return;
    playAlertSound(preset.alertSound, preset.volume);
    return () => stopAlertSound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.operationId]);

  // озвучка: оплаченный голос доната (LD1 v=); фолбэк — SpeechSynthesis, затем тишина
  useEffect(() => {
    const feat = d.features.find((f) => f.kind === 'voice');
    if (!feat || preset.volume <= 0) return;
    const known = voices.some((v) => v.code === feat.code);
    const ttsId = known ? voiceTtsId(feat.code) : undefined;
    const text = message.trim();
    if (!text) return;
    let alive = true;
    // overlayKey обязателен: в OBS нет Twitch-сессии, без ключа прокси
    // отвечает 401 и всё падает в дешёвый системный голос
    cartesiaSpeak(text, { voiceId: ttsId, volume: preset.volume, slug, overlayKey }).catch((e: unknown) => {
      console.warn(`[rsmine-tts] cartesia failed, system fallback: ${e instanceof Error ? e.message : e}`);
      if (!alive) return;
      try {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'ru-RU';
        u.volume = Math.min(1, preset.volume / 100);
        speechSynthesis.speak(u);
      } catch { /* нет TTS — тишина */ }
    });
    return () => {
      alive = false;
      stopCartesiaAudio();
      speechSynthesis.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.operationId]);

  // эффект доната: конфетти/сердечки/вспышка — на всю сцену
  useEffect(() => {
    const feat = d.features.find((f) => f.kind === 'effect');
    if (!feat) return;
    const host = (document.querySelector('.ov-root') as HTMLElement) ?? document.body;
    runEffect(feat.code, host, alertRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.operationId]);

  // позиция и размер — в процентах от источника: алерт ложится одинаково
  // при любом размере browser source (1920×1080 не требуется)
  return (
    <div
      ref={alertRef}
      className={`ov-alert ${preset.appear === 'none' ? '' : `anim-${preset.appear}`}`}
      style={{
        left: `${(preset.x / 1920) * 100}%`,
        top: `${(preset.y / 1080) * 100}%`,
        width: `${(preset.w / 1920) * 100}%`,
        height: 'auto',
        fontSize: `${(preset.fontSize / 1920) * 100}vw`,
        containerType: 'inline-size',
        borderRadius: preset.radius,
        padding: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transformOrigin: '50% 0%',
      }}
    >
      {media && (mediaIsVideo ? (
        <video src={media} autoPlay muted loop playsInline style={{ width: 'auto', maxWidth: '100%', height: '35vh', objectFit: 'contain', alignSelf: 'center', borderBottomLeftRadius: readyRound, borderBottomRightRadius: readyRound, display: 'block', pointerEvents: 'none' }} />
      ) : (
        <img src={media} alt="" style={{ width: 'auto', maxWidth: '100%', height: '35vh', objectFit: 'contain', alignSelf: 'center', borderBottomLeftRadius: readyRound, borderBottomRightRadius: readyRound, display: 'block', pointerEvents: 'none' }} />
      ))}
      <div style={{ padding: '10px 16px', marginTop: media ? 10 : undefined, textAlign: preset.titleAlign }}>
        <div style={{ color: preset.titleColor, fontWeight: 800, fontSize: '1.15em', lineHeight: 1.15, textShadow }}>
          {title}
        </div>
        {message.trim() && (
          <div style={{ color: '#fff', fontSize: '0.62em', lineHeight: 1.35, fontWeight: 600, opacity: 1, textShadow: bodyShadow, marginTop: 6, textAlign: preset.titleAlign }}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============ ЛОКАЛЬНЫЙ РЕЖИМ (сессия/демо) — как раньше ============ */

function LocalOverlay() {
  const provider = getProvider();
  const [, force] = useState(0);
  const [cfg, setCfg] = useState<Config>(() => provider.getConfig());
  const seen = useRef<Set<string>>(new Set());
  const [queue, setQueue] = useState<Donation[]>([]);
  const [current, setCurrent] = useState<Donation | null>(null);

  // тело страницы прозрачное
  useEffect(() => {
    document.body.classList.add('is-overlay');
    return () => document.body.classList.remove('is-overlay');
  }, []);

  useEffect(() => provider.subscribe(() => force((v) => v + 1)), [provider]);

  // «поллинг»: раз в 3с забираем новые операции (демо ускорено, live 5–10с)
  useEffect(() => {
    const poll = () => {
      provider.touchHeartbeat();
      const fresh = provider.listDonations().filter((d) => !seen.current.has(d.operationId));
      if (fresh.length > 0) {
        fresh.forEach((d) => seen.current.add(d.operationId));
        setQueue((q) => [...q, ...fresh.filter((d) => d.status !== 'cancelled')]);
      }
    };
    poll();
    const t = window.setInterval(poll, 3000);
    return () => window.clearInterval(t);
  }, [provider]);

  // актуальный конфиг — на каждый показ
  useEffect(() => {
    setCfg(provider.getConfig());
  }, [provider, current]);

  // очередь: показываем по одному; отменённые снимаем
  useEffect(() => {
    if (current) {
      if (current.status === 'cancelled') setCurrent(null);
      return;
    }
    const next = queue.find((d) => d.status !== 'cancelled');
    if (next) {
      setCurrent(next);
      setQueue((q) => q.filter((d) => d.operationId !== next.operationId));
    }
  }, [queue, current, force]);

  // длительность показа
  useEffect(() => {
    if (!current) return;
    const preset = cfg.presets.find((p) => p.id === cfg.activePresetId) ?? cfg.presets[0];
    const t = window.setTimeout(() => setCurrent(null), (preset?.durationSec ?? 6) * 1000);
    return () => window.clearTimeout(t);
  }, [current, cfg]);

  // демо-генерация случайных донатов — ТОЛЬКО мок; в live фейк запрещён
  useEffect(() => {
    if ((provider as { isMock?: boolean }).isMock === false) return;
    const t = window.setInterval(() => provider.simulateRandomPayment(), 45000);
    return () => window.clearInterval(t);
  }, [provider]);

  const preset = cfg.presets.find((p) => p.id === cfg.activePresetId) ?? cfg.presets[0];

  return (
    <div className="ov-root">
      {current && preset && (
        <AlertView key={current.operationId} d={current} preset={preset} slug={getTwitch()?.slug ?? ''} />
      )}
      {preset?.showGoal && <GoalBar cfg={cfg} />}
    </div>
  );
}

function AlertView({ d, preset, slug }: { d: Donation; preset: Config['presets'][number]; slug: string }) {
  const scale = window.innerWidth / 1920;
  const alertRef = useRef<HTMLDivElement>(null);
  const name = d.anonymous ? 'Аноним' : d.username;
  const title = preset.titleTemplate
    .replace('{имя}', name)
    .replace('{сумма}', String(d.shownSum));
  const bannedWords: string[] = getProvider().getConfig().bannedWords ?? [];
  // мат и ссылки — **** (озвучка читает этот же текст, оригинал в панели цел)
  const message = maskAlertText(preset.textTemplate.replace('{текст}', d.text ?? ''), bannedWords);
  const media = pickMedia(preset, d.shownSum);
  const mediaIsVideo = !!media && isVideoUrl(media);
  const readyRound = media && isReadyMedia(media) ? preset.radius : 0;
  // обводка-контур (8 направлений) + мягкий drop: текст читается и на белом, и на тёмном фоне
  const textShadow = preset.shadow
    ? '-1px -1px 0 rgba(0,0,0,.75), 1px -1px 0 rgba(0,0,0,.75), -1px 1px 0 rgba(0,0,0,.75), 1px 1px 0 rgba(0,0,0,.75), 0 2px 3px rgba(0,0,0,.5), 0 4px 14px rgba(0,0,0,.35)'
    : 'none';
  const bodyShadow = preset.shadow
    ? '-1px -1px 0 rgba(0,0,0,.95), 1px -1px 0 rgba(0,0,0,.95), -1px 1px 0 rgba(0,0,0,.95), 1px 1px 0 rgba(0,0,0,.95), -2px 0 0 rgba(0,0,0,.95), 2px 0 0 rgba(0,0,0,.95), 0 -2px 0 rgba(0,0,0,.95), 0 2px 0 rgba(0,0,0,.95), 0 2px 8px rgba(0,0,0,.95), 0 4px 22px rgba(0,0,0,.75)'
    : 'none';

  // звук в начале алерта — сразу, не ждём синтез озвучки
  useEffect(() => {
    if (!preset.alertSound || preset.volume <= 0) return;
    playAlertSound(preset.alertSound, preset.volume);
    return () => stopAlertSound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.operationId]);

  // Озвучка: Cartesia (sonic-3.6); фолбэк — SpeechSynthesis, затем тишина.
  // Читает РЕНДЕР сообщения пресета (то, что показано в алерте), а не сырой текст доната.
  useEffect(() => {
    const voice = d.features.find((f) => f.kind === 'voice');
    if (!voice || preset.volume <= 0) return;
    const ttsId = getProvider().getConfig().voices.find((v) => v.code === voice.code)?.ttsId;
    const text = message.trim();
    if (!text) return;
    let alive = true;
    cartesiaSpeak(text, { voiceId: ttsId, volume: preset.volume, slug }).catch((e: unknown) => {
      console.warn(`[rsmine-tts] cartesia failed, system fallback: ${e instanceof Error ? e.message : e}`);
      if (!alive) return;
      try {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'ru-RU';
        u.volume = Math.min(1, preset.volume / 100);
        speechSynthesis.speak(u);
      } catch {
        /* нет TTS — молча пропустить озвучку */
      }
    });
    return () => {
      alive = false;
      stopCartesiaAudio();
      speechSynthesis.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.operationId]);

  // эффект доната: конфетти/сердечки/вспышка — на всю сцену, тряска — сам алерт
  useEffect(() => {
    const feat = d.features.find((f) => f.kind === 'effect');
    if (!feat) return;
    const host = (document.querySelector('.ov-root') as HTMLElement) ?? document.body;
    runEffect(feat.code, host, alertRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.operationId]);

  // статус «подтверждается» → «подтверждён»
  const provider = getProvider();
  const [status, setStatus] = useState(d.status);
  useEffect(() => {
    const t = window.setInterval(() => {
      const fresh = provider
        .listDonations()
        .find((x) => x.operationId === d.operationId);
      if (fresh) setStatus(fresh.status);
    }, 1000);
    return () => window.clearInterval(t);
  }, [d.operationId, provider]);

  // позиция и размер — в процентах от источника: алерт ложится одинаково
  // при любом размере browser source (1920×1080 не требуется)
  return (
    <div
      ref={alertRef}
      className={`ov-alert ${preset.appear === 'none' ? '' : `anim-${preset.appear}`}`}
      style={{
        left: `${(preset.x / 1920) * 100}%`,
        top: `${(preset.y / 1080) * 100}%`,
        width: `${(preset.w / 1920) * 100}%`,
        height: 'auto',
        fontSize: `${(preset.fontSize / 1920) * 100}vw`,
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
      <div style={{ padding: '10px 16px', marginTop: media ? 10 : undefined, textAlign: preset.titleAlign }}>
        <span className="ov-status">
          {d.kind === 'test' ? 'ТЕСТ' : d.kind === 'replay' ? 'ПОВТОР' : status === 'finished' ? 'подтверждён' : 'подтверждается'}
        </span>
        <div style={{ color: preset.titleColor, fontWeight: 800, fontSize: '1.15em', lineHeight: 1.15, textShadow }}>
          {title}
        </div>
        {message.trim() && (
          <div style={{ color: '#fff', fontSize: '0.62em', lineHeight: 1.35, fontWeight: 600, opacity: 1, textShadow: bodyShadow, marginTop: 6, textAlign: preset.titleAlign }}>
            {message}
          </div>
        )}
      </div>
    </div>
  )
}
