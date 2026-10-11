import './landing.css';
import './window.css';
import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, Menu, Play, RotateCcw, X } from 'lucide-react';
import Dashboard2 from '../app/routes/Dashboard2';
import { AppSidebar } from '../app/App';
import Settings from '../app/routes/Settings';
import Connect from '../app/routes/Connect';
import { navigate } from '../router';
import FlowBackdrop from './FlowBackdrop';
import demoMedia from '../public-page/assets/landing-demo.webp';
import DonatePage from '../public-page/DonatePage';
import { DemoProvider } from './demo/DemoProvider';
import { NativeAlert, NativeDesigner, NativeVoices, NativeEffects, NativeConnect } from './demo/NativeDemos';
import type { Donation } from '../data/types';
import { Button } from '../components/Button';
import logo from '../app/assets/rsmine.svg';
const faqs = [
  ['Можно попробовать без регистрации?', 'Да. В демо можно посмотреть панель, изменить пример алерта и попробовать форму доната. Деньги в демонстрации не переводятся.'],
  ['Нужен ли OBS?', 'Для алертов на стриме добавьте ссылку оверлея в источник «Браузер» в OBS. Посмотреть страницу доната и настроить оформление можно и без оверлея.'],
  ['Можно сделать разные алерты для разных сумм?', 'Да. Задайте суммы, с которых меняется оформление, и выберите медиа для каждого уровня. Результат можно проверить в превью.'],
  ['Можно изменить оформление после подключения?', 'Да. Медиа, цвет, ширину и появление можно менять в конструкторе. Перед стримом проверьте новый вариант тестовым донатом.'],
  ['Можно отправить сообщение без озвучки?', 'Да. Зритель выбирает голос или вариант без озвучки на странице доната.'],
  ['Как проходит оплата?', 'В этой демонстрации оплата не запускается. В реальной странице предусмотрен переход к счёту LolzTeam после заполнения формы.'],
];

