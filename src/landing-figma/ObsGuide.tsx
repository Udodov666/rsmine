import { useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Film,
  Gamepad2,
  Globe,
  Image,
  Minus,
  Monitor,
  Plus,
  QrCode,
  Settings,
  Copy,
  Check,
} from 'lucide-react';
import QRCode from 'qrcode';
import { copyText } from '../lib/format';
import { obsCopy } from './content';
import penguin from './assets/penguin.png';
import qrFallback from './assets/qr-demo.svg';
import { Reveal } from './Reveal';
const url = () => window.location.origin + '/#/obs-lab-preview';
export default function ObsGuide() {
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState(qrFallback);
  const [showQr, setShowQr] = useState(true);
  const [selected, setSelected] = useState(0);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    QRCode.toDataURL(url(), {
      margin: 0,
      width: 160,
      color: { dark: '#f2f2f2', light: '#262626' },
    })
      .then(setQr)
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(false), 700);
    return () => clearTimeout(t);
  }, [flash]);
  const menu = [
    { Icon: Globe, label: 'Браузер' },
    { Icon: Gamepad2, label: 'Захват игры' },
    { Icon: Image, label: 'Захват окна' },
    { Icon: Monitor, label: 'Захват экрана' },
    { Icon: Film, label: 'Источник медиа' },
  ];
  return (
    <section id="figma-setup" className="fg-setup">
      <Reveal>
        <div className="fg-setup-heading">
          <span className="fg-kicker">ПОДКЛЮЧЕНИЕ OBS</span>
          <h2>
            подготовьте <mark>obs</mark>
            <br />к первому донату
          </h2>
        </div>
      </Reveal>
      <div className="fg-obs-cards">
        {obsCopy.map((copy, index) => (
          <Reveal key={index} delay={index * 0.13} y={34}>
          <article className="fg-obs-card">
            <div className="fg-obs-visual">
              {index === 0 ? (
                <div className="fg-link-visual">
                  <div className="fg-link-panel">
                    <b>Ссылка на оверлей</b>
                    <span>Скопируйте её для источника «Браузер».</span>
                    <div className="fg-link-field">
                      <input
                        readOnly
                        aria-label="Демо-ссылка на оверлей"
                        value={url()}
                        onFocus={(e) => e.target.select()}
                      />
                      <button
                        title="Показать QR-код"
                        aria-expanded={showQr}
                        onClick={() => setShowQr((v) => !v)}
                      >
                        <QrCode size={16} />
                      </button>
                      <button
                        title="Копировать демо-ссылку"
                        onClick={async () => setCopied(await copyText(url()))}
                      >
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                    </div>
                  </div>
                  {showQr && (
                    <div className="fg-link-qr">
                      <img src={qr} alt="QR-код демо-ссылки" />
                    </div>
                  )}
                  <i className="fg-link-shadow-one" />
                  <i className="fg-link-shadow-two" />
                </div>
              ) : index === 1 ? (
                <div className="fg-browser-visual">
                  <div className="fg-browser-toolbar">
                    <Plus size={14} />
                    <Minus size={14} />
                    <Settings size={13} />
                    <span />
                    <ChevronUp size={14} />
                    <ChevronDown size={14} />
                  </div>
                  <div
                    className="fg-browser-menu"
                    aria-label="Пример меню источников OBS"
                  >
                    {menu.map(({ Icon, label }, i) => (
                      <button
                        className={selected === i ? 'selected' : ''}
                        onClick={() => setSelected(i)}
                        key={label}
                      >
                        <Icon size={15} />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <button
                  className={'fg-test-scene ' + (flash ? 'is-testing' : '')}
                  aria-label="Показать тестовый алерт в демо"
                  onClick={() => setFlash(true)}
                >
                  <div className="fg-test-alert">
                    <img src={penguin} alt="Пример медиа алерта" />
                    <b>Nick - 10 RUB!</b>
                    <span>Привет! Лучший стрим</span>
                  </div>
                </button>
              )}
            </div>
            <div className="fg-obs-caption">
              <h3>{copy.title}</h3>
              <p>{copy.description}</p>
            </div>
          </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
