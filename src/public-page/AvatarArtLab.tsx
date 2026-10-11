import { useRef, useState } from 'react';
import AvatarArt, { demoAvatar, useAvatarArtSettings, type ArtResult } from './AvatarArt';
import { readAvatarFile, colorHex } from '../lib/avatarArt';
import { getMockProvider } from '../data/mock/MockProvider';
import rsmineLogo from '../app/assets/rsmine.svg';
export default function AvatarArtLab({slug='demo'}:{slug?:string}) {
  const cfg=getMockProvider().getPublicConfig(slug);
  const {settings,update,persisted}=useAvatarArtSettings(slug,slug==='demo'?demoAvatar:(cfg?.avatar||demoAvatar));
  const [result,setResult]=useState<ArtResult|null>(null);
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  const host=useRef<HTMLDivElement>(null),input=useRef<HTMLInputElement>(null);
  const currentKey=settings.source+':'+settings.variation;
  const [readyKey,setReadyKey]=useState('');
  const resultHandler=useRef({key:currentKey});resultHandler.current.key=currentKey;
  // Keep the callback stable: palette updates must not trigger another render of the artwork.
  const onResult=useRef((value:ArtResult)=>{setResult(value);setReadyKey(resultHandler.current.key);}).current;
  async function upload(file?:File) {
    if(!file)return;setBusy(true);setError('');
    try {update({source:await readAvatarFile(file),variation:0});}
    catch(e){setError(e instanceof Error?e.message:'Не удалось открыть изображение.');}
    finally{setBusy(false);if(input.current)input.current.value='';}
  }
  function download() {
    const canvas=host.current?.querySelector('canvas');if(!canvas)return;
    canvas.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`avatar-art-${result?.seed||0}.png`;a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);},'image/png');
  }
  const ready=readyKey===currentKey&&result!==null;
  return <main className="art-lab">
    <header className="art-lab-top"><a className="studio-brand" href={`#/d/${slug}?design=stacked`}><img className="studio-icon" src={rsmineLogo} alt="RSMine" /><span>RSMine</span></a><a className="art-back" href={`#/d/${slug}?design=stacked`}>На страницу доната ↗</a></header>
    <div className="art-lab-heading"><span>Собственный генератор обложек</span><h1>Аватар → абстракция</h1><p>Чистые формы и живые цвета вашей аватарки.</p></div>
    <section className="art-lab-card">
      <div ref={host} className="art-lab-preview"><AvatarArt source={settings.source} variation={settings.variation} onResult={onResult}/></div>
      <div className="art-lab-source"><img src={settings.source} alt="Аватар, из которого извлечена палитра"/><div><h2>Ваш аватар</h2><p>PNG, JPG или WebP, до 8 МБ</p></div><button className="btn outline" disabled={busy} onClick={()=>input.current?.click()}>{busy?'Открываем…':'Загрузить свой'}</button><input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e=>void upload(e.target.files?.[0])}/></div>
      {error&&<p className="art-lab-error" role="alert">{error}</p>}
      {!persisted&&<p className="art-lab-error" role="alert">Хранилище браузера недоступно. Этот аватар не сохранится после закрытия страницы.</p>}
      {result?.fallback&&<p className="art-lab-error" role="alert">Цвета аватара недоступны. Показана нейтральная композиция. Загрузите изображение с компьютера.</p>}
      <div className="art-lab-palette"><span>Палитра аватара</span><div>{result?.colors.map((color,i)=><span className="art-swatch" key={i} style={{background:colorHex(color)}} title={colorHex(color)} aria-label={`Цвет ${colorHex(color)}`}/>)}</div></div>
      <div className="art-lab-actions"><button className="btn primary" disabled={busy||!ready} onClick={()=>update({...settings,variation:(settings.variation+1)%1000000})}>Другая композиция</button><button className="btn outline" disabled={!ready} onClick={download}>Скачать PNG</button><button className="btn ghost" disabled={busy} onClick={()=>update({source:demoAvatar,variation:0})}>Исходный аватар</button></div>
    </section>
    <footer className="art-lab-footer"><span>Генерация в браузере. Без AI-сервисов и отправки изображения на сервер.</span><span>Обложка автоматически используется в варианте «Сверху».</span></footer>
  </main>;
}
