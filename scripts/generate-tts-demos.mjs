/**
 * Одноразовый генератор демо-озвучек: синтезирует демо-фразу каждым русским
 * голосом Cartesia, нормализует громкость (тихие голоса вроде Дмитрия
 * подтягиваются к общему уровню) и складывает WAV в public/tts-demo/<code>.wav.
 * Запуск: node scripts/generate-tts-demos.mjs
 * Кнопка демо во вкладке «Озвучка» играет эти файлы; живой API — только фолбэк.
 */
import fs from 'node:fs';
import path from 'node:path';

// Ключ ТОЛЬКО из env (в репо секретам не место):
// CARTESIA_KEY=sk_car_... node scripts/generate-tts-demos.mjs
const KEY = process.env.CARTESIA_KEY || '';
if (!KEY) {
  console.error('Нужен CARTESIA_KEY в окружении. Этот ключ больше не храним в репо.');
  process.exit(1);
}
const VERSION = '2024-06-10';
const OUT_DIR = path.resolve('public/tts-demo');
const TARGET_RMS = 0.115; // ≈ −18.8 dBFS — общий целевой уровень громкости
const MAX_GAIN = 15;      // страховка от дикого буста (тихие голоса вроде Дмитрия ~−42 дБ)
const PEAK_CAP = 0.97;    // потолок пика после усиления

// код = VoiceItem.code из дефолтного каталога (src/data/defaults.ts); ru — имя в демо-фразе
const VOICES = [
  { code: 'natalia', id: '7a62541e-5492-410e-95ff-3abd096fce87', ru: 'Наталия' },
  { code: 'sergei', id: '1e4176b1-3db9-44d6-a601-4fe68b041942', ru: 'Сергей' },
  { code: 'daria', id: '25b7aaa6-1670-42dc-b791-419322400803', ru: 'Дарья' },
  { code: 'alexei', id: '069ff31a-5524-4945-a403-f746ee617507', ru: 'Алексей' },
  { code: 'olga', id: '9ed9f7e7-3ef6-4773-9dd3-ffcb479ca1f0', ru: 'Ольга' },
  { code: 'dmitri', id: '888b7df4-e165-4852-bfec-0ab2b96aaa46', ru: 'Дмитрий' },
  { code: 'tatiana', id: '064b17af-d36b-4bfb-b003-be07dba1b649', ru: 'Татьяна' },
  { code: 'irina', id: '642014de-c0e3-4133-adc0-36b5309c23e6', ru: 'Ирина' },
  { code: 'natalya', id: '779673f3-895f-4935-b6b5-b031dc78b319', ru: 'Наталья' },
];

function readWav(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF') throw new Error('not RIFF');
  let pos = 12;
  let fmt = null;
  let data = null;
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    if (id === 'fmt ') {
      fmt = { channels: buf.readUInt16LE(pos + 10), sampleRate: buf.readUInt32LE(pos + 12) };
    }
    if (id === 'data') {
      data = buf.subarray(pos + 8, pos + 8 + size);
      break;
    }
    pos += 8 + size + (size % 2);
  }
  if (!fmt || !data) throw new Error('bad wav');
  return { fmt, data };
}

function writeWav(samples, sampleRate, channels = 1) {
  const dataSize = samples.length * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * channels * 2, 28);
  buf.writeUInt16LE(channels * 2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) buf.writeInt16LE(samples[i], 44 + i * 2);
  return buf;
}

/** RMS-нормализация: тихие голоса подтягиваются к TARGET_RMS, пик ограничен. */
function normalizePcm(data) {
  const n = data.length >> 1;
  const s = new Int16Array(data.buffer, data.byteOffset, n);
  let peak = 0;
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    const a = Math.abs(s[i]);
    if (a > peak) peak = a;
    sumSq += s[i] * s[i];
  }
  const rms = Math.sqrt(sumSq / n) / 32768;
  if (rms === 0) return { samples: s, gain: 1 };
  let gain = Math.min(TARGET_RMS / rms, MAX_GAIN);
  const peakN = peak / 32768;
  if (peakN > 0) gain = Math.min(gain, PEAK_CAP / peakN);
  for (let i = 0; i < n; i++) {
    let v = Math.round(s[i] * gain);
    if (v > 32767) v = 32767;
    else if (v < -32768) v = -32768;
    s[i] = v;
  }
  return { samples: s, gain };
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const old of fs.readdirSync(OUT_DIR)) {
  if (old.endsWith('.mp3')) fs.unlinkSync(path.join(OUT_DIR, old));
}

for (const v of VOICES) {
  const phrase = `Привет! Демо-озвучка доната, голос ${v.ru}.`;
  let res = await fetch('https://api.cartesia.ai/tts/bytes', {
    method: 'POST',
    headers: { 'X-API-Key': KEY, 'Cartesia-Version': VERSION, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model_id: 'sonic-3.6',
      transcript: phrase,
      voice: { mode: 'id', id: v.id },
      language: 'ru',
      output_format: { container: 'wav', encoding: 'pcm_s16le', sample_rate: 24000 },
    }),
  });
  if (res.status === 400) {
    console.error(`✗ ${v.code}: wav не принят (HTTP 400)`);
    continue;
  }
  if (!res.ok) {
    console.error(`✗ ${v.code}: HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 120)}`);
    continue;
  }
  const { fmt, data } = readWav(Buffer.from(await res.arrayBuffer()));
  const { samples, gain } = normalizePcm(data);
  fs.writeFileSync(path.join(OUT_DIR, `${v.code}.wav`), writeWav(samples, fmt.sampleRate, fmt.channels));
  console.log(`✓ ${v.code} → wav, гейн ×${gain.toFixed(2)}`);
}
console.log('Готово: public/tts-demo/');