function go(id: string) { document.getElementById(id)?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'}); }
function Cta({ light = false }: { light?: boolean }) { return <a className={`lp-cta ${light?'is-white':''}`} href="#/app/dashboard">Открыть демо <ArrowRight size={16}/></a>; }
export default function Landing() {
  const [provider]=useState(()=>new DemoProvider());
  const [event,setEvent]=useState<Donation|null>(null);
  const [sending,setSending]=useState(false);
  const [menu,setMenu]=useState(false);
  const [heroView,setHeroView]=useState<'dashboard'|'settings'|'connect'>('dashboard');
  const [shellMenu,setShellMenu]=useState(false);
  const [flowPaused,setFlowPaused]=useState(false);
  const [wide,setWide]=useState(()=>window.matchMedia('(min-width:1101px)').matches);
  const [faq,setFaq]=useState<number|null>(0);
  const [resetVersion,setResetVersion]=useState(0);
  const [,refresh]=useState(0);
  const root=useRef<HTMLDivElement>(null);
  const timer=useRef<number>();const lock=useRef(false);
  useEffect(()=>{document.documentElement.classList.add('is-landing');document.title='RSMine — донаты и алерты для стрима';return()=>{document.documentElement.classList.remove('is-landing');clearTimeout(timer.current)}},[]);
  useEffect(()=>provider.subscribe(()=>refresh(v=>v+1)),[provider]);
  useEffect(()=>{const q=window.matchMedia('(min-width:1101px)');const f=()=>setWide(q.matches);q.addEventListener('change',f);return()=>q.removeEventListener('change',f)},[]);
  useEffect(()=>{if(!menu)return;const f=(e:KeyboardEvent)=>{if(e.key==='Escape')setMenu(false)};window.addEventListener('keydown',f);return()=>window.removeEventListener('keydown',f)},[menu]);
  useEffect(()=>{if(!shellMenu)return;const f=(e:KeyboardEvent)=>{if(e.key==='Escape')setShellMenu(false)};window.addEventListener('keydown',f);return()=>window.removeEventListener('keydown',f)},[shellMenu]);
  function receive(){setHeroView('dashboard');setShellMenu(false);if(lock.current)return;lock.current=true;setSending(true);timer.current=window.setTimeout(()=>{setEvent(provider.receive());setSending(false);lock.current=false},350)}
  function resetDemo(){provider.reset();setEvent(null);setResetVersion(v=>v+1)}
  function shellNavigate(id:string){setShellMenu(false);if(id==='dashboard'||id==='settings'||id==='connect')setHeroView(id);else navigate(`/app/${id}`)}
  const profile=provider.getConfig();
  function nav(id:string){setMenu(false);go(id)}
  const previewNode=event&&<div className="lp-arrival dark-product" role="status"><div><span>Превью алерта</span><button aria-label="Закрыть пример алерта" onClick={()=>setEvent(null)}><X size={16}/></button></div><NativeAlert provider={provider} event={event}/></div>;
  return <div ref={root} className="landing-root lp-root">
    <a className="lp-skip" href="#landing-content" onClick={e=>{e.preventDefault();go('landing-content')}}>К содержимому</a>
    <header className="lp-header"><a className="lp-brand" href="#/" aria-label="RSMine — главная"><span className="lp-logo"><img src={logo} alt=""/></span>RSMine</a><nav className="lp-nav" aria-label="Лендинг"><button onClick={()=>go('design')}>Возможности</button><button onClick={()=>go('setup')}>Подключение</button><button onClick={()=>go('questions')}>Вопросы</button></nav><div className="lp-header-right"><Cta/><button className="lp-menu-button" aria-label={menu?'Закрыть меню':'Открыть меню'} aria-expanded={menu} aria-controls="lp-mobile-nav" onClick={()=>setMenu(v=>!v)}>{menu?<X size={21}/>:<Menu size={21}/>}</button></div>{menu&&<nav id="lp-mobile-nav" className="lp-mobile-nav" aria-label="Разделы лендинга"><button onClick={()=>nav('design')}>Возможности</button><button onClick={()=>nav('setup')}>Подключение</button><button onClick={()=>nav('questions')}>Вопросы</button></nav>}</header>
    <main id="landing-content">
      <section className="lp-hero"><div className="lp-hero-glow" aria-hidden="true"/><div className="lp-hero-copy"><span className="lp-eyebrow"><span/>Для тех, кто в эфире</span><h1>Донаты — часть<br/>вашего эфира<span className="lp-period">.</span></h1><p>Страница для зрителей, алерты для OBS<br className="lp-desktop-break"/> и панель, где не теряются сообщения.</p><div className="lp-hero-actions"><Cta/><button className="lp-text-button" onClick={()=>go('product')}>Посмотреть в работе <ArrowDown size={16}/></button></div></div>
        <div id="product" className="lp-product-wrap">
          <FlowBackdrop/>
          <div className="lp-product lp-window dark-product">
            <div className="lp-window-chrome"><div className="lp-window-dots" aria-hidden="true"><i/><i/><i/></div><span>RSMine</span><span className="lp-window-environment">Демонстрация</span></div>
            <div className={`lp-shell ${shellMenu?'menu-open':''}`}>
              {shellMenu&&<button className="lp-shell-scrim" aria-label="Закрыть меню демо" onClick={()=>setShellMenu(false)}/>}
              <AppSidebar profile={{name:profile.profileName,avatar:profile.profileAvatar}} navView={heroView} onNavigate={shellNavigate}/>
              <div className="lp-shell-main">
                <div className="lp-shell-toolbar"><button className="lp-shell-menu-toggle" aria-label="Разделы демо приложения" aria-expanded={shellMenu} onClick={()=>setShellMenu(v=>!v)}><Menu size={17}/></button><span className="lp-shell-breadcrumb">{heroView==='dashboard'?'Панель управления':heroView==='settings'?'Настройки':'Подключение OBS'}</span><Button variant="primary" className="lp-receive" loading={sending} loadingText="Показываем…" onClick={receive}><Play size={13} fill="currentColor"/>Показать донат</Button></div>
                <div className={`lp-shell-pane ${heroView!=='dashboard'?'is-scrolling':''}`}>
                  {heroView==='dashboard'&&<div className="lp-dashboard"><Dashboard2 key={resetVersion} demoProvider={provider} onPreview={setEvent} previewSlot={wide?previewNode:null}/></div>}
                  {heroView==='settings'&&<Settings demoProvider={provider} initialTab="design" onPreview={setEvent} mediaLibrary={[demoMedia]}/>}
                  {heroView==='connect'&&<Connect demoProvider={provider} initialStep={2} onPreview={setEvent}/>}
                </div>
                {wide&&heroView!=='dashboard'&&previewNode&&<div className="lp-shell-popover">{previewNode}</div>}
                <div className="lp-product-bottom"><span>{event?'Сообщение в панели. Алерт готов к эфиру.':'Нажмите «Показать донат» — и посмотрите, что произойдёт.'}</span><button aria-label="Сбросить демонстрацию панели" onClick={resetDemo}><RotateCcw size={14}/>Сбросить</button></div>
              </div>
            </div>
          </div>
          {!wide&&previewNode}<p className="lp-demo-note">Демо · деньги не переводятся</p>
        </div>
      </section>

      <section id="features" className="lp-section lp-donation-teaser">
        <div className="lp-copy-column"><span className="lp-kicker">Для зрителя</span><h2>Выбрать сумму.<br/>Поддержать эфир.</h2><p>На вашей странице — сумма, сообщение и выбор озвучки. Без лишних шагов.</p><a className="lp-secondary-button" href="#/d/demo">Открыть страницу доната <ArrowRight size={16}/></a></div>
        <div className="lp-donation-fragment dark-product" onSubmitCapture={e=>{e.preventDefault();e.stopPropagation()}}><DonatePage slug="landing-demo" design="blur" demoProvider={provider}/></div>
      </section>
      <section id="design" className="lp-section lp-real-design-section">
        <div className="lp-section-intro"><span className="lp-kicker">Настройки дизайна</span><h2>Ваш алерт.<br/>Ваши настройки.</h2><p>Перетащите алерт, измените заголовок или выберите появление.<br className="lp-desktop-break"/> Здесь тот же конструктор, что и в панели.</p></div>
        <NativeDesigner provider={provider}/>
        <div className="lp-demo-caption"><span>Настройки справа можно прокрутить. Изменения остаются в демо.</span><a href="#/app/settings">Открыть настройки <ArrowRight size={15}/></a></div>
      </section>
      <section className="lp-section lp-real-features-section">
        <div className="lp-section-intro"><span className="lp-kicker">Озвучка и эффекты</span><h2>Не только текст.</h2><p>Настройте, как будет звучать сообщение<br className="lp-desktop-break"/> и что произойдёт на экране.</p></div>
        <div className="lp-real-feature-grid">
          <article className="lp-real-feature"><h3>Голоса для сообщений.</h3><p>Послушайте пример, задайте цену и включите нужные голоса.</p><NativeVoices provider={provider}/></article>
          <article className="lp-real-feature"><h3>Эффекты на стриме.</h3><p>Тот же каталог и то же превью, что в настройках приложения.</p><NativeEffects provider={provider}/></article>
        </div>
      </section>
      <section id="setup" className="lp-section lp-real-setup-section">
        <div className="lp-copy-column"><span className="lp-kicker">Подключение</span><h2>Добавьте алерт<br/>в OBS.</h2><p>Создайте источник «Браузер», вставьте ссылку и проверьте тестовый донат.</p><a className="lp-secondary-button" href="#/app/connect">Открыть подключение <ArrowRight size={16}/></a></div>
        <NativeConnect provider={provider}/>
      </section>
      <section id="questions" className="lp-section lp-faq-section lp-reveal"><div className="lp-section-intro"><span className="lp-kicker">Перед первым стримом</span><h2>Несколько вопросов.</h2></div><div className="lp-faq">{faqs.map(([q,a],i)=><div className={`lp-faq-item ${faq===i?'is-open':''}`} key={q}><button aria-expanded={faq===i} aria-controls={`lp-answer-${i}`} id={`lp-question-${i}`} onClick={()=>setFaq(v=>v===i?null:i)}><span>{q}</span><span className="lp-faq-plus" aria-hidden="true">{faq===i?'−':'+'}</span></button><div id={`lp-answer-${i}`} role="region" aria-labelledby={`lp-question-${i}`} hidden={faq!==i}><p>{a}</p></div></div>)}</div></section>
    </main>
    <div className="lp-footer-stage"><FlowBackdrop variant="footer" paused={flowPaused}/>
      <section className="lp-final"><span className="lp-eyebrow">Ваш следующий эфир</span><h2>Посмотрите<br/>на своём стриме.</h2><p>Начните с демо: настройте алерт,<br/>попробуйте форму и откройте панель.</p><Cta light/><span className="lp-final-note">Без регистрации · демонстрационный режим</span></section>
    <footer className="lp-footer"><div><a className="lp-brand" href="#/"><span className="lp-logo"><img src={logo} alt=""/></span>RSMine</a><p>Страница донатов и алерты для стрима.</p></div><div className="lp-footer-links"><a href="#/app/dashboard">Демо панели</a><a href="#/d/demo">Страница доната</a><button onClick={()=>go('questions')}>Вопросы</button></div><div className="lp-footer-bottom"><span>© {new Date().getFullYear()} RSMine</span><button className="lp-motion-toggle" aria-pressed={flowPaused} onClick={()=>setFlowPaused(v=>!v)}>{flowPaused?'Включить фон':'Остановить фон'}</button></div></footer>
    </div>
  </div>;
}
