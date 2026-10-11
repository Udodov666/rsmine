import { useEffect, useState, useCallback, useRef } from 'react';
import { extractAvatarPalette, renderAvatarArt, NEUTRAL_PALETTE, type AvatarPalette } from '../lib/avatarArt';
import demoAvatar from './assets/banner-demo-avatar.png';
export { demoAvatar };
export type ArtSettings = { source: string; variation: number };
export type ArtResult = AvatarPalette & { seed: number; duration: number };
const eventName='ld:avatar-art-change';
export function useAvatarArtSettings(slug: string, fallbackSource: string) {
  const key=`ld_avatar_art_v1:${slug}`;
  const read=useCallback(():ArtSettings=>{
    try {const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved && typeof saved.source==='string' && (saved.source === fallbackSource || /^data:image\/(png|jpeg|webp);base64,/.test(saved.source)) && saved.source.length<2_000_000 && Number.isInteger(saved.variation) && saved.variation>=0)return saved;}catch { /* Storage may be unavailable. */ }
    return {source: fallbackSource,variation:0};
  },[key,fallbackSource]);
  const [settings,setSettings]=useState(read);
  const [persisted,setPersisted]=useState(true);
  useEffect(()=>{
    setSettings(read());
    const onChange=(event:Event)=>{if(event instanceof StorageEvent && event.key!==key)return;if(event instanceof CustomEvent && event.detail!==key)return;setSettings(read());};
    window.addEventListener('storage',onChange);window.addEventListener(eventName,onChange);
    return ()=>{window.removeEventListener('storage',onChange);window.removeEventListener(eventName,onChange);};
  },[key,read]);
  const update=(next:ArtSettings)=>{
    let saved=true;try{localStorage.setItem(key,JSON.stringify(next));}catch{saved=false;}
    setSettings(next);setPersisted(saved);
    if(saved)window.dispatchEvent(new CustomEvent(eventName,{detail:key}));
  };
  return {settings,update,persisted};
}
export default function AvatarArt({source,variation=0,onResult}:{source:string;variation?:number;onResult?:(result:ArtResult)=>void}) {
  const ref=useRef<HTMLCanvasElement>(null);
  const [status,setStatus]=useState('loading');
  useEffect(()=>{
    let cancelled=false,frame=0;setStatus('loading');
    const draw=(palette:AvatarPalette)=>{
      if(cancelled)return;
      frame=requestAnimationFrame(()=>{
        if(cancelled||!ref.current)return;
        const start=performance.now();
        try {const info=renderAvatarArt(ref.current,palette,variation);setStatus(palette.fallback?'fallback':'ready');onResult?.({...palette,seed:info.seed,duration:performance.now()-start});}
        catch {setStatus('unavailable');}
      });
    };
    extractAvatarPalette(source).then(draw).catch(()=>draw({colors:NEUTRAL_PALETTE,seed:114522,fallback:true}));
    return ()=>{cancelled=true;cancelAnimationFrame(frame);};
  },[source,variation,onResult]);
  return <div className="avatar-art" data-art-status={status} aria-hidden="true"><canvas ref={ref} /></div>;
}
