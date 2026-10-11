/**
 * Звуки начала доната — настоящие семплы из public/sounds (Mixkit, royalty-free),
 * синтез через WebAudio — только запасной, если файла нет.
 * Стример слышит, что донат пришёл, ещё до озвучки. Громкость — слайдер пресета.
 */
export interface AlertSoundMeta {
  code: string;
  name: string;
  hint: string;
}

export const ALERT_SOUNDS: AlertSoundMeta[] = [
  { code: 'coin', name: 'Монеты', hint: 'Звон монет' },
  { code: 'chime', name: 'Колокольчик', hint: 'Уведомление о монетах' },
  { code: 'pop', name: 'Поп', hint: 'Короткий клик' },
  { code: 'fanfare', name: 'Фанфары', hint: 'Победный джингл' },
];

let fileAudio: HTMLAudioElement | null = null;
let soundCtx: AudioContext | null = null;
let liveNodes: AudioNode[] = [];

/** Останавливает недолежавший звук (новый донат поверх). */
export function stopAlertSound(): void {
  if (fileAudio) {
    try { fileAudio.pause(); } catch { /* уже стоп */ }
    fileAudio = null;
  }
  for (const n of liveNodes) {
    try { (n as OscillatorNode).stop?.(); } catch { /* уже стоп */ }
    try { n.disconnect(); } catch { /* уже отцеплен */ }
  }
  liveNodes = [];
}

/** Играет звук начала алерта: сначала семпл, нет файла — синтез. volume — 0..100. */
export async function playAlertSound(code: string, volume = 70): Promise<void> {
  if (!code || volume <= 0) return;
  stopAlertSound();
  try {
    const head = await fetch(`/sounds/${code}.mp3`, { method: 'HEAD' });
    if (head.ok) {
      const a = new Audio(`/sounds/${code}.mp3`);
      a.volume = Math.min(1, Math.max(0, volume / 100));
      fileAudio = a;
      a.onended = () => { if (fileAudio === a) fileAudio = null; };
      a.onerror = () => { if (fileAudio === a) fileAudio = null; };
      await a.play();
      return;
    }
  } catch {
    /* файла нет/автозвук запрещён — пробуем синтез */
  }
  synthPlay(code, volume);
}

function synthCtx(): AudioContext | null {
  try {
    if (!soundCtx) soundCtx = new AudioContext();
    if (soundCtx.state === 'suspended') void soundCtx.resume().catch(() => {});
    return soundCtx;
  } catch {
    return null;
  }
}

interface Tone {
  f0: number;
  f1?: number;
  at: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
}

const RECIPES: Record<string, Tone[]> = {
  coin: [
    { f0: 987.77, at: 0, dur: 0.12, type: 'sine', gain: 0.5 },
    { f0: 1318.51, at: 0.09, dur: 0.5, type: 'sine', gain: 0.5 },
  ],
  chime: [
    { f0: 659.25, at: 0, dur: 0.5, type: 'triangle', gain: 0.4 },
    { f0: 783.99, at: 0.12, dur: 0.5, type: 'triangle', gain: 0.4 },
    { f0: 987.77, at: 0.24, dur: 0.7, type: 'triangle', gain: 0.4 },
  ],
  pop: [
    { f0: 500, f1: 950, at: 0, dur: 0.12, type: 'square', gain: 0.25 },
  ],
  fanfare: [
    { f0: 523.25, at: 0, dur: 0.16, type: 'triangle', gain: 0.45 },
    { f0: 659.25, at: 0.11, dur: 0.16, type: 'triangle', gain: 0.45 },
    { f0: 783.99, at: 0.22, dur: 0.16, type: 'triangle', gain: 0.45 },
    { f0: 1046.5, at: 0.33, dur: 0.45, type: 'triangle', gain: 0.5 },
  ],
};

function synthPlay(code: string, volume: number): void {
  const ac = synthCtx();
  const tones = RECIPES[code];
  if (!ac || !tones) return;
  const master = ac.createGain();
  master.gain.value = Math.min(1, Math.max(0, volume / 100)) * 0.6;
  master.connect(ac.destination);
  const t0 = ac.currentTime + 0.01;
  for (const t of tones) {
    const osc = ac.createOscillator();
    osc.type = t.type ?? 'sine';
    osc.frequency.setValueAtTime(t.f0, t0 + t.at);
    if (t.f1) osc.frequency.exponentialRampToValueAtTime(t.f1, t0 + t.at + t.dur);
    const g = ac.createGain();
    const peak = t.gain ?? 0.5;
    g.gain.setValueAtTime(0.0001, t0 + t.at);
    g.gain.exponentialRampToValueAtTime(peak, t0 + t.at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + t.at + t.dur);
    osc.connect(g).connect(master);
    osc.start(t0 + t.at);
    osc.stop(t0 + t.at + t.dur + 0.05);
    liveNodes.push(osc, g);
    osc.onended = () => {
      liveNodes = liveNodes.filter((n) => n !== osc && n !== g);
    };
  }
}
