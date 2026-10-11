import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { usePath } from './router';
import { ToastProvider } from './components/Toast';
import App from './app/App';
import Landing from './landing/Landing';
import LandingFigma from './landing-figma/LandingFigma';
import ObsLab, { ObsLabPreview } from './landing/ObsLab';
import ObsPathLab from './landing/ObsPathLab';
import DonatePage from './public-page/DonatePage';
import AvatarArtLab from './public-page/AvatarArtLab';
import OverlayRoot from './overlay/OverlayRoot';
import GoalWidget from './overlay/GoalWidget';
import { DemoProvider } from './landing/demo/DemoProvider';
import AuthCallback from './pages/AuthCallback';

function Root() {
  // Twitch implicit-редирект приходит на реальный путь /auth/callback (не hash)
  if (window.location.pathname === '/auth/callback') return <AuthCallback />;
  const path = usePath();
  if (path === '/' || path === '/landing-figma') return <LandingFigma />;
  if (path === '/landing-previous') return <Landing />;
  if (path === '/obs-lab') return <ObsLab />;
  if (path === '/obs-path-lab') return <ObsPathLab />;
  if (path === '/obs-lab-preview') return <ObsLabPreview />;
  if (path.startsWith('/banner-lab')) return <AvatarArtLab slug={path.split('/')[2] || 'demo'} />;
  if (path.startsWith('/overlay/')) {
    const secret = path.slice('/overlay/'.length);
    return <OverlayRoot secret={secret} />;
  }
  if (path.startsWith('/goal/')) {
    const slug = path.slice('/goal/'.length).split('?')[0];
    return <GoalWidget slug={slug} />;
  }
  if (path.startsWith('/d/')) {
    const [slug, query = ''] = path.slice('/d/'.length).split('?');
    const q = new URLSearchParams(query);
    const requestedDesign = q.get('design');
    const design = requestedDesign === 'classic' || requestedDesign === 'studio' || requestedDesign === 'stacked' || requestedDesign === 'blur' ? requestedDesign : 'blur';
    // ?demo=1 — статичная демо-версия без реального бэка (мемори-провайдер)
    const demoProvider = q.get('demo') === '1' ? new DemoProvider() : undefined;
    // ?paid=1 — возврат с оплаты LZT (urlSuccess): показываем экран успеха
    const justPaid = q.get('paid') === '1';
    return <DonatePage slug={slug} design={design} demoProvider={demoProvider} justPaid={justPaid} />;
  }
  return <App path={path} />;
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <Root />
    </ToastProvider>
  </React.StrictMode>,
);
