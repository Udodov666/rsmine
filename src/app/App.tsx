import { useEffect, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowRightFromBracket, faCommentDots, faFlag, faGear, faHouse,
  faLifeRing, faQrcode, faTowerBroadcast,
} from '@fortawesome/free-solid-svg-icons';
import { navigate } from '../router';
import { DEMO_STREAMER } from '../data/defaults';
import { getProvider } from '../data/providerSwitch';
import { getTwitch, isAuthed, logout } from '../data/live/auth';
import { getMockProvider } from '../data/mock/MockProvider';
import { useToast } from '../components/Toast';
import AlertPreviewHost from '../components/AlertPreview';
import { PageTransition } from '../components/PageTransition';
import Dashboard2 from './routes/Dashboard2';
import GoalPage from './routes/Goal';
import History from './routes/History';
import Settings from './routes/Settings';
import LinkPage from './routes/Link';
import Connect from './routes/Connect';
import logo from './assets/rsmine.svg';
import BtnLab from './routes/BtnLab';
import StatLab from './routes/StatLab';
import GoalLab from './routes/GoalLab';
import SidebarLab from './routes/SidebarLab';

/** Временные инструменты живут в общем шелле, чтобы выглядеть как настоящие страницы. */
const LABS: Record<string, { title: string; El: ComponentType }> = {
  'btn-lab': { title: 'лаборатория кнопок', El: BtnLab },
  'stat-lab': { title: 'лаборатория статистики', El: StatLab },
  'goal-lab': { title: 'лаборатория цели', El: GoalLab },
  'sidebar-lab': { title: 'лаборатория сайдбара', El: SidebarLab },
};

const VIEWS = ['dashboard', 'goal', 'messages', 'settings', 'page', 'connect'] as const;
type View = (typeof VIEWS)[number];

/** Страницы, у которых заголовок живёт внутри контентной колонки, а не в топбаре. */
const IN_COLUMN_TITLE = new Set<View>(['dashboard', 'settings', 'goal', 'page', 'connect', 'messages']);

const faIco = (icon: typeof faHouse) => <FontAwesomeIcon icon={icon} style={{ fontSize: 15 }} />;

const NAV: Array<{ id: View; label: string; icon: ReactNode }> = [
  { id: 'dashboard', label: 'Панель управления', icon: faIco(faHouse) },
  { id: 'messages', label: 'Последние сообщения', icon: faIco(faCommentDots) },
  { id: 'settings', label: 'Настройки', icon: faIco(faGear) },
  { id: 'goal', label: 'Цель сбора', icon: faIco(faFlag) },
  { id: 'page', label: 'Страница донатов', icon: faIco(faQrcode) },
  { id: 'connect', label: 'Подключение', icon: faIco(faTowerBroadcast) },
];

const TITLES: Record<View, string> = {
  dashboard: 'Панель управления',
  goal: 'Цель сбора',
  messages: 'Последние сообщения',
  settings: 'Настройки',
  page: 'Страница донатов',
  connect: 'Подключение',
};

/** The same sidebar is reused by the landing; navigation and sample profile are injectable. */
export function AppSidebar({ profile, navView, onNavigate = id => navigate(`/app/${id}`) }: { profile: { name: string; avatar: string }; navView: View | ''; onNavigate?: (id: View) => void }) {
  const toast = useToast();
  return (
      <aside className="sidebar">
        <div className="logo">
          <img className="logo-mark" src={logo} alt="RSMine" />
          <span className="logo-name">RSMine</span>
        </div>
        <nav aria-label="Разделы">
          <div className="nav-section">Управление</div>
          {NAV.slice(0, 2).map((n) => (
            <button
              key={n.id}
              className={`nav-item ${navView === n.id ? 'on' : ''}`}
              onClick={() => onNavigate(n.id)}
            >
              {n.icon} {n.label}
            </button>
          ))}
          <div className="nav-section">Настройка</div>
          {NAV.slice(2).map((n) => (
            <button
              key={n.id}
              className={`nav-item ${navView === n.id ? 'on' : ''}`}
              onClick={() => onNavigate(n.id)}
            >
              {n.icon} {n.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <button
            className="nav-item"
            onClick={() => window.open('https://t.me/udodov228', '_blank', 'noopener')}
          >
                          {faIco(faLifeRing)} Помощь
          </button>          <div className="usercard">
            <button
              className="usercard-main"
              onClick={() => onNavigate('settings')}
              title="Профиль и настройки"
            >
              {profile.avatar
                ? <img className="avatar" src={profile.avatar} alt="" />
                : <span className="avatar" aria-hidden="true">{(profile.name[0] ?? '?').toUpperCase()}</span>}
              <span className="user-meta">
                <span className="nick">{profile.name}</span>
                <span className="sub">Профиль</span>
              </span>
            </button>
            {isAuthed() ? (
              <button
                className="icon-btn"
                title="Выйти"
                onClick={() => {
                  logout();
                  window.location.hash = '#/landing-figma';
                  window.location.reload();
                }}
              >
                {faIco(faArrowRightFromBracket)}
              </button>
            ) : (
              <button
                className="icon-btn"
                title="Выйти"
                onClick={() => toast('Вы не вошли — вход через Twitch на главной.')}
              >
                {faIco(faArrowRightFromBracket)}
              </button>
            )}
          </div>
        </div>
      </aside>
  );
}

/** Оболочка: левое меню + топбар (структура по скринам DonationAlerts, тема — тёмный эталон). */
export default function App({ path }: { path: string }) {
  const seg = path.split('/');
  let view = (seg[2] ?? 'dashboard') as View;
  if (!VIEWS.includes(view)) view = 'dashboard';
  const lab = LABS[seg[2] ?? ''];
  const navView = lab ? '' : view;

  useEffect(() => {
    getProvider();
  }, []);

  // сайдбар: свой ник/аватар → из Twitch-сессии → демо-заглушка.
  // Сессия как фолбэк — чтобы при пустом конфиге не мигал чужой «Udodov».
  const sidebarProfile = (c: { profileName: string; profileAvatar: string }) => {
    const tw = getTwitch();
    return {
      name: c.profileName.trim() || tw?.displayName || DEMO_STREAMER.username,
      avatar: c.profileAvatar || tw?.avatar || DEMO_STREAMER.avatar,
    };
  };

  const [profile, setProfile] = useState(() => sidebarProfile(getProvider().getConfig()));

  useEffect(() => {
    const p = getProvider();
    const sync = () => setProfile(sidebarProfile(p.getConfig()));
    sync();
    return p.subscribe(sync);
  }, []);

  return (
    <>
      <AppSidebar profile={profile} navView={navView} />

      <header className="topbar">
        {!lab && !IN_COLUMN_TITLE.has(view) && <div className="page-title">{TITLES[view]}</div>}
        <div className="spacer" />
      </header>

      <main className="content">
        {lab ? <lab.El /> : (
        <PageTransition pageKey={view}>
          {view === 'dashboard' && <Dashboard2 />}
          {view === 'goal' && <GoalPage />}
          {view === 'messages' && <History />}
          {view === 'settings' && <Settings />}
          {view === 'page' && <LinkPage />}
          {view === 'connect' && <Connect />}
        </PageTransition>
        )}
      </main>
      <AlertPreviewHost />
    </>
  );
}
