import { useEffect, useRef, useState } from 'react';
import { Play, Square } from 'lucide-react';
import { voices } from './content';
import cartesia from './assets/cartesia.png';
import { Reveal } from './Reveal';
export default function Voices() {
  const [enabled, setEnabled] = useState(voices.flat().map((v) => v.enabled));
  const [playing, setPlaying] = useState<number | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(
    () => () => {
      audio.current?.pause();
    },
    [],
  );
  async function play(index: number, code: string) {
    audio.current?.pause();
    if (playing === index) {
      setPlaying(null);
      return;
    }
    const a = new Audio('/tts-demo/' + code + '.wav');
    audio.current = a;
    a.onended = () => setPlaying(null);
    a.onerror = () => setPlaying(null);
    setPlaying(index);
    try {
      await a.play();
    } catch {
      setPlaying(null);
    }
  }
  return (
    <section id="figma-voices" className="fg-voices">
      <Reveal>
        <div className="fg-voice-heading">
          <span className="fg-kicker">ОЗВУЧКА ДОНАТОВ</span>
          <h2>
            сообщения зрителей
            <br />
            <mark>— голосом на стриме</mark>
          </h2>
          <p>
            Подключите озвучку через готового провайдера
            <br />
            бесплатно и выберите голоса, доступные вашим зрителям.
          </p>
        </div>
      </Reveal>
      <Reveal delay={0.12}>
        <div className="fg-voice-glass">
        <div className="fg-voice-panel">
          {voices.map((group, g) => (
            <div className="fg-voice-column" key={g}>
              <div className="fg-voice-gender">
                {g === 0 ? 'Женские' : 'Мужские'}
              </div>
              {group.map((v, i) => {
                const index = g * 5 + i;
                return (
                  <div className="fg-voice-row" key={index}>
                    <button
                      className={
                        'fg-voice-play ' +
                        (playing === index ? 'is-playing' : '')
                      }
                      aria-label={
                        (playing === index ? 'Остановить' : 'Послушать') +
                        ' ' +
                        v.name +
                        ' ' +
                        (index + 1)
                      }
                      onClick={() => play(index, v.audio)}
                    >
                      {playing === index ? (
                        <Square size={13} fill="currentColor" />
                      ) : (
                        <Play size={13} fill="currentColor" />
                      )}
                    </button>
                    <div className="fg-voice-info">
                      <b>{v.name}</b>
                      <span>{v.hint}</span>
                    </div>
                    <button
                      className="fg-switch"
                      role="switch"
                      aria-label={
                        'Включить голос ' + v.name + ' ' + (index + 1)
                      }
                      aria-checked={enabled[index]}
                      onClick={() =>
                        setEnabled((a) =>
                          a.map((x, n) => (n === index ? !x : x)),
                        )
                      }
                    >
                      <i />
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        </div>
      </Reveal>
      <img className="fg-cartesia" src={cartesia} alt="Cartesia" />
    </section>
  );
}
