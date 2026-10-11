import { useEffect, useRef, useState } from 'react';
import { RotateCcw, X } from 'lucide-react';
import { AppSidebar } from '../app/App';
import Dashboard2 from '../app/routes/Dashboard2';
import { DemoProvider } from '../landing/demo/DemoProvider';
import { NativeAlert } from '../landing/demo/NativeDemos';
import type { Donation } from '../data/types';
import Dither from './Dither';

/** The only reused landing region: original native app, with Figma's chrome and toolbar. */
export default function HeroApp() {
  const [provider] = useState(() => new DemoProvider());
  const [event, setEvent] = useState<Donation | null>(null);
  const [version, setVersion] = useState(0);
  const [scale, setScale] = useState(1);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() =>
      setScale(Math.min(1, el.clientWidth / 1320)),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const config = provider.getConfig();
  return (
    <div
      className="fg-app-box"
      ref={box}
      style={{ height: 748 * scale }}
      onClick={(e) => {
        /* демо-мокап: ссылки внутри панели не ведут никуда */
        const anchor = (e.target as HTMLElement).closest('a');
        if (anchor) e.preventDefault();
      }}
    >
      <div className="fg-app-dither" aria-hidden="true">
        <Dither
          waveSpeed={0.05}
          waveFrequency={3}
          waveAmplitude={0.4}
          waveColor={[0.055, 0.788, 0.502]}
          backgroundColor={[0.973, 0.973, 0.973]}
          colorNum={6}
          pixelSize={2}
          disableAnimation={false}
          enableMouseInteraction={false}
        />
      </div>
      <div
        className="fg-app-window fg-native"
        style={{ transform: `scale(${scale})` }}
      >
        <div className="fg-app-chrome">
          <div aria-hidden="true" className="fg-mac-dots">
            <i />
            <i />
            <i />
          </div>
        </div>
        <div className="fg-app-shell">
          <AppSidebar
            profile={{ name: config.profileName, avatar: config.profileAvatar }}
            navView="dashboard"
            onNavigate={() => {
              /* демо-мокап на лендинге: навигация по страницам приложения отключена */
            }}
          />
          <div className="fg-app-main">
            <div className="fg-app-toolbar">Панель управления</div>
            <div className="fg-app-dashboard">
              <Dashboard2
                key={version}
                demoProvider={provider}
                onPreview={setEvent}
              />
            </div>
            <div className="fg-app-bottom">
              <span>
                Нажмите «Показать донат» — и посмотрите, что произойдёт.
              </span>
              <button
                onClick={() => {
                  provider.reset();
                  setVersion((v) => v + 1);
                  setEvent(null);
                }}
                aria-label="Сбросить демонстрацию панели"
              >
                <RotateCcw size={14} />
                Сбросить
              </button>
            </div>
          </div>
        </div>
        {event && (
          <div className="fg-app-alert">
            <button onClick={() => setEvent(null)} aria-label="Закрыть тест">
              <X size={16} />
            </button>
            <NativeAlert provider={provider} event={event} />
          </div>
        )}
      </div>
    </div>
  );
}
