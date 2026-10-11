import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Settings, { EffectsTab, VoiceTab } from '../../app/routes/Settings';
import Connect from '../../app/routes/Connect';
import AlertPreviewHost from '../../components/AlertPreview';
import type { Config, Donation } from '../../data/types';
import type { DemoProvider } from './DemoProvider';
import demoMedia from '../../public-page/assets/landing-demo.webp';

function useDemoConfig(provider: DemoProvider) {
  const [cfg,setCfg] = useState(() => provider.getConfig());
  useEffect(()=>provider.subscribe(()=>setCfg(provider.getConfig())),[provider]);
  function update(fn:(d:Config)=>void){const draft=provider.getConfig();fn(draft);provider.saveConfig(draft)}
  return {cfg,update};
}
export function NativeAlert({provider,event}: {provider:DemoProvider;event:Donation|null}) {
  return <AlertPreviewHost demoProvider={provider} donation={event} inline safeDemo/>;
}
export function NativeDesigner({provider}: {provider:DemoProvider}) {
  const [event,setEvent]=useState<Donation|null>(null);
  const ref=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    // Start at the original title controls; media controls stay available by scrolling up.
    const frame=requestAnimationFrame(()=>{const props=ref.current?.querySelector<HTMLElement>('.ed-props');const title=props?.querySelectorAll<HTMLElement>('.props-card')[1];if(props&&title)props.scrollTop=title.getBoundingClientRect().top-props.getBoundingClientRect().top;});
    return()=>cancelAnimationFrame(frame);
  },[]);
  return <div ref={ref} className="lp-native-designer dark-product">
    <Settings demoProvider={provider} initialTab="design" onPreview={setEvent} mediaLibrary={[demoMedia]}/>
    {event&&<div className="lp-native-test"><NativeAlert provider={provider} event={event}/><button className="lp-close-native" onClick={()=>setEvent(null)}>Закрыть тест</button></div>}
  </div>;
}
export function NativeVoices({provider}: {provider:DemoProvider}) {const {cfg,update}=useDemoConfig(provider);return <div className="lp-native-voices dark-product"><VoiceTab cfg={cfg} update={update} safeDemo/></div>}
export function NativeEffects({provider}: {provider:DemoProvider}) {const {cfg,update}=useDemoConfig(provider);return <div className="lp-native-effects dark-product"><EffectsTab cfg={cfg} update={update}/></div>}
export function NativeConnect({provider}: {provider:DemoProvider}) {const [event,setEvent]=useState<Donation|null>(null);return <div className="lp-native-connect dark-product"><Connect demoProvider={provider} initialStep={2} onPreview={setEvent}/>{event&&<div className="lp-native-test"><NativeAlert provider={provider} event={event}/><button className="lp-close-native" onClick={()=>setEvent(null)}>Закрыть тест</button></div>}</div>}
