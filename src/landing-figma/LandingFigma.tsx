import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ChevronUp, Menu, X } from 'lucide-react';
import { twitchAuthorizeUrl } from '../data/live/auth';
import logo from './assets/brand.png';
import HeroApp from './HeroApp';
import Voices from './Voices';
import Designer from './Designer';
import ObsGuide from './ObsGuide';
import { Reveal } from './Reveal';
import { faqItems, projectLinks } from './content';
import './landing-figma.css';

function TwitchMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M2.15 0 0 4.3v15.48h5.16V24l4.3-4.22h3.44L22.37 10.3V0H2.15Zm18.5 9.45-3.44 3.44h-3.44l-3.01 3.01v-3.01H6.88V1.72h13.77v7.73ZM17.21 4.3h-1.72v5.16h1.72V4.3Zm-4.73 0h-1.72v5.16h1.72V4.3Z"
      />
    </svg>
  );
}
export default function LandingFigma() {
  const root = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState(false);
  const [faq, setFaq] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const old = document.title;
    document.title = 'RSMine — донаты с Lolzteam';
    document.documentElement.classList.add('is-figma-landing');
    return () => {
      document.title = old;
      document.documentElement.classList.remove('is-figma-landing');
    };
  }, []);
  useLayoutEffect(() => {
    // CSS-переменные для нижнего градиента заданы статически в style на корневом
    // .fg-root (см. JSX). Динамический пересчёт выключен, чтобы не плыл макет.
  }, []);
  // Мобильный позиционировщик фоновой полосы: тёмная зона обязана покрывать
  // конструктор и заканчиваться до «Подготовьте obs» (на мобиле контент плавает).
  useEffect(() => {
    const apply = () => {
      const rootEl = root.current;
      if (!rootEl) return;
      if (window.innerWidth > 960) {
        rootEl.style.removeProperty('--fg-bg-top');
        rootEl.style.removeProperty('--fg-bg-height');
        return;
      }
      const designerHeading = rootEl.querySelector('.fg-designer-heading');
      const designerSection = rootEl.querySelector('.fg-designer');
      const setup = rootEl.querySelector('.fg-setup-heading');
      if (!designerHeading || !designerSection || !setup) return;
      const designerTop = designerHeading.getBoundingClientRect().top + window.scrollY;
      const designerBottom = designerSection.getBoundingClientRect().bottom + window.scrollY;
      const setupTop = setup.getBoundingClientRect().top + window.scrollY;
      // тёмное плато мобильного градиента: 10% → 94% высоты элемента.
      // Тёмное обязано покрыть конструктор ЦЕЛИКОМ и закончиться до OBS-заголовка.
      const darkStart = designerTop - 60;
      const lightStart = setupTop - 60;
      const height = Math.max(900, Math.round((lightStart - darkStart) / (0.94 - 0.10)));
      const top = Math.round(darkStart - 0.10 * height);
      rootEl.style.setProperty('--fg-bg-top', `${top}px`);
      rootEl.style.setProperty('--fg-bg-height', `${height}px`);
    };
    apply();
    const t = window.setTimeout(apply, 400);
    window.addEventListener('resize', apply);
    window.addEventListener('load', apply);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', apply);
      window.removeEventListener('load', apply);
    };
  }, []);

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&family=Inter:wght@400;450;500&display=swap';
    link.dataset.figmaFonts = 'true';
    document.head.appendChild(link);
    return () => link.remove();
  }, []);
  useEffect(() => {
    if (!menu && !notice) return;
    const f = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenu(false);
        setNotice(null);
      }
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [menu, notice]);
  function go(id: string) {
    setMenu(false);
    document.getElementById(id)?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion:reduce)').matches
        ? 'auto'
        : 'smooth',
    });
  }
  const login = () => {
    const url = twitchAuthorizeUrl();
    if (!url) {
      setNotice('Twitch OAuth не настроен: добавь VITE_TWITCH_CLIENT_ID в .env');
      return;
    }
    window.location.href = url;
  };
  return (
    <div
      ref={root}
      className="fg-root"
      style={{
        '--fg-bg-top': '1762.984375px',
        '--fg-bg-height': '2355.2936px',
        '--fg-gradient-height': '363.2936px',
      } as React.CSSProperties}
    >
      <a className="fg-skip" href="#figma-content">
        К содержимому
      </a>
      <motion.header
        className="fg-header"
        initial={reduce ? false : { opacity: 0, y: -14 }}
        animate={reduce ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <a href="#/" className="fg-brand" aria-label="RSMine — главная">
          <img src={logo} alt="" />
          <span className="fg-brand-name">RSMine</span>
        </a>
        <nav aria-label="Разделы лендинга">
          <button onClick={() => go('figma-voices')}>Возможности</button>
          <button onClick={() => go('figma-setup')}>Подключение</button>
          <button onClick={() => go('figma-faq')}>Вопросы</button>
        </nav>
        <button className="fg-twitch fg-header-login" onClick={login}>
          Войти через Twitch
          <TwitchMark />
        </button>
        <button
          className="fg-mobile-menu"
          aria-label={menu ? 'Закрыть меню' : 'Открыть меню'}
          aria-expanded={menu}
          onClick={() => setMenu((v) => !v)}
        >
          {menu ? <X size={22} /> : <Menu size={22} />}
        </button>
        {menu && (
          <div className="fg-mobile-nav">
            <button onClick={() => go('figma-voices')}>Возможности</button>
            <button onClick={() => go('figma-setup')}>Подключение</button>
            <button onClick={() => go('figma-faq')}>Вопросы</button>
          </div>
        )}
      </motion.header>
      <main id="figma-content">
        <section className="fg-hero">
          <div className="fg-hero-copy">
            <motion.h1
              initial={reduce ? false : { opacity: 0, y: 30 }}
              animate={reduce ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              донаты с lolzteam
              <br />
              <mark>бесплатное</mark>
              <br />
              подключение
            </motion.h1>
            <motion.p
              initial={reduce ? false : { opacity: 0, y: 22 }}
              animate={reduce ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.24, ease: [0.16, 1, 0.3, 1] }}
            >
              Принимайте донаты через LZT, показывайте сообщения в OBS
              <br />и настраивайте алерты под свой стрим.
            </motion.p>
            <motion.div
              className="fg-hero-actions"
              initial={reduce ? false : { opacity: 0, y: 18 }}
              animate={reduce ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.36, ease: [0.16, 1, 0.3, 1] }}
            >
              <button className="fg-twitch" onClick={login}>
                Войти через Twitch
                <TwitchMark />
              </button>
              <a className="fg-demo-link" href="#/d/landing-demo?demo=1">
                Посмотреть демо-донат
              </a>
            </motion.div>
          </div>
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 46, scale: 0.985 }}
            animate={reduce ? undefined : { opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1.2, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <HeroApp />
          </motion.div>
        </section>
        <div className="fg-feature-background" aria-hidden="true" />
        <Voices />
        <Designer />
        <ObsGuide />
        <section id="figma-faq" className="fg-faq">
          <Reveal>
            <h2>частые вопросы</h2>
          </Reveal>
          <Reveal delay={0.1}>
          <div className="fg-faq-list">
            {faqItems.map((item, i) => (
              <div className="fg-faq-item" key={item.question}>
                <button
                  aria-expanded={faq === i}
                  aria-controls={'fg-answer-' + i}
                  onClick={() => setFaq((v) => (v === i ? null : i))}
                >
                  <span>{item.question}</span>
                  <ChevronUp
                    size={16}
                    className={faq === i ? 'is-expanded' : ''}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {faq === i && (
                    <motion.div
                      key={'fg-answer-' + i}
                      id={'fg-answer-' + i}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={
                        reduce
                          ? { duration: 0 }
                          : { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
                      }
                      style={{ overflow: 'hidden' }}
                    >
                      <p>{item.answer}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
          </Reveal>
        </section>
      </main>
      <Reveal y={22}>
      <footer className="fg-footer">
        <a className="fg-footer-logo" href="#/" aria-label="RSMine — главная">
          <img src={logo} alt="" />
        </a>
        <p className="fg-footer-about">
          RSMine — донаты с Lolzteam и алерты для OBS.
        </p>
        <div className="fg-footer-rows">
          <div>
            <button onClick={() => go('figma-voices')}>Возможности</button>
            <button onClick={() => go('figma-designer')}>
              Конструктор алертов
            </button>
            <button onClick={() => go('figma-setup')}>Подключение OBS</button>
          </div>
          <div>
            <a href="#/d/landing-demo?demo=1">Демо страницы донатов</a>
            <button onClick={() => go('figma-faq')}>Вопросы и ответы</button>
          </div>
          <div>
            {(['github', 'telegram'] as const).map((key) =>
              projectLinks[key] ? (
                <a
                  key={key}
                  href={projectLinks[key]}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {key === 'github' ? 'GitHub' : 'Telegram'}
                </a>
              ) : (
                <span
                  key={key}
                  className="fg-footer-pending"
                  aria-disabled="true"
                  data-href=""
                  title="Адрес пока не указан"
                >
                  {key === 'github' ? 'GitHub' : 'Telegram'}
                </span>
              ),
            )}
          </div>
        </div>
      </footer>
      </Reveal>
      {notice && (
        <div className="fg-modal-backdrop" onClick={() => setNotice(null)}>
          <div
            className="fg-notice"
            role="dialog"
            aria-modal="true"
            aria-labelledby="fg-notice-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                e.preventDefault();
                e.currentTarget
                  .querySelector<HTMLButtonElement>('button')
                  ?.focus();
              }
            }}
          >
            <h2 id="fg-notice-title">Демонстрация лендинга</h2>
            <p>{notice}</p>
            <button autoFocus onClick={() => setNotice(null)}>
              Понятно
            </button>
          </div>
        </div>
      )}
      <div className="bottom-blur" aria-hidden="true" />
    </div>
  );
}
