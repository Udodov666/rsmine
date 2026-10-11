import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronDown, Mic, Sparkles, VolumeX } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBan, faBolt, faChampagneGlasses, faCheck, faHeart, faPlay } from '@fortawesome/free-solid-svg-icons';
import { getProvider, isLiveMode } from '../data/providerSwitch';
import { fetchPublicViaServer } from '../data/live/api';
import { requestInvoice } from '../data/live/relay';
import type { DataProvider } from '../data/provider';
import { buildLd1, sanitizeText } from '../lib/ld1';
import { donationMoney, getAmountError, getAmountPresets, parseAmount } from './donationAmount';
import { CARTESIA_RU_VOICES } from '../lib/cartesia';
import { EFFECT_META } from '../lib/effects';
import { FREE_VOICE_CODE } from '../data/defaults';
import { Button } from '../components/Button';
import { EmptyState } from '../components/Bits';
import { useToast } from '../components/Toast';
import { createLztInvoice } from '../lib/lzt';
import type { Donation, PublicConfig, VoiceItem } from '../data/types';
import rsmineLogo from '../app/assets/rsmine.svg';
import AvatarArt, { demoAvatar, useAvatarArtSettings } from './AvatarArt';

/** Иконки эффектов в поповере. */
const EFFECT_ICONS: Record<string, typeof faBolt> = {
  confetti: faChampagneGlasses,
  hearts: faHeart,
  flash: faBolt,
};
function VoiceOption({ v, selected, playing, hint, onPlay, onSelect }: {
  v: VoiceItem; selected: boolean; playing: boolean; hint: string;
  onPlay: () => void; onSelect: () => void;
}) {
  return (
    <div className={`dp-vrow ${selected ? 'on' : ''}`}>
      <button
        type="button"
        className={`voice-play ${playing ? 'on' : ''}`}
        title={playing ? 'Остановить' : 'Послушать голос'}
        onClick={(e) => { e.stopPropagation(); onPlay(); }}
      >
        {playing ? (
          <span className="eq"><i /><i /><i /><i /></span>
        ) : (
          <FontAwesomeIcon icon={faPlay} style={{ fontSize: 11 }} />
        )}
      </button>
      <button type="button" className="dp-voice-select" aria-pressed={selected} onClick={onSelect}>
        <span className="voice-info">
          <span className="voice-name">
            {v.name}
            {v.code === FREE_VOICE_CODE && <span className="dp-free">бесплатный</span>}
          </span>
          <span className="voice-hint">{hint}</span>
        </span>
        <span className="dp-price num">{v.price > 0 ? `+${v.price} ₽` : 'бесплатно'}</span>
      </button>
    </div>
  );
}

/**
 * Публичная страница доната: сумма → необязательный ник → сообщение.
 * Быстрые суммы и свободный ввод синхронизированы; итог — только на кнопке.
 */
