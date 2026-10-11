import { useEffect, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, Check, Copy, ExternalLink, Link, Monitor, Play, Plus, RotateCcw } from 'lucide-react';
import Connect from '../app/routes/Connect';
import { DemoProvider } from './demo/DemoProvider';
import { NativeAlert } from './demo/NativeDemos';
import type { Donation } from '../data/types';
import { copyText } from '../lib/format';
import logo from '../app/assets/rsmine.svg';
import './obs-lab.css';
const demoUrl = () => `${window.location.origin}/#/obs-lab-preview`;
function useExample() {
 const [provider] = useState(() => new DemoProvider());
 const [event, setEvent] = useState<Donation | null>(() => provider.simulateTest());
 return { provider, event, setEvent, play: () => setEvent(provider.simulateTest()) };
}
function Scene({ provider, event, compact = false }: { provider: DemoProvider; event: Donation | null; compact?: boolean }) {
 return <div className={`ol-scene ${compact ? 'is-compact' : ''}`}><div className="ol-scene-grid" aria-hidden="true"/><div className="ol-scene-meta"><span>Превью алерта</span><span>1920 × 1080</span></div><div className="ol-alert-slot"><NativeAlert provider={provider} event={event}/></div><span className="ol-scene-corner" aria-hidden="true"/><span className="ol-scene-corner is-right" aria-hidden="true"/></div>;
}
function Chrome({ label }: { label: string }) { return <div className="ol-chrome"><span className="ol-dots" aria-hidden="true"><i/><i/><i/></span><span>{label}</span><span className="ol-chrome-demo">Демо</span></div>; }
function TestButton({ onClick }: { onClick: () => void }) { return <button className="ol-button" onClick={onClick}><Play size={15} fill="currentColor"/>Показать алерт</button>; }
function VariantOne() {
 const { provider, event, play } = useExample();
 return <section id="obs-result" className="ol-variant ol-first"><div className="ol-variant-label"><span>01</span> Сначала результат</div><div className="ol-split"><div className="ol-copy"><span className="ol-eyebrow">Алерты на стриме</span><h2>Добавьте алерт<br/>в OBS.</h2><p>Сообщения зрителей появятся прямо в эфире. Скопируйте ссылку из RSMine и добавьте её в источник «Браузер».</p><TestButton onClick={play}/><span className="ol-small-note">Нажмите, чтобы повторить пример.</span><div className="ol-connection-note"><Link size={15}/><span>Одна ссылка для вашего оверлея</span></div></div><div className="ol-preview-one"><div className="ol-preview-window ol-native"><Chrome label="Сцена с алертом"/><Scene provider={provider} event={event}/><div className="ol-player-footer"><span className="ol-status-dot"/>Тестовый донат<span className="ol-player-time">Без перевода денег</span></div></div><div className="ol-source-tag"><span className="ol-source-icon"><Monitor size={16}/></span><div><b>Браузер</b><span>Источник для алертов</span></div><Link size={16}/></div></div></div></section>;
}
function VariantTwo() {
 const { provider, event, play } = useExample();const [copied, setCopied] = useState(false);
 async function copy() { setCopied(await copyText(demoUrl())); }
 return <section id="obs-steps" className="ol-variant ol-second"><div className="ol-variant-label"><span>02</span> Путь подключения</div><div className="ol-centered-copy"><span className="ol-eyebrow">Подключение OBS</span><h2>Три шага до<br/>первого алерта.</h2><p>Ссылка из RSMine, источник в OBS и тест перед эфиром.</p></div><div className="ol-step-grid"><article className="ol-step-card"><div className="ol-step-heading"><span>01</span><Link size={18}/></div><h3>Скопируйте ссылку</h3><p>У каждого оверлея своя ссылка. Здесь можно попробовать безопасный демо-адрес.</p><div className="ol-url-preview"><span className="ol-url-label">Демо-оверлей</span><span className="ol-url-value" title={demoUrl()}>/#/obs-lab-preview</span><button aria-label="Скопировать демо-ссылку" onClick={copy}>{copied?<Check size={16}/>:<Copy size={16}/>}</button></div><button className="ol-step-action" onClick={copy}>{copied?'Демо-ссылка скопирована':'Скопировать демо-ссылку'}{copied?<Check size={15}/>:<ArrowRight size={15}/>}</button></article><article className="ol-step-card"><div className="ol-step-heading"><span>02</span><Monitor size={18}/></div><h3>Добавьте источник</h3><p>В OBS откройте «Источники», нажмите «+» и выберите «Браузер». Вставьте вашу ссылку.</p><div className="ol-source-diagram"><span className="ol-source-diagram-label">Источники в OBS</span><div><span className="ol-plus"><Plus size={19}/></span><ArrowRight size={16}/><span className="ol-browser-chip"><Monitor size={16}/>Браузер</span></div><span className="ol-source-size">Размер источника 1920 × 1080</span></div><span className="ol-step-foot">Это схема шага, а не интерфейс OBS.</span></article><article className="ol-step-card ol-step-card-preview"><div className="ol-step-heading"><span>03</span><Play size={18}/></div><h3>Проверьте алерт</h3><p>Посмотрите, как появится сообщение. Тестовый донат не входит в статистику.</p><div className="ol-mini-native ol-native"><Scene provider={provider} event={event} compact/></div><button className="ol-step-action" onClick={play}>Повторить пример<RotateCcw size={15}/></button></article></div><div className="ol-section-note">Демо-ссылка открывает отдельное превью. Реальный OBS к этой странице не подключён.</div></section>;
}
function VariantThree() {
 const { provider, event, setEvent } = useExample();
 return <section id="obs-product" className="ol-variant ol-third"><div className="ol-variant-label"><span>03</span> Настоящий мастер</div><div className="ol-third-heading"><div><span className="ol-eyebrow">Из панели RSMine</span><h2>Проверьте алерт<br/>перед эфиром.</h2></div><p>Пройдите шаг подключения и отправьте тестовый донат. Рядом появится тот же алерт, который используется в приложении.</p></div><div className="ol-workspace ol-native"><Chrome label="RSMine / Подключение OBS"/><div className="ol-workspace-body"><div className="ol-native-connector"><Connect demoProvider={provider} initialStep={2} onPreview={setEvent} demoOverlayUrl={demoUrl()}/></div><div className="ol-workspace-preview"><div className="ol-preview-label"><span>Ваш алерт</span><span className="ol-native-badge">Предпросмотр</span></div><Scene provider={provider} event={event}/><p>В этом примере используется настоящий компонент алерта. Изменения остаются в демо.</p></div></div></div></section>;
}
export function ObsLabPreview() {
 const { provider, event } = useExample();useEffect(() => { document.documentElement.classList.add('is-ol-overlay');return()=>document.documentElement.classList.remove('is-ol-overlay'); }, []);
 return <div className="ol-transparent-overlay ol-native"><NativeAlert provider={provider} event={event}/></div>;
}
export default function ObsLab() {
 useEffect(() => { const prev=document.title;document.documentElement.classList.add('is-obs-lab');document.title='RSMine / Три варианта блока OBS';return()=>{document.documentElement.classList.remove('is-obs-lab');document.title=prev;};}, []);
 const jump=(id:string)=>document.getElementById(id)?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
 return <div className="obs-lab"><header className="ol-header"><a className="ol-brand" href="#/"><img src={logo} alt=""/>RSMine<span>Лаборатория</span></a><a className="ol-back" href="#/"><ArrowLeft size={15}/>К лендингу</a></header><main className="ol-main"><div className="ol-page-intro"><span className="ol-eyebrow">Сравнение подачи</span><h1>Три варианта блока OBS.</h1><p>Один продукт, три способа показать подключение. Основной лендинг не изменён.</p><nav aria-label="Варианты OBS">{[['obs-result','01 Результат'],['obs-steps','02 Шаги'],['obs-product','03 Мастер']].map(([id,label])=><button key={id} onClick={()=>jump(id)}>{label}<ArrowDown size={13}/></button>)}</nav></div><VariantOne/><VariantTwo/><VariantThree/><footer className="ol-lab-footer"><span>Отдельная тестовая страница. Подключение OBS здесь не выполняется.</span><a href="#/app/connect">Настоящий раздел подключения<ExternalLink size={14}/></a></footer></main></div>;
}
