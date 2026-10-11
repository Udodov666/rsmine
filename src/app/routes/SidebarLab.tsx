import type { ReactNode } from 'react';
import {
  CircleHelp, LayoutDashboard, Link2, LogOut, MessageSquareText, MonitorPlay,
  SlidersHorizontal, Target,
} from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowRightFromBracket, faBorderAll, faBullseye, faCircleQuestion, faCommentDots, faDesktop, faFlag,
  faGear, faGripVertical, faHouse, faLayerGroup, faLink, faLifeRing, faMessage, faQrcode, faRightFromBracket,
  faSliders, faTableCellsLarge, faTowerBroadcast, faVideo,
} from '@fortawesome/free-solid-svg-icons';
import { navigate } from '../../router';
import logo from '../assets/rsmine.svg';
import { DEMO_STREAMER } from '../../data/defaults';
import { getMockProvider } from '../../data/mock/MockProvider';
import { useToast } from '../../components/Toast';

type IconSet = Record<'dashboard' | 'messages' | 'settings' | 'goal' | 'page' | 'connect' | 'help' | 'logout', ReactNode>;

const LUCIDE: IconSet = {
  dashboard: <LayoutDashboard size={15} strokeWidth={1.8} />,
  messages: <MessageSquareText size={15} strokeWidth={1.8} />,
  settings: <SlidersHorizontal size={15} strokeWidth={1.8} />,
  goal: <Target size={15} strokeWidth={1.8} />,
  page: <Link2 size={15} strokeWidth={1.8} />,
  connect: <MonitorPlay size={15} strokeWidth={1.8} />,
  help: <CircleHelp size={15} strokeWidth={1.8} />,
  logout: <LogOut size={15} strokeWidth={1.8} />,
};

const fa = (icon: Parameters<typeof FontAwesomeIcon>[0]['icon']) =>
  <FontAwesomeIcon icon={icon} style={{ fontSize: 15 }} />;

const FA1: IconSet = {
  dashboard: fa(faTableCellsLarge),
  messages: fa(faMessage),
  settings: fa(faSliders),
  goal: fa(faBullseye),
  page: fa(faLink),
  connect: fa(faVideo),
  help: fa(faCircleQuestion),
  logout: fa(faRightFromBracket),
};

const FA2: IconSet = {
  dashboard: fa(faBorderAll),
  messages: fa(faCommentDots),
  settings: fa(faGear),
  goal: fa(faFlag),
  page: fa(faQrcode),
  connect: fa(faTowerBroadcast),
  help: fa(faLifeRing),
  logout: fa(faArrowRightFromBracket),
};

const NAV: Array<{ id: keyof Omit<IconSet, 'help' | 'logout'>; label: string; section?: string }> = [
  { id: 'dashboard', label: 'Панель управления', section: 'Управление' },
  { id: 'messages', label: 'Последние сообщения' },
  { id: 'settings', label: 'Настройки', section: 'Настройка' },
  { id: 'goal', label: 'Цель сбора' },
  { id: 'page', label: 'Страница донатов' },
  { id: 'connect', label: 'Подключение OBS' },
];

const PATHS: Record<string, string> = {
  dashboard: '/app/dashboard',
  messages: '/app/messages',
  settings: '/app/settings',
  goal: '/app/goal',
  page: '/app/page',
  connect: '/app/connect',
};

/** Лаборатория сайдбара: текущий + 2 FA-набора 1в1. Временный инструмент. */
export default function SidebarLab() {
  const toast = useToast();
  const cfg = getMockProvider().getConfig();
  const nick = cfg.profileName.trim() || DEMO_STREAMER.username;
  const avatar = cfg.profileAvatar;

  const renderSide = (icons: IconSet) => (
    <aside className="sidebar">
      <div className="logo">
        <img className="logo-mark" src={logo} alt="RSMine" />
        <span className="logo-name">RSMine</span>
      </div>
      <nav aria-label="Разделы">
        {NAV.map((n) => (
          <span key={n.id} style={{ display: 'contents' }}>
            {n.section && <div className="nav-section">{n.section}</div>}
            <button
              className={`nav-item${n.id === 'dashboard' ? ' on' : ''}`}
              onClick={() => navigate(PATHS[n.id])}
            >
              {icons[n.id]} {n.label}
            </button>
          </span>
        ))}
      </nav>
      <div className="sidebar-foot">
        <button className="nav-item" onClick={() => toast('Раздел помощи появится вместе с документацией.')}>
          {icons.help} Помощь
        </button>
        <div className="usercard">
          <button className="usercard-main" onClick={() => navigate('/app/settings')} title="Профиль и настройки">
            {avatar
              ? <img className="avatar" src={avatar} alt="" />
              : <span className="avatar" aria-hidden="true">{(nick[0] ?? '?').toUpperCase()}</span>}
            <span className="user-meta">
              <span className="nick">{nick}</span>
              <span className="sub">Профиль</span>
            </span>
          </button>
          <button className="icon-btn" title="Выйти" onClick={() => toast('Выход появится вместе с авторизацией.')}>
            {icons.logout}
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="sblab">
      <h1 className="page-h1">Лаборатория сайдбара</h1>
      <div className="page-sub">Три сайдбара 1в1: текущий и два FA-набора. Кнопки живые. Выберешь — перенесу.</div>
      <div className="sblab-row">
        <div>
          <div className="sblab-cap">Текущий — lucide</div>
          {renderSide(LUCIDE)}
        </div>
        <div>
          <div className="sblab-cap">FA набор 1 — строгий</div>
          {renderSide(FA1)}
        </div>
        <div>
          <div className="sblab-cap">FA набор 2 — характерный</div>
          {renderSide(FA2)}
        </div>
      </div>
      <div className="card">
        <div className="sec-head"><div className="card-title">Иконка панели — 6 строгих кандидатов</div></div>
        <div className="sblab-picks">
          {[
            { icon: faBorderAll, name: 'сетка' },
            { icon: faTableCellsLarge, name: 'таблица' },
            { icon: faLayerGroup, name: 'слои' },
            { icon: faGripVertical, name: 'вертикаль' },
            { icon: faDesktop, name: 'монитор' },
            { icon: faHouse, name: 'дом' },
          ].map(({ icon, name }) => (
            <button className="nav-item" key={name} onClick={() => navigate('/app/dashboard')}>
              {fa(icon)} Панель
              <span className="sblab-pick-name">{name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