export default function DonatePage({ slug, design = 'classic', demoProvider, onDemoDonation, justPaid = false }: { slug: string; design?: 'classic' | 'studio' | 'stacked' | 'blur'; demoProvider?: DataProvider; onDemoDonation?: (d: Donation) => void; justPaid?: boolean }) {
  const isStudio = design !== 'classic';
  const isStacked = design === 'stacked' || design === 'blur';
  const isBlur = design === 'blur';
  const provider = demoProvider ?? getProvider();
  const [revision, force] = useState(0);
  const cfgLocal: PublicConfig | null = useMemo(() => provider.getPublicConfig(slug), [provider, slug, revision]);
  // live-режим: зритель берёт публичный конфиг стримера с сервера (у него нет localStorage стримера)
  const [cfgRemote, setCfgRemote] = useState<PublicConfig | null>(null);
  const [remoteDone, setRemoteDone] = useState(false);
  useEffect(() => {
    if (!isLiveMode() || demoProvider) {
      setCfgRemote(null);
      setRemoteDone(true);
      return;
    }
    let on = true;
    setRemoteDone(false);
    fetchPublicViaServer(slug).then((c) => {
      if (on) {
        setCfgRemote(c);
        setRemoteDone(true);
      }
    });
    return () => {
      on = false;
    };
  }, [slug, demoProvider]);
  const cfg: PublicConfig | null = (isLiveMode() && !demoProvider ? cfgRemote : null) ?? cfgLocal;

  const { settings: artSettings } = useAvatarArtSettings(slug, slug === 'demo' ? demoAvatar : (cfg?.avatar || demoAvatar));

  const [amountText, setAmountText] = useState(String(cfg ? (100 >= cfg.minimum ? 100 : cfg.minimum) : 100));
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  // по умолчанию выбран всегда-бесплатный мужской голос
  const [voice, setVoice] = useState(
    cfg?.voices.some((v) => v.code === FREE_VOICE_CODE) ? FREE_VOICE_CODE : '',
  );
  const [effect, setEffect] = useState('');
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [fxOpen, setFxOpen] = useState(false);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // возврат с оплаты LZT (?paid=1 в urlSuccess): экран успеха вместо формы
  const [paidVisible, setPaidVisible] = useState(justPaid);
  const toast = useToast();

  function dismissPaid() {
    setPaidVisible(false);
    // чистим ?paid=1 из адреса, дизайн сохраняем
    const extra = design && design !== 'blur' ? `?design=${design}` : '';
    window.location.hash = `/d/${slug}${extra}`;
  }

  const amountRef = useRef<HTMLInputElement | null>(null);
  const submitLock = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  useEffect(() => provider.subscribe(() => force((v) => v + 1)), [provider]);
  useEffect(() => () => audioRef.current?.pause(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setVoiceOpen(false); setFxOpen(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!cfg) {
    // live-режим: пока снапшот едет — тихий лоадер, чтобы не мигать «не найдена»
    if (!remoteDone) {
      return (
        <div className="dp">
          <div className="dp-card dp-none" style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <span className="g-dot" />
          </div>
        </div>
      );
    }
    return (
      <div className="dp">
        <div className="dp-card dp-none">
          <EmptyState
            action={
              <Button variant="ghost" onClick={() => (window.location.hash = '/app')}>
                В панель
              </Button>
            }
          >
            Страница не найдена или стример отключил приём донатов.
          </EmptyState>
        </div>
      </div>
    );
  }

  const amount = parseAmount(amountText);
  const validationError = getAmountError(amountText, cfg.minimum);
  const presets = getAmountPresets(cfg.minimum);
  const voiceItem = cfg.voices.find((v) => v.code === voice);
  const effectItem = cfg.effects.find((e) => e.code === effect);
  const total = Math.round(((amount ?? 0) + (voiceItem?.price ?? 0) + (effectItem?.price ?? 0)) * 100) / 100;
  const hints = new Map(CARTESIA_RU_VOICES.map((c) => [c.id, c.hint]));
  const fxHints = new Map(EFFECT_META.map((m) => [m.code, m.hint]));

  // демо-озвучка голоса в поповере: статические wav, как во вкладке «Озвучка» панели
  async function playDemo(code: string) {
    if (playing === code) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlaying(null);
      return;
    }
    audioRef.current?.pause();
    audioRef.current = null;
    setPlaying(code);
    try {
      const head = await fetch(`/tts-demo/${code}.wav`, { method: 'HEAD' });
      if (head.ok) {
        const a = new Audio(`/tts-demo/${code}.wav`);
        audioRef.current = a;
        a.onended = () => setPlaying((c) => (c === code ? null : c));
        a.onerror = () => setPlaying((c) => (c === code ? null : c));
        await a.play();
        return;
      }
    } catch { /* файла нет */ }
    setPlaying((c) => (c === code ? null : c));
  }

  function pickAmount(v: number) {
    setAmountText(String(v));
    setAmountError(null);
  }

  const submit = async () => {
    if (submitLock.current) return;
    const error = getAmountError(amountText, cfg.minimum);
    if (error) {
      setAmountError(error);
      amountRef.current?.focus();
      return;
    }
    setAmountError(null);
    submitLock.current = true;
    setSubmitting(true);
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 650));
      const clean = sanitizeText(text, cfg.textLimit);
      const isAnon = name.trim() === '';
      const comment = buildLd1({ voice: voice || undefined, effect: effect || undefined, anonymous: isAnon, text: clean });
      // Демо: вместо native LZT перевода — mock-событие в общий стор.
      // Деньги не переводятся; в live здесь открылось бы окно перевода LZT (S3).
      // live: счёт через релей (воркер → Tauri стримера → LZT) и редирект на оплату
      if (!demoProvider && isLiveMode()) {
        // ?paid=1 — после оплаты LZT вернёт сюда: покажем экран успеха
        const urlSuccess = /^(localhost|127\.)/.test(window.location.hostname)
          ? 'https://lolz.live/'
          : `${window.location.origin}/#/d/${slug}?paid=1`;
        const result = await requestInvoice(slug, { sum: total, comment, urlSuccess });
        // ссылку на оплату принимаем только с https — иначе это не LZT
        if (result.payUrl && /^https:\/\//i.test(result.payUrl)) {
          window.location.href = result.payUrl;
          return;
        }
        if (result.payUrl) {
          toast('Подозрительная ссылка оплаты — платёж отменён.');
          return;
        }
        // оффлайн/ошибка LZT — честный отказ, никаких фейковых донатов
        toast(result.error ?? 'Не удалось создать донат. Попробуйте позже.');
        return;
      }
      const liveCfg = provider.getConfig();
      const token = liveCfg.lztToken?.trim();
      const merchantId = String(liveCfg.merchantId ?? '').trim();
      if (!demoProvider && token && merchantId) {
        try {
          const { payUrl } = await createLztInvoice({
            token,
            sum: total,
            comment,
            merchantId,
            // LZT не принимает localhost в url_success — на локали подменяем заглушкой
            urlSuccess: /^(localhost|127\.)/.test(window.location.hostname)
              ? 'https://lolz.live/'
              : `${window.location.origin}/#/d/${slug}?paid=1`,
          });
          if (!/^https:\/\//i.test(payUrl)) throw new Error('Подозрительная ссылка оплаты.');
          window.location.href = payUrl;
          return;
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('[lzt-invoice]', e);
          toast(e instanceof Error ? e.message : 'Не вышло создать счёт LZT.');
        }
      }
      const created = provider.ingest({
        operationId: `op_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
        incomingSum: total,
        comment,
        username: isAnon ? 'Аноним' : name.trim(),
      });
      if (created) onDemoDonation?.(created);
      setSent(true);
      setText('');
      window.setTimeout(() => setSent(false), 2600);
    } catch {
      setAmountError('Не удалось отправить донат. Попробуйте ещё раз.');
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  const voiceRows = (
    <>
      <button type="button" aria-pressed={voice === ''}
        className={`dp-vrow ${voice === '' ? 'on' : ''}`}
        onClick={() => { setVoice(''); setVoiceOpen(false); }}
      >
        <span className="dp-vrow-ico"><VolumeX size={14} strokeWidth={1.8} /></span>
        <div className="voice-info">
          <span className="voice-name">Без озвучки</span>
          <span className="voice-hint">Текст покажут в алерте без звука</span>
        </div>
      </button>
      {(['female', 'male'] as const).map((g) => {
        const list = cfg.voices.filter((v) => v.gender === g);
        if (list.length === 0) return null;
        return (
          <div key={g}>
            <div className="dp-pop-group">{g === 'female' ? 'Женские' : 'Мужские'}</div>
            {list.map((v) => (
              <VoiceOption key={v.code} v={v}
                selected={voice === v.code}
                playing={playing === v.code}
                hint={hints.get(v.ttsId ?? '') ?? 'Русский голос'}
                onPlay={() => playDemo(v.code)}
                onSelect={() => { setVoice(v.code); setVoiceOpen(false); }} />
            ))}
          </div>
        );
      })}
      {cfg.voices.filter((v) => !v.gender).map((v) => (
        <VoiceOption key={v.code} v={v}
          selected={voice === v.code}
          playing={playing === v.code}
          hint={hints.get(v.ttsId ?? '') ?? 'Русский голос'}
          onPlay={() => playDemo(v.code)}
          onSelect={() => { setVoice(v.code); setVoiceOpen(false); }} />
      ))}
    </>
  );

  const fxRows = (
    <>
      <button type="button" aria-pressed={effect === ''}
        className={`dp-vrow ${effect === '' ? 'on' : ''}`}
        onClick={() => { setEffect(''); setFxOpen(false); }}
      >
        <span className="dp-vrow-ico"><FontAwesomeIcon icon={faBan} style={{ fontSize: 11 }} /></span>
        <div className="voice-info">
          <span className="voice-name">Без эффекта</span>
          <span className="voice-hint">Просто алерт, ничего лишнего</span>
        </div>
      </button>
      {cfg.effects.map((e) => (
        <button type="button" aria-pressed={effect === e.code} key={e.code} className={`dp-vrow ${effect === e.code ? 'on' : ''}`} onClick={() => { setEffect(e.code); setFxOpen(false); }}>
          <span className="dp-vrow-ico"><FontAwesomeIcon icon={EFFECT_ICONS[e.code] ?? faBolt} style={{ fontSize: 12 }} /></span>
          <div className="voice-info">
            <span className="voice-name">{e.name}</span>
            <span className="voice-hint">{fxHints.get(e.code) ?? 'Эффект на сцене'}</span>
          </div>
          <span className="dp-price num">{e.price > 0 ? `+${e.price} ₽` : 'бесплатно'}</span>
        </button>
      ))}
    </>
  );

  return (
    <div className={`dp${isStudio ? ` dp-studio${isStacked ? ' dp-stacked' : ''}${design === 'blur' ? ' dp-blur' : ''}` : ''}`}>
      {isStudio && design !== 'blur' && (
        <header className="studio-topbar">
          <a className="studio-brand" href={`#/d/${slug}?design=studio`}><img className="studio-icon" src={rsmineLogo} alt="RSMine" /><span>RSMine</span> <span className="studio-edition">/ studio</span></a>
          <nav className="studio-switch" aria-label="Дизайн страницы">
            <a href={`#/d/${slug}`}>Классика</a>
            <a href={`#/d/${slug}?design=studio`} aria-current={design === 'studio' ? 'page' : undefined}>Studio</a>
            <a href={`#/d/${slug}?design=stacked`} aria-current={design === 'stacked' ? 'page' : undefined}>Сверху</a>
            <a href={`#/d/${slug}?design=blur`}>Blur</a>
          </nav>
        </header>
      )}
      {/* ─── шапка стримера ─── */}
      <div className="dp-card dp-head">
        <div className={`dp-cover${isStacked ? ' dp-cover-art' : ''}`}>
          {isStacked ? <AvatarArt source={artSettings.source} variation={artSettings.variation}/> : <b>{(cfg.streamerName[0] ?? '?').toUpperCase()}</b>}
          {isStacked && design !== 'blur' && <a className="dp-art-tool" href={`#/banner-lab/${slug}`} aria-label="Открыть генератор обложки">Генератор ↗</a>}
        </div>
        <div className="dp-head-row">
          <img className="dp-ava" src={isStacked ? artSettings.source : cfg.avatar} alt="" />
          <div className="dp-id">
            <div className="dp-name">
              {cfg.streamerName} <span className="dp-online" title="Стример в сети" />
            </div>
            {cfg.bio && <div className="dp-bio">{cfg.bio}</div>}
          </div>
        </div>
        <div className="dp-greet">{cfg.greeting}</div>
      </div>

      {/* ─── возврат с оплаты: только успех, формы нет ─── */}
      {paidVisible && (
        <div className="dp-card" style={{ textAlign: 'center', paddingTop: 32, paddingBottom: 28 }}>
          <span
            aria-hidden="true"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 44, height: 44, borderRadius: '50%',
              background: 'rgba(16, 164, 90, .14)', color: '#10a45a',
            }}
          >
            <FontAwesomeIcon icon={faCheck} style={{ fontSize: 20 }} />
          </span>
          <div style={{ marginTop: 12, fontSize: 18, fontWeight: 600 }}>Донат оплачен!</div>
          <div style={{ marginTop: 6, fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.55 }}>
            Спасибо за поддержку! Алерт появится на стриме в течение минуты.
          </div>
          <Button variant="ghost" onClick={dismissPaid} style={{ marginTop: 18 }}>
            Отправить ещё
          </Button>
        </div>
      )}

      {/* ─── форма доната (после оплаты скрыта — только успех выше) ─── */}
      {!paidVisible && (
      <form className="dp-card dp-form" noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        {isStudio && <div className="studio-form-intro">
          <h1>Поддержать стрим</h1>
        </div>}
        <section className="dp-amount-section" aria-labelledby="donation-amount-title">
          <div className="dp-sec-head dp-amount-head">
            <h2 id="donation-amount-title" className="dp-sec-title">Сумма доната</h2>
            <span id="donation-minimum" className="dp-sec-note num">От {donationMoney(cfg.minimum)}</span>
          </div>
          <div className={`dp-amount ${amountError ? 'error' : ''}`}>
            <label htmlFor="donation-amount">Своя сумма</label>
            <div className="dp-amount-entry">
              <input id="donation-amount" ref={amountRef} className="num"
                type="text" inputMode="decimal" autoComplete="off" maxLength={24}
                placeholder="0" disabled={submitting}
                aria-invalid={!!amountError}
                aria-describedby={`donation-minimum${amountError ? ' donation-amount-error' : ''}`}
                value={amountText}
                onChange={(e) => {
                  setAmountText(e.target.value);
                  if (amountError) setAmountError(getAmountError(e.target.value, cfg.minimum));
                }}
                onBlur={(e) => {
                  // Let button clicks finish before displaying an error that changes layout.
                  if ((e.relatedTarget as HTMLElement | null)?.closest('.dp-preset, .dp-submit')) return;
                  const error = getAmountError(amountText, cfg.minimum);
                  setAmountError(error);
                  if (!error && amount !== null) setAmountText(String(amount).replace('.', ','));
                }}
              />
              <span className="dp-currency" aria-hidden="true">₽</span>
            </div>
          </div>
          {amountError && <p id="donation-amount-error" className="dp-field-error" role="alert">{amountError}</p>}
          <div className="dp-presets" role="group" aria-label="Быстрый выбор суммы">
            {presets.map((v) => (
              <button key={v} type="button" disabled={submitting}
                aria-pressed={amount === v}
                className={`dp-preset ${amount === v ? 'on' : ''}`}
                onClick={() => pickAmount(v)}>
                {isBlur && amount === v && (
                  <motion.span className="dp-pill-bg" layoutId="dp-blur-pill" transition={{ type: 'spring', stiffness: 550, damping: 40 }} />
                )}
                <span className={`tab num ${amount === v ? 'on' : ''}`}>{donationMoney(v)}</span>
              </button>
            ))}
          </div>
        </section>

        <div className="dp-name-field">
          <div className="dp-sec-head">
            <label className="dp-sec-title" htmlFor="donation-name">Ваш ник</label>
            <span className="dp-sec-note">Необязательно</span>
          </div>
          <input id="donation-name" className="st-input dp-name-input"
            name="nickname" autoComplete="nickname" placeholder="Аноним"
            maxLength={32} value={name} disabled={submitting}
            onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="dp-sec-head">
          <label htmlFor="donation-message" className="dp-sec-title">Сообщение</label>
          <span className="dp-sec-note">Необязательно</span>
        </div>
        <div className="dp-msg">
          <textarea
            id="donation-message" className="dp-msg-text" maxLength={cfg.textLimit}
            aria-describedby="donation-message-count" disabled={submitting}
            placeholder="Сказать что-то хорошее…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="dp-msg-bar">
            <div className="dp-voice">
              <button type="button" className={`dp-vchip ${voiceItem ? 'on' : ''}`} disabled={submitting}
                aria-expanded={voiceOpen} aria-controls="donation-voices"
                onClick={() => { setVoiceOpen((o) => !o); setFxOpen(false); }}>
                <Mic size={13} strokeWidth={1.8} />
                {voiceItem ? `Озвучка: ${voiceItem.name}` : 'Озвучка'}
                {voiceItem && voiceItem.price > 0 && <span className="num">+{voiceItem.price} ₽</span>}
                <ChevronDown size={12} strokeWidth={1.8} />
              </button>
              {voiceOpen && (
                <>
                  <div className="pop-backdrop" onClick={() => setVoiceOpen(false)} />
                  <div id="donation-voices" className="dp-pop dp-pop-up" role="group" aria-label="Голоса озвучки">{voiceRows}</div>
                </>
              )}
            </div>
            {cfg.effects.length > 0 && (
              <div className="dp-voice">
                <button type="button" className={`dp-vchip ${effectItem ? 'on' : ''}`} disabled={submitting}
                  aria-expanded={fxOpen} aria-controls="donation-effects"
                  onClick={() => { setFxOpen((o) => !o); setVoiceOpen(false); }}>
                  <Sparkles size={13} strokeWidth={1.8} />
                  {effectItem ? `Эффект: ${effectItem.name}` : 'Эффект'}
                  {effectItem && effectItem.price > 0 && <span className="num">+{effectItem.price} ₽</span>}
                  <ChevronDown size={12} strokeWidth={1.8} />
                </button>
                {fxOpen && (
                  <>
                    <div className="pop-backdrop" onClick={() => setFxOpen(false)} />
                    <div id="donation-effects" className="dp-pop dp-pop-up" role="group" aria-label="Эффекты">{fxRows}</div>
                  </>
                )}
              </div>
            )}
            <span id="donation-message-count" className="num dp-msg-count">{text.length} / {cfg.textLimit}</span>
          </div>
        </div>
        {text.includes('|') && (
          <div className="field-error">Символ «|» будет заменён пробелом.</div>
        )}

        <Button
          variant="primary" type="submit" className="dp-submit"
          style={{ width: '100%', height: design === 'blur' ? 50 : isStudio ? 56 : 44, marginTop: 24, fontSize: design === 'blur' ? 17 : isStudio ? 19 : 14 }}
          loading={submitting}
          success={sent}
          loadingText={demoProvider ? 'Показываем' : 'Отправляем'}
        >
          {demoProvider ? (validationError ? 'Показать алерт' : `Показать алерт · ${donationMoney(total)}`) : (validationError ? 'Отправить донат' : `Отправить ${donationMoney(total)}`)}
        </Button>
      </form>
      )}
    </div>
  );
}
