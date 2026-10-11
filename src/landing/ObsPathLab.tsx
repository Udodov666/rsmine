import { useEffect, useState } from 'react';
import { AppWindow, ArrowLeft, ChevronDown, ChevronUp, ExternalLink, Eye, Film, Gamepad2, Globe, Image, LockKeyhole, Minus, Monitor, Plus, Settings, X } from 'lucide-react';
import Connect from '../app/routes/Connect';
import { CopyButton, NumInput } from '../components/Bits';
import { Button } from '../components/Button';
import { useToast } from '../components/Toast';
import { DemoProvider } from './demo/DemoProvider';
import { NativeAlert } from './demo/NativeDemos';
import type { Donation } from '../data/types';
import logo from '../app/assets/rsmine.svg';
import './obs-path-lab.css';

type Style = 'fragments' | 'inspect' | 'layers';
const overlayUrl = () => `${window.location.origin}/#/obs-lab-preview`;
const steps = [
 { title:'Скопируйте ссылку', text:'Откройте подключение OBS в RSMine. Ссылка на ваш оверлей уже там.' },
 { title:'Добавьте «Браузер»', text:'В OBS создайте источник «Браузер» и вставьте ссылку в поле URL.' },
 { title:'Отправьте тест', text:'Проверьте появление сообщения перед эфиром. Деньги для теста не нужны.' },
];
function useDemo() {
 const [provider] = useState(()=>new DemoProvider());
 const sample=()=>({...provider.simulateTest(),username:'masha',text:'Спасибо за классный стрим!'});
 const [event,setEvent] = useState<Donation>(()=>sample());
 return {provider,event,replay:()=>setEvent(sample())};
}
function LinkDemo({mode}:{mode:Style}) {
 const toast=useToast();
 // The field markup and classes are the same as Link.tsx, including CopyButton.
 // No monospace class, small-font override, replacement input or fake copy button.
 return <div className={`opl-link-demo opl-native ${mode==='inspect'?'macro':''}`}>
  <section className="gcard">
   <div className="pg-title">Ссылка на оверлей</div>
   <div className="pg-desc">Скопируйте её для источника «Браузер».</div>
   <div className="glink-row"><span className="ginput-copy">
    <input className="st-input" readOnly value={overlayUrl()} onFocus={e=>e.target.select()}/>
    <span className="ginput-copy-btn"><CopyButton text={overlayUrl()} title="Копировать ссылку" onCopied={()=>toast('Ссылка скопирована')}/></span>
   </span></div>
  </section>
 </div>;
}
// OBS workflow illustration in the project's style, not an embedded OBS client.
// OBS steps are intentionally presented using the project visual language, per user request.
type ObsView = 'sources' | 'create' | 'properties' | 'added';
function BrowserDemo({mode}:{mode:Style}) {
 const initial:ObsView=mode==='inspect'?'properties':mode==='layers'?'create':'sources';
 const [view,setView]=useState<ObsView>(initial);
 const [menu,setMenu]=useState(true);
 const [name,setName]=useState('Алерты RSMine');
 const [url,setUrl]=useState(mode==='inspect'?overlayUrl():'https://obsproject.com/browser-source');
 const [width,setWidth]=useState('1920');const [height,setHeight]=useState('1080');
 const [visible,setVisible]=useState(true);
 const reset=()=>{setView('sources');setMenu(false)};
 const typeItems=[{icon:Globe,label:'Браузер'},{icon:Gamepad2,label:'Захват игры'},{icon:AppWindow,label:'Захват окна'},{icon:Monitor,label:'Захват экрана'},{icon:Image,label:'Изображение'},{icon:Film,label:'Источник медиа'}];
 return <div className="opl-obs-example">
  <div className={`opl-browser-demo opl-obs-product opl-native settings-wrap is-${view}`}>
   {(view==='sources'||view==='added')?<>
    <div className="opl-obs-dock-title"><span className="pg-title">Источники</span><span aria-hidden="true"><X size={11}/></span></div>
    <div className="opl-obs-source-list">
     {view==='added'&&<div className="opl-obs-source-row selected"><Globe size={14}/><span>{name}</span><Eye size={13}/><LockKeyhole size={12}/></div>}
     <div className="opl-obs-source-row"><Monitor size={14}/><span>Захват экрана</span><Eye size={13}/><LockKeyhole size={12}/></div>
    </div>
    <div className="opl-obs-toolbar"><button aria-label="Добавить источник в демо OBS" aria-expanded={menu} onClick={()=>{setMenu(v=>!v);if(view==='added')setView('sources')}}><Plus size={16}/></button><button disabled aria-label="Удалить источник"><Minus size={16}/></button><button disabled aria-label="Свойства источника"><Settings size={15}/></button><i/><button disabled aria-label="Выше"><ChevronUp size={15}/></button><button disabled aria-label="Ниже"><ChevronDown size={15}/></button></div>
    {view==='sources'&&menu&&<div className="opl-obs-source-menu" aria-label="Типы источников OBS">{typeItems.map(({icon:Icon,label},i)=><button key={label} disabled={i!==0} className={i===0?'is-browser':''} onClick={()=>{setView('create');setMenu(false)}}><Icon size={14}/><span>{label}</span></button>)}</div>}
   </>:<>
    <div className="opl-obs-dialog-title"><span className="pg-title">{view==='create'?'Создание источника':`Свойства «${name}»`}</span><button className="icon-btn" aria-label="Закрыть пример окна OBS" onClick={reset}><X size={11}/></button></div>
    {view==='create'?<div className="opl-obs-create">
     <label className="opl-obs-radio"><input type="radio" checked readOnly/>Создать новый</label>
     <input className="st-input opl-obs-source-name" aria-label="Название источника в примере OBS" value={name} onChange={e=>setName(e.target.value)}/>
     <label className="opl-obs-radio muted"><input type="radio" disabled/>Добавить существующий</label>
     <div className="opl-obs-existing-list" aria-hidden="true"/>
     <label className="opl-obs-check"><input type="checkbox" checked={visible} onChange={e=>setVisible(e.target.checked)}/>Сделать источник видимым</label>
    </div>:<div className="opl-obs-properties">
     <label className="opl-obs-localfile"><input type="checkbox" disabled/>Локальный файл</label>
     <label className="opl-obs-property"><span>URL</span><input className="st-input" aria-label="URL источника OBS в демо" value={url} onChange={e=>setUrl(e.target.value)} onFocus={e=>e.target.select()}/></label>
     <label className="opl-obs-property"><span>Ширина</span><NumInput title="Ширина источника OBS в демо" value={Number(width)} min={1} max={8192} onCommit={v=>setWidth(String(v))}/></label>
     <label className="opl-obs-property"><span>Высота</span><NumInput title="Высота источника OBS в демо" value={Number(height)} min={1} max={8192} onCommit={v=>setHeight(String(v))}/></label>
     <div className="opl-obs-properties-crop" aria-hidden="true"/>
    </div>}
    <div className="opl-obs-dialog-actions"><Button variant="primary" onClick={()=>setView(view==='create'?'properties':'added')} disabled={view==='create'&&!name.trim()}>ОК</Button><Button variant="outline" onClick={reset}>Отмена</Button></div>
   </>}
  </div>
  <span className="opl-obs-example-label">Шаг OBS · демо</span>
 </div>;
}
function AlertDemo({mode}:{mode:Style}) {
 const {provider,event}=useDemo();const [current,setCurrent]=useState<Donation>(event);
 return <div className={`opl-alert-demo ${mode==='inspect'?'is-inspect':''}`}>
  <div className="opl-stream-grid" aria-hidden="true"/>
  <div className="opl-alert-fragment opl-native"><NativeAlert provider={provider} event={current}/></div>
  <div className="opl-native-test-action opl-native"><Connect demoProvider={provider} initialStep={3} onPreview={d=>d&&setCurrent({...d,username:'masha',text:'Спасибо за классный стрим!'})}/></div>
 </div>;
}
function Visual({index,mode}:{index:number;mode:Style}) {
 return <div className={`opl-visual opl-visual-${index+1}`}>
  {index===0?<LinkDemo mode={mode}/>:index===1?<BrowserDemo mode={mode}/>:<AlertDemo mode={mode}/>}
 </div>;
}
function Variation({mode,number,label,description}:{mode:Style;number:string;label:string;description:string}) {
 return <section id={`opl-${mode}`} className={`opl-variation opl-${mode}`}>
  <div className="opl-variation-caption"><span>{number}</span><b>{label}</b><p>{description}</p></div>
  <div className="opl-section-heading"><span className="opl-eyebrow">Подключение OBS</span><h2>Добавьте алерт в OBS.</h2><p>Скопируйте ссылку, добавьте источник и проверьте всё перед эфиром.</p></div>
  <div className="opl-cards">{steps.map((step,index)=><article className="opl-card" key={index}>
   <div className="opl-card-top"><span className="opl-step-index">0{index+1}</span><h3>{step.title}</h3></div>
   <Visual index={index} mode={mode}/>
   <div className="opl-card-bottom"><span className="opl-bottom-index">{index+1}</span><div><h3>{step.title}</h3><p>{step.text}</p></div></div>
  </article>)}</div>
 </section>;
}
export default function ObsPathLab() {
 useEffect(()=>{const previous=document.title;document.documentElement.classList.add('is-obs-path-lab');document.title='RSMine / Три вариации пути подключения OBS';return()=>{document.documentElement.classList.remove('is-obs-path-lab');document.title=previous}},[]);
 const jump=(id:string)=>document.getElementById(id)?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
 return <div className="obs-path-lab"><header className="opl-header"><a className="opl-brand" href="#/"><img src={logo} alt=""/>RSMine<span>Лаборатория</span></a><a className="opl-back" href="#/obs-lab"><ArrowLeft size={14}/>Предыдущие варианты</a></header><main className="opl-main"><div className="opl-intro"><span className="opl-eyebrow">По вашим референсам</span><h1>Один путь. Три подачи.</h1><p>Все фрагменты в стиле проекта: поля, кнопки, цвета и типографика.</p><nav aria-label="Вариации блока">{[['fragments','01 Фрагменты'],['inspect','02 Макро'],['layers','03 Создание']].map(([id,label])=><button key={id} onClick={()=>jump('opl-'+id)}>{label}<ChevronDown size={13}/></button>)}</nav></div><Variation mode="fragments" number="01" label="Фрагменты интерфейса" description="Компактная подача по примеру Narrative."/><Variation mode="inspect" number="02" label="Крупный план" description="Подача как у инспектора: фокус на нужном действии."/><Variation mode="layers" number="03" label="Последовательность" description="Ссылка, создание источника и проверка."/><footer className="opl-footer"><p>RSMine и алерт — настоящие компоненты приложения. Шаги OBS оформлены в стиле RSMine; это демонстрация подключения, а не оригинальный интерфейс OBS. Действия работают только в демо и не подключают OBS.</p><a href="#/">Основной лендинг<ExternalLink size={13}/></a></footer></main></div>;
}
