/**
 * Cartesia TTS (sonic-3.6) — озвучка донатов через НАШ воркер-прокси (Step 10).
 * Ключ стримера хранится на сервере (KV tts:slug:<slug>), браузер его не видит:
 * синтез = POST {apiBase}/api/tts/<slug> → WAV. Нет ключа/сети — прокси вернёт
 * ошибку, вызывающий зовёт фолбэк SpeechSynthesis.
 * Грабли вендора: часть голосов отвечает 400 на speed/emotion — ретраим без опций.
 */
import { apiBase, authHeaders } from '../data/live/auth';

export interface CartesiaVoice {
  id: string;
  name: string;
  hint: string;
}

/** Русские голоса Cartesia (GET /voices → language === 'ru'). */
export const CARTESIA_RU_VOICES: CartesiaVoice[] = [
  { id: '7a62541e-5492-410e-95ff-3abd096fce87', name: 'Natalia', hint: 'Steady Strategist' },
  { id: '1e4176b1-3db9-44d6-a601-4fe68b041942', name: 'Sergei', hint: 'Steady Supporter' },
  { id: '25b7aaa6-1670-42dc-b791-419322400803', name: 'Daria', hint: 'Decisive Dispatcher' },
  { id: '069ff31a-5524-4945-a403-f746ee617507', name: 'Alexei', hint: 'Articulate Analyst' },
  { id: '9ed9f7e7-3ef6-4773-9dd3-ffcb479ca1f0', name: 'Olga', hint: 'Confident Saleswoman' },
  { id: '888b7df4-e165-4852-bfec-0ab2b96aaa46', name: 'Dmitri', hint: 'Gentle Voice' },
  { id: '064b17af-d36b-4bfb-b003-be07dba1b649', name: 'Tatiana', hint: 'Friendly Storyteller' },
  { id: '642014de-c0e3-4133-adc0-36b5309c23e6', name: 'Irina', hint: 'Poetic Voice' },
  { id: '779673f3-895f-4935-b6b5-b031dc78b319', name: 'Natalya', hint: 'Soothing Guide' },
];

export const CARTESIA_DEFAULT_VOICE_ID = CARTESIA_RU_VOICES[0].id;

let currentSource: AudioBufferSourceNode | null = null;
let audioCtx: AudioContext | null = null;

/** Останавливает текущую озвучку (новый донат или размонтирование алерта). */
export function stopCartesiaAudio() {
  if (currentSource) {
    try { currentSource.stop(); } catch { /* уже остановлен */ }
    currentSource = null;
  }
}

const TARGET_RMS = 0.115;  // ≈ −18.8 dBFS — общий целевой уровень громкости
const MAX_GAIN = 15;       // страховка от дикого буста (тихие голоса вроде Дмитрия ~−42 дБ)
const PEAK_CAP = 0.97;     // потолок пика после усиления

async function ttsBytes(
  slug: string,
  transcript: string,
  voiceId: string,
  extra?: { emotion?: string; speed?: number; overlayKey?: string },
): Promise<ArrayBuffer> {
  const res = await fetch(`${apiBase()}/api/tts/${encodeURIComponent(slug)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(extra?.overlayKey ? { 'X-Overlay-Key': extra.overlayKey } : {}),
    },
    body: JSON.stringify({
      transcript,
      voiceId,
      emotion: extra?.emotion,
      speed: extra?.speed,
    }),
  });
  if (!res.ok) {
    if (res.status === 400 && extra) return ttsBytes(slug, transcript, voiceId);
    throw new Error(`TTS proxy ${res.status}`);
  }
  return res.arrayBuffer();
}

/**
 * Синтезирует и проигрывает озвучку через Web Audio с нормализацией громкости:
 * тихие голоса (например, Dmitri) подтягиваются к общему уровню, слайдер
 * громкости пресета работает поверх. Возвращает длительность в секундах.
 * slug — аккаунт стримера, чей ключ лежит на сервере (панель — из Twitch-сессии,
 * оверлей — из адреса). Бросает исключение, если синтез/воспроизведение
 * недоступны — на месте можно звать фолбэк.
 */
export async function cartesiaSpeak(
  text: string,
  opts: { voiceId?: string; volume?: number; emotion?: string; speed?: number; slug?: string; overlayKey?: string } = {},
): Promise<number> {
  const slug = opts.slug?.trim();
  if (!slug) throw new Error('tts: slug unknown');
  const voiceId = opts.voiceId || CARTESIA_DEFAULT_VOICE_ID;
  const extra = opts.emotion || opts.speed ? { emotion: opts.emotion, speed: opts.speed } : undefined;
  const buf = await ttsBytes(slug, text, voiceId, { ...extra, overlayKey: opts.overlayKey });
  stopCartesiaAudio();

  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') await audioCtx.resume().catch(() => {});
  const decoded = await audioCtx.decodeAudioData(buf);

  // RMS-нормализация: считаем гейн по фактическому аудио
  const ch = decoded.getChannelData(0);
  let peak = 0;
  let sumSq = 0;
  for (let i = 0; i < ch.length; i++) {
    const a = Math.abs(ch[i]);
    if (a > peak) peak = a;
    sumSq += ch[i] * ch[i];
  }
  const rms = Math.sqrt(sumSq / ch.length);
  let gain = rms > 0 ? Math.min(TARGET_RMS / rms, MAX_GAIN) : 1;
  if (peak > 0) gain = Math.min(gain, PEAK_CAP / peak);

  const src = audioCtx.createBufferSource();
  src.buffer = decoded;
  const vol = audioCtx.createGain();
  vol.gain.value = gain * Math.min(1, Math.max(0, (opts.volume ?? 100) / 100));
  src.connect(vol).connect(audioCtx.destination);
  currentSource = src;
  src.start();
  return new Promise((resolve) => {
    src.onended = () => {
      if (currentSource === src) currentSource = null;
      resolve(decoded.duration || 0);
    };
  });
}
