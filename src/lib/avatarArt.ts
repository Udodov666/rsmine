/* Own, dependency-free avatar-to-art engine. Version the seed if the renderer changes. */
export type RGB = [number, number, number];
export type AvatarPalette = { colors: RGB[]; seed: number; fallback: boolean };
export const ART_VERSION = 2;
export const NEUTRAL_PALETTE: RGB[] = [[42,44,49],[76,79,86],[135,139,146],[190,192,198],[26,28,32]];
const clamp = (v: number, lo = 0, hi = 255) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export function mix(a: RGB, b: RGB, t: number): RGB { return [lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)]; }
export const colorHex = (c: RGB) => '#' + c.map(v => Math.round(clamp(v)).toString(16).padStart(2,'0')).join('');
function distance(a: RGB,b: RGB) { return 2*(a[0]-b[0])**2 + 4*(a[1]-b[1])**2 + 3*(a[2]-b[2])**2; }
export function hashBytes(bytes: Uint8ClampedArray): number {
  let h=2166136261;
  for(let i=0;i<bytes.length;i++){ h^=bytes[i];h=Math.imul(h,16777619); }
  return h>>>0;
}
export function randomSource(seed: number) {
  let s=seed>>>0;
  return () => { s+=0x6d2b79f5;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296; };
}
export function colorHSV(c: RGB): [number,number,number] {
  const r=c[0]/255,g=c[1]/255,b=c[2]/255,max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
  let h=0;if(d){if(max===r)h=((g-b)/d)%6;else if(max===g)h=(b-r)/d+2;else h=(r-g)/d+4;h=((h*60)%360+360)%360;}
  return [h,max?d/max:0,max];
}
/** Preserve actual vivid pixels, not averaged/muddy cluster centers. */
export function paletteFromPixels(bytes: Uint8ClampedArray): AvatarPalette {
  const all:RGB[]=[], buckets:RGB[][]=Array.from({length:7},()=>[]), neutrals:RGB[]=[];
  for(let i=0;i<bytes.length;i+=4){
    if(bytes[i+3]<128)continue;const c:RGB=[bytes[i],bytes[i+1],bytes[i+2]];all.push(c);
    const [h,s,v]=colorHSV(c);
    if(s<.16){neutrals.push(c);continue;}if(v<.22)continue;
    const k=h<25||h>=340?0:h<58?1:h<90?2:h<170?3:h<200?4:h<265?5:6;buckets[k].push(c);
  }
  if(!all.length)return {colors:NEUTRAL_PALETTE,seed:hashBytes(bytes),fallback:true};
  const groups=buckets.map(b=>({count:b.length,colors:b})).filter(b=>b.count>=Math.max(1,all.length*.004)).sort((a,b)=>b.count-a.count);
  const selected:RGB[]=[];
  for(const group of groups){
    const ordered=[...group.colors].sort((a,b)=>{const A=colorHSV(a),B=colorHSV(b);return A[1]*A[2]-B[1]*B[2];});
    const c=ordered[Math.floor((ordered.length-1)*.94)];
    if(!selected.some(old=>distance(old,c)<1900))selected.push(c);
    if(selected.length===6)break;
  }
  if(neutrals.length>all.length*.02){
    const clean=neutrals.filter(c=>colorHSV(c)[1]<.08);
    const ordered=[...(clean.length?clean:neutrals)].sort((a,b)=>(a[0]+a[1]+a[2])-(b[0]+b[1]+b[2]));
    selected.push(ordered[Math.floor((ordered.length-1)*.83)]);
  }
  if(!selected.length){const c=[...all].sort((a,b)=>(a[0]+a[1]+a[2])-(b[0]+b[1]+b[2]));selected.push(c[Math.floor((c.length-1)*.65)]);}
  return {colors:selected.slice(0,7),seed:hashBytes(bytes),fallback:false};
}
const paletteCache=new Map<string,Promise<AvatarPalette>>();
export function extractAvatarPalette(source: string): Promise<AvatarPalette> {
  const cached=paletteCache.get(source);if(cached)return cached;
  const promise=new Promise<AvatarPalette>((resolve,reject)=>{
    const image=new Image();let done=false;
    const finish=(error?: Error)=>{if(done)return;done=true;clearTimeout(timer);image.onload=null;image.onerror=null;if(error)reject(error);};
    const timer=window.setTimeout(()=>finish(new Error('Avatar image timed out')),10000);
    if(/^https?:/i.test(source))image.crossOrigin='anonymous';
    image.onload=()=>{
      try {const c=document.createElement('canvas');c.width=128;c.height=128;const ctx=c.getContext('2d',{willReadFrequently:true});if(!ctx)throw new Error('Canvas unavailable');
        ctx.imageSmoothingEnabled=false;ctx.drawImage(image,0,0,128,128);const result=paletteFromPixels(ctx.getImageData(0,0,128,128).data);finish();resolve(result);
      } catch(e){finish(e instanceof Error?e:new Error('Could not read avatar pixels'));}
    };
    image.onerror=()=>finish(new Error('Avatar could not be loaded (CORS or invalid image)'));
    image.src=source;
  });
  paletteCache.set(source,promise);
  promise.catch(()=>{paletteCache.delete(source);});
  if(paletteCache.size>8)paletteCache.delete(paletteCache.keys().next().value!);
  return promise;
}
/** Graphic paper collage: clear silhouettes and real avatar pigments, no marbling. */
export function renderAvatarArt(canvas: HTMLCanvasElement,palette: AvatarPalette,variation=0,width=1440,height=432) {
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas unavailable');canvas.width=width;canvas.height=height;
  const seed=(palette.seed^Math.imul(variation+ART_VERSION,2654435761))>>>0,random=randomSource(seed);
  const colors=palette.colors.length?palette.colors:NEUTRAL_PALETTE;
  const saturated=colors.filter(c=>colorHSV(c)[1]>.28);
  const pick=(hue:number,fallback:RGB):RGB=>{
    if(!saturated.length)return fallback;
    const ordered=[...saturated].sort((a,b)=>{const ha=colorHSV(a)[0],hb=colorHSV(b)[0];return Math.min(Math.abs(ha-hue),360-Math.abs(ha-hue))-Math.min(Math.abs(hb-hue),360-Math.abs(hb-hue));});
    return ordered[0];
  };
  const blue=pick(218,colors[0]),green=pick(140,colors[1]||blue),yellow=pick(44,colors[2]||green),red=pick(2,colors[3]||yellow);
  const light=[...colors].sort((a,b)=>(b[0]+b[1]+b[2])-(a[0]+a[1]+a[2]))[0];
  const shift=(random()-.5)*.10,tilt=(random()-.5)*.10;
  ctx.save();ctx.scale(width/1440,height/432);
  ctx.fillStyle=colorHex(blue);ctx.fillRect(0,0,1440,432);
  // One oversized cut-paper arch: enough negative space, no confetti of tiny shapes.
  ctx.fillStyle=colorHex(light);ctx.beginPath();
  ctx.moveTo(-80,450);ctx.bezierCurveTo(95,470,144+shift*300,-130,500,-110);
  ctx.bezierCurveTo(724,-100,685+shift*240,284,1010,250);
  ctx.bezierCurveTo(1110,240,1250,-20,1510,-44);ctx.lineTo(1510,-150);ctx.lineTo(-80,-150);ctx.closePath();ctx.fill();
  // Rounded hills echo the outdoor/green part of the source without copying the photo.
  ctx.fillStyle=colorHex(green);ctx.beginPath();ctx.moveTo(-40,360);
  ctx.bezierCurveTo(135,234,310,290,490,370);ctx.bezierCurveTo(698,463,825,334,1030,351);
  ctx.bezierCurveTo(1260,371,1280,254,1480,276);ctx.lineTo(1480,500);ctx.lineTo(-40,500);ctx.closePath();ctx.fill();
  // Warm toy/cap pigments from the avatar form a single focal graphic.
  const cx=900+shift*700,cy=164+tilt*260,rad=155+random()*28;
  ctx.fillStyle=colorHex(yellow);ctx.beginPath();ctx.arc(cx,cy,rad,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=colorHex(red);ctx.beginPath();ctx.moveTo(cx,cy);
  const start=-Math.PI*.64+tilt,end=start+Math.PI*1.18;
  ctx.arc(cx,cy,rad,start,end);ctx.closePath();ctx.fill();
  // Small cream disc makes the large form read like a graphic rosette, not a random blob.
  ctx.fillStyle=colorHex(light);ctx.beginPath();ctx.arc(cx,cy,rad*.33,0,Math.PI*2);ctx.fill();
  // A cropped cobalt capsule adds a little collage depth in the pale area.
  ctx.save();ctx.translate(335+shift*600,30);ctx.rotate(-.32+tilt);ctx.fillStyle=colorHex(blue);
  ctx.beginPath();ctx.moveTo(-46,0);ctx.arc(0,0,46,Math.PI,0);ctx.lineTo(46,128);ctx.arc(0,128,46,0,Math.PI);ctx.closePath();ctx.fill();ctx.restore();
  // Sparse, subtle paper grain: no contour lines or dusty global tint.
  ctx.restore();
  const image=ctx.getImageData(0,0,width,height),data=image.data;
  for(let i=0;i<data.length;i+=4){const grain=(random()-.5)*2;for(let c=0;c<3;c++)data[i+c]=clamp(data[i+c]+grain);}
  ctx.putImageData(image,0,0);
  canvas.dataset.artSeed=String(seed);canvas.dataset.artVersion=String(ART_VERSION);
  return {seed,colors:colors.map(colorHex),width,height};
}
/** Files are decoded locally, downscaled before storage; no image data is uploaded. */
export async function readAvatarFile(file: File): Promise<string> {
  if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Выберите PNG, JPG или WebP.');
  if(file.size>8*1024*1024)throw new Error('Размер аватара — до 8 МБ.');
  const url=URL.createObjectURL(file);
  try {const image=new Image();image.src=url;await image.decode();
    if(image.naturalWidth*image.naturalHeight>40_000_000)throw new Error('Слишком большое изображение. Максимум 40 мегапикселей.');
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas недоступен.');
    const side=Math.min(image.naturalWidth,image.naturalHeight);ctx.drawImage(image,(image.naturalWidth-side)/2,(image.naturalHeight-side)/2,side,side,0,0,256,256);
    return canvas.toDataURL('image/png');
  } finally {URL.revokeObjectURL(url);}
}
