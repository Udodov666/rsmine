import { useEffect, useRef, useState } from 'react';
import { getMockProvider } from '../data/mock/MockProvider';
import { getProvider } from '../data/providerSwitch';
import { pickMedia, isVideoUrl, isReadyMedia } from '../data/defaults';
import { cartesiaSpeak, stopCartesiaAudio } from '../lib/cartesia';
import { maskAlertText } from '../lib/moderation';
import { playAlertSound, stopAlertSound } from '../lib/sounds';
import { apiBase, authHeaders, getTwitch } from '../data/live/auth';
import { isLiveMode } from '../data/providerSwitch';
import { buildLd1 } from '../lib/ld1';
import { runEffect } from '../lib/effects';
import type { Donation } from '../data/types';
import type { DataProvider } from '../data/provider';

/* Шина превью: прямая модульная ссылка, без window-событий
   (CustomEvent из изолированных world не долетает до слушателей страницы). */
type PreviewCb = (d: Donation) => void;
let cb: PreviewCb | null = null;

export function onDonationPreview(fn: PreviewCb) {
  cb = fn;
  return () => {
    if (cb === fn) cb = null;
  };
}

export function showDonationPreview(d: Donation | null) {
  if (d && cb) cb(d);
}

/** Тестовые события (тест/повтор) идут в оверлей OBS через SSE-релей,
 *  а не в плавающее превью на сайте. Демо/мок — прежнее превью на странице. */
export function sendTestToOverlay(d: Donation | null): void {
  if (!d) return;
  if (!isLiveMode() || !getTwitch()) {
    showDonationPreview(d);
    return;
  }
  const feat = (code: string) => d.features.find((f) => f.kind === code)?.code;
  void fetch(`${apiBase()}/api/relay/${encodeURIComponent(getTwitch()!.slug)}/broadcast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({
      sum: d.shownSum,
      username: d.anonymous ? 'Аноним' : d.username,
      text: buildLd1({
        voice: feat('voice'),
        effect: feat('effect'),
        anonymous: d.anonymous,
        text: d.text ?? '',
      }),
    }),
  }).catch(() => { /* оверлей офлайн — тест просто не дойдёт */ });
}

/**
 * Плавающее превью алерта в панели (как «Повторить оповещение» у DA,
 * но видимое без OBS): рендерит донат активным пресетом, автоскрытие по durationSec.
 */
export default function AlertPreviewHost({ demoProvider, donation, inline = false, safeDemo = false }: { demoProvider?: DataProvider; donation?: Donation | null; inline?: boolean; safeDemo?: boolean } = {}) {
  const provider = demoProvider ?? getProvider();
  const [localCurrent, setCurrent] = useState<Donation | null>(null);
  const current = donation === undefined ? localCurrent : donation;
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => donation === undefined ? onDonationPreview(setCurrent) : undefined, [donation === undefined]);

  const cfg = provider.getConfig();
  const preset = cfg?.presets.find((p) => p.id === cfg.activePresetId) ?? cfg?.presets[0];

  useEffect(() => {
    if (!current) return;
    const t = window.setTimeout(() => setCurrent(null), (preset?.durationSec ?? 6) * 1000);
    return () => window.clearTimeout(t);
  }, [current, preset]);

  // Звук начала алерта в превью — тот же, что уйдёт в оверлей.
  useEffect(() => {
    if (!current || !preset || !preset.alertSound || preset.volume <= 0) return;
    playAlertSound(preset.alertSound, preset.volume);
    return () => stopAlertSound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  // Озвучка теста/повтора — тот же Cartesia, что в оверлее; без сети — фолбэк SpeechSynthesis.
  // Читает РЕНДЕР сообщения пресета (то, что показано в алерте), а не сырой текст доната.
  useEffect(() => {
    if (safeDemo || !current || !preset) return;
    const feat = current.features.find((f) => f.kind === 'voice');
    if (!feat || preset.volume <= 0) return;
    const ttsId = cfg?.voices.find((v) => v.code === feat.code)?.ttsId;
    const text = preset.textTemplate.replace('{текст}', current.text ?? '').trim();
    if (!text) return;
    let alive = true;
    cartesiaSpeak(text, { voiceId: ttsId, volume: preset.volume, slug: getTwitch()?.slug }).catch(() => {
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
  }, [current]);

  // Эффект теста/повтора — на всю страницу, как на стриме; тряска — сама превьюшка.
  useEffect(() => {
    if (!current) return;
    const feat = current.features.find((f) => f.kind === 'effect');
    if (!feat) return;
    runEffect(feat.code, inline ? alertRef.current : document.body, alertRef.current);
  }, [current]);

  if (!current || !preset) return <span data-testid="preview-slot" hidden />;

  const name = current.anonymous ? 'Аноним' : current.username;
  const title = preset.titleTemplate
    .replace('{имя}', name)
    .replace('{сумма}', String(current.shownSum));
  const message = maskAlertText(preset.textTemplate.replace('{текст}', current.text ?? ''), cfg?.bannedWords ?? []);
  const media = pickMedia(preset, current.shownSum);
  const mediaIsVideo = !!media && isVideoUrl(media);
  const readyRound = media && isReadyMedia(media) ? preset.radius : 0;
  const textShadow = preset.shadow ? '0 2px 10px rgba(0,0,0,.65)' : 'none';
  const bodyShadow = preset.shadow
    ? '-1px -1px 0 rgba(0,0,0,.95), 1px -1px 0 rgba(0,0,0,.95), -1px 1px 0 rgba(0,0,0,.95), 1px 1px 0 rgba(0,0,0,.95), 0 2px 8px rgba(0,0,0,.95), 0 4px 20px rgba(0,0,0,.75)'
    : 'none';
  const badge =
    current.kind === 'test' ? 'ТЕСТ' : current.kind === 'replay' ? 'ПОВТОР' : 'предпросмотр';

  return (
    <div className={`preview-host${inline ? ' preview-inline' : ''}`}>
      <div
        ref={alertRef}
        key={current.operationId}
        className={`ov-alert ${preset.appear === 'none' ? '' : `anim-${preset.appear}`}`}
        style={{
          containerType: 'inline-size',
          borderRadius: preset.radius,
          padding: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 260,
          width: 360,
        }}
      >
        {media && (mediaIsVideo ? (
          <video src={media} autoPlay muted loop playsInline style={{ width: '100%', height: 'auto', maxHeight: '32cqw', objectFit: 'contain', borderBottomLeftRadius: readyRound, borderBottomRightRadius: readyRound, flex: 'none', display: 'block' }} />
        ) : (
          <img src={media} alt="" style={{ width: '100%', height: 'auto', maxHeight: '32cqw', objectFit: 'contain', borderBottomLeftRadius: readyRound, borderBottomRightRadius: readyRound, flex: 'none', display: 'block' }} />
        ))}
        <div style={{ padding: '10px 16px', textAlign: preset.titleAlign }}>
          <span className="ov-status">{badge}</span>
          <div style={{ color: preset.titleColor, fontWeight: 800, fontSize: 20, lineHeight: 1.15, textShadow: textShadow }}>
            {title}
          </div>
          {message.trim() && (
            <div style={{ color: '#fff', fontSize: 13, lineHeight: 1.35, fontWeight: 600, opacity: 1, textShadow: bodyShadow, marginTop: 6, textAlign: preset.titleAlign }}>
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}