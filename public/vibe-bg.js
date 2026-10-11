/*!
 * VibeBG — генеративная анимация в стиле «Моя волна» Яндекс Музыки.
 * Порт WebGL-шейдеров VibeWidgetAnimation. Без зависимостей.
 *
 * Два режима:
 *   VibeBG.init(opts)                  — канвас фиксированным фоном на всю страницу;
 *   VibeBG.attach(selector, opts)      — мини-канвасы внутри элементов (карточек).
 *                                        Возвращает dispose-функцию.
 *
 * Опции: palette ('green'|'emerald'|объект), mode ('blob'|'rays'),
 *        scale (размер пятна), energy, transparent (по умолчанию true),
 *        fps, phase (сдвиг фазы дыхания).
 */
(function () {
  'use strict';

  /* ================= GLSL ================= */

  const HEADER = `
#define INV_TWO_EFFECT_PI 0.15915494
#define TWO_EFFECT_PI 6.2831853
#define EFFECT_PI 3.14159265
#define MATH_PI 3.14159265
#define TWO_MATH_PI 6.2831853
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float snoise3(vec3 v) {
  const vec2 C = vec2(0.1666667, 0.3333333);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
vec2 rotate(vec2 p, float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}
`;

  const NOISE_CACHE_FRAG = `
precision highp float;
varying highp vec2 textureUv;
uniform vec2 vScreenSize;
uniform float vTime;
uniform float vScale;
uniform vec2 vOffset;
uniform vec3 vRotation[3];
uniform float vReact[3];
${HEADER}
vec2 getEffectUv() {
  float invMinScreenScale = 1.0 / (min(vScreenSize.x, vScreenSize.y) * vScale);
  return (textureUv * 2.0 - 1.0) * vScreenSize * invMinScreenScale;
}
float getLayerNoise(vec2 uv, float reaction, vec3 rotation, float offset) {
  vec2 noiseOffset = rotate(rotation.xy, vTime * rotation.z);
  vec2 localUv = uv * (1.0 - reaction * 0.5) + noiseOffset;
  return clamp(snoise3(vec3(localUv * 1.2 + offset, vTime * 0.5 + offset)) * 0.5 + 0.5, 0.0, 1.0);
}
void main() {
  vec2 uv = getEffectUv() - vOffset;
  float sharedNoise = clamp(snoise3(vec3(uv * 1.2, vTime * 0.5)), -1.0, 1.0);
  float layerNoise0 = 0.5;
  float layerNoise1 = 0.5;
  float layerNoise2 = 0.5;
  layerNoise0 = getLayerNoise(uv, vReact[0], vRotation[0], 0.00);
  layerNoise1 = getLayerNoise(uv, vReact[1], vRotation[1], 1.57);
  layerNoise2 = getLayerNoise(uv, vReact[2], vRotation[2], 3.14);
  gl_FragColor = vec4(sharedNoise * 0.5 + 0.5, layerNoise0, layerNoise1, layerNoise2);
}
`;

  const SPARK_LUT_FRAG = `
precision highp float;
varying highp vec2 textureUv;
uniform float vTime;
${HEADER}
float tri(float x){return abs(fract(x) - 0.5);}
vec3 tri3(vec3 p) {
  float triangleX = tri(p.x);
  return vec3(tri(p.z + tri(p.y * 20.0)), tri(p.z + triangleX), tri(p.y + triangleX));
}
float triNoise3D(vec3 p) {
  float z = 0.4;
  float result = 0.1;
  vec3 base = p;
  float timeShift = vTime * 0.01;
  for (int octave = 0; octave < 5; ++octave) {
    vec3 displacement = tri3(base * 0.01);
    p += displacement + timeShift;
    base *= 4.0;
    z *= 0.9;
    p *= 1.6;
    result += tri(p.z + tri(0.6 * p.x + 0.1 * tri(p.y))) / z;
  }
  return smoothstep(0.0, 8.0, result + sin(result + sin(z) * 2.8) * 2.2);
}
float getRawSpark(float angleIndex) {
  float angle = angleIndex * TWO_EFFECT_PI;
  float shiftedAngle = angle + EFFECT_PI;
  if (shiftedAngle > MATH_PI) { shiftedAngle -= TWO_MATH_PI; }
  float shiftedIndex = shiftedAngle * INV_TWO_EFFECT_PI;
  float seamAngle = (shiftedAngle + EFFECT_PI) * 0.5;
  float seamWeight = smoothstep(0.9, 1.0, sin(seamAngle));
  float spark = triNoise3D(vec3(angleIndex, 0.0, 0.0));
  if (seamWeight > 0.0) {
    float seamSpark = triNoise3D(vec3(shiftedIndex, 0.0, shiftedIndex));
    spark = mix(spark, seamSpark, seamWeight);
  }
  return spark;
}
void main() {
  float angleIndex = textureUv.x - 0.5;
  gl_FragColor = vec4(getRawSpark(angleIndex), 0.0, 0.0, 1.0);
}
`;

  const VERT = `
precision highp float;
attribute vec4 position;
varying highp vec2 textureUv;
void main() {
  textureUv = position.xy * 0.5 + 0.5;
  gl_Position = position;
}
`;

  // Композитный шейдер: генерируется под число блобов (3 — обычный, 2 — лёгкий).
  // transparent: rgb премультиплицируется, фон канваса прозрачный.
  function buildCompositeFrag(n, transparent) {
    const colorType = transparent ? 'vec4' : 'vec3';
    const colorDecl = `${colorType} color = vColorBackground;`;
    const fragOut = transparent ? 'gl_FragColor = color;' : 'gl_FragColor = vec4(color, 1.0);';
    const channels = ['g', 'b', 'a'];
    const calls = [];
    for (let i = 0; i < n; i++) {
      const t = i.toFixed(1);
      const mixLine = transparent
        ? 'color.rgb = mix(color.rgb, blobColor.rgb, blobColor.a); color.a = max(color.a, blobColor.a);'
        : 'color = mix(color, blobColor.rgb, blobColor.a);';
      calls.push(`
  blobColor = makeBlobFromCachedNoise(uv, baseLen, cachedNoise.${channels[i]},
    CIRCLE_RADIUS_BASE - CIRCLE_RADIUS_STEP * ${t} + 0.3 * sharedNoise,
    vColor[${i}], vColor[${i + 3}], CIRCLE_WIDTH_BASE - CIRCLE_WIDTH_STEP * ${t},
    (SPARK_STRENGTH_BASE - SPARK_STRENGTH_STEP * ${t}) * spark,
    vReact[${i}], vAudio[${i}], CIRCLE_OFFSET_BASE + CIRCLE_OFFSET_STEP * ${t}, vRotation[${i}]);
  ${mixLine}`);
    }
    return `
precision highp float;
varying highp vec2 textureUv;
uniform vec2 vScreenSize;
uniform float vTime;
uniform float vScale;
uniform vec2 vOffset;
uniform ${colorType} vColorBackground;
uniform vec3 vColor[6];
uniform vec3 vRotation[3];
uniform float vAudio[3];
uniform float vReact[3];
uniform float uNoBlob;
uniform sampler2D vNoiseCache;
uniform sampler2D vSparkLut;
${HEADER}
#define CIRCLE_WIDTH_BASE 0.8
#define CIRCLE_WIDTH_STEP 0.2
#define SPARK_STRENGTH_BASE 1.0
#define SPARK_STRENGTH_STEP 0.3
#define CIRCLE_RADIUS_BASE 0.95
#define CIRCLE_RADIUS_STEP 0.15
#define CIRCLE_OFFSET_BASE 0.0
#define CIRCLE_OFFSET_STEP 1.57
float shapeSpark(float rawSpark) {
  float spark2 = rawSpark * rawSpark;
  float spark4 = spark2 * spark2;
  float spark8 = spark4 * spark4;
  float spark = rawSpark * 0.2 + spark8 * spark2;
  float gateInput = clamp(0.3 / max(spark, 0.00001), 0.0, 1.0);
  float gate = gateInput * gateInput * (3.0 - 2.0 * gateInput);
  return spark * gate;
}
vec4 makeBlobFromCachedNoise(
  vec2 uv, float baseLen, float layerNoise, float blob,
  vec3 color1, vec3 color2, float width, float baseReaction,
  float likeReaction, float audioStrength, float offset, vec3 rotation
) {
  float outerRadius = blob + width * 0.5
    + baseReaction * (1.0 + max(likeReaction, audioStrength * 0.6) * 50.0 * baseReaction);
  if (baseLen >= outerRadius) { return vec4(0.0); }
  vec2 noiseOffset = rotate(rotation.xy, vTime * rotation.z);
  vec2 localUv = uv * (1.0 - likeReaction * 0.5) + noiseOffset;
  float localLen = length(localUv);
  float distanceToNoise = abs(localLen - layerNoise);
  float innerEdge = layerNoise + 1.1 + sin(vTime + offset);
  // hollow: вырезаем сплошную заливку — остаются контур, wisps и лучи
  float hollow = smoothstep(layerNoise - 0.12, layerNoise, localLen);
  float alphaA = 1.0 - smoothstep(layerNoise, innerEdge, localLen);
  float alpha = mix(alphaA, alphaA * hollow, uNoBlob);
  float outerMask = 1.0 - smoothstep(0.5, outerRadius, baseLen);
  alpha *= outerMask;
  float strength = max(likeReaction, audioStrength);
  float intensity = 0.15 * (1.0 - 0.75 * sin(vTime * 2.0 + offset * 0.5)) + 0.3 * strength;
  float glow = intensity / (1.0 + 11.0 * distanceToNoise);
  glow *= mix(1.0, 1.9, uNoBlob);
  vec3 color = clamp(mix(color1, color2, localUv.y * 2.0) + glow, 0.0, 1.0);
  color += 0.6 * likeReaction * (1.0 - smoothstep(0.2, outerRadius * 0.8, baseLen)) * mix(1.0, hollow, uNoBlob);
  return vec4(color, alpha);
}
vec2 getEffectUv() {
  float invMinScreenScale = 1.0 / (min(vScreenSize.x, vScreenSize.y) * vScale);
  return (textureUv * 2.0 - 1.0) * vScreenSize * invMinScreenScale;
}
void main() {
  vec2 uv = getEffectUv() - vOffset;
  float baseLen = length(uv);
  float angleIndex = atan(uv.y, uv.x) * INV_TWO_EFFECT_PI;
  float sparkTextureX = fract(angleIndex + 0.5);
  vec4 cachedNoise = texture2D(vNoiseCache, textureUv);
  float sharedNoise = cachedNoise.r * 2.0 - 1.0;
  float spark = shapeSpark(texture2D(vSparkLut, vec2(sparkTextureX, 0.5)).r);
  ${colorDecl}
  vec4 blobColor;
${calls.join('')}
  ${fragOut}
}
`;
  }

  /* ================= Палитры и утилиты ================= */

  const PALETTES = {
    green: {
      bg: { h: 152, s: 0.7, l: 0.06 },
      layers: [
        { h: 152, s: 0.8, l: 0.28 },
        { h: 140, s: 0.85, l: 0.44 },
        { h: 127, s: 0.9, l: 0.58 },
      ],
      hueJitter: 7,
      lDrop: 0.78,
    },
    emerald: {
      bg: { h: 160, s: 0.65, l: 0.05 },
      layers: [
        { h: 162, s: 0.75, l: 0.26 },
        { h: 155, s: 0.8, l: 0.4 },
        { h: 145, s: 0.85, l: 0.55 },
      ],
      hueJitter: 6,
      lDrop: 0.76,
    },
  };

  const ROTATION = [[-0.3, 0.3, 0.2], [-0.3, -0.3, -0.2], [-0.3, -0.3, 0.2]];
  const clamp01 = x => Math.min(1, Math.max(0, x));

  function hslToRgb(h, s, l) {
    const f = n => {
      const k = (n + h / 30) % 12;
      return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    return [f(0), f(8), f(4)];
  }

  function buildColors(palette) {
    // vColor = [bottomStart, middleStart, topStart, bottomEnd, middleEnd, topEnd]
    const c = [];
    palette.layers.forEach(L => c.push({ h: L.h - palette.hueJitter, s: L.s, l: L.l }));
    palette.layers.forEach(L => c.push({ h: L.h + palette.hueJitter, s: L.s, l: L.l * palette.lDrop }));
    return c;
  }

  // мягкая атака вместо мгновенной — иначе каждый бит читается как строб
  function audioParam(cur, target) {
    if (target > cur) return cur + (target - cur) * 0.45;
    return Math.max(target, cur - 0.02);
  }

  // «Дыхание» без музыки: плавный мощный пульс — эффект постоянно «раскрыт»
  function breathBands(t) {
    return [
      clamp01(0.5 + 0.5 * Math.sin(t * 2 * Math.PI / 9)) * 0.50,
      clamp01(0.5 + 0.5 * Math.sin(t * 2 * Math.PI / 13 + 2)) * 0.40,
      clamp01(0.5 + 0.5 * Math.sin(t * 2 * Math.PI / 17 + 4)) * 0.30,
    ];
  }

  const HOST_CSS = `
.vibe-host { position: relative !important; overflow: hidden !important; isolation: isolate !important; }
.vibe-host > canvas.vibe-canvas { position: absolute; inset: 0; width: 100%; height: 100%; z-index: -1; pointer-events: none; display: block; }
`;
  let hostCssInjected = false;
  function injectHostCss() {
    if (hostCssInjected || !document.head) return;
    const s = document.createElement('style');
    s.textContent = HOST_CSS;
    document.head.appendChild(s);
    hostCssInjected = true;
  }

  /* ================= Инстанс движка (свой gl на канвас) ================= */

  const instances = new Set();
  let rafStarted = false;

  function ensureLoop() {
    if (rafStarted) return;
    rafStarted = true;
    const tickAll = (now) => {
      instances.forEach(inst => inst.tick(now));
      if (instances.size > 0) requestAnimationFrame(tickAll);
      else rafStarted = false;
    };
    requestAnimationFrame(tickAll);
  }

  function createInstance(host, layout, opts) {
    const canvas = document.createElement('canvas');
    canvas.className = 'vibe-canvas';
    if (layout === 'page') {
      canvas.style.cssText = `position:fixed;inset:0;width:100vw;height:100vh;z-index:${opts.zIndex};pointer-events:none;`;
    } else {
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
    }
    host.appendChild(canvas);

    const gl = canvas.getContext('webgl', {
      alpha: !!opts.transparent, premultipliedAlpha: true,
      antialias: false, depth: false, stencil: false, powerPreference: 'high-performance',
    });
    if (!gl) { canvas.remove(); return null; }

    function compile(type, src) {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(sh));
      return sh;
    }
    function program(fs) {
      const p = gl.createProgram();
      gl.attachShader(p, compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
      return p;
    }
    function loc(p, name) { return gl.getUniformLocation(p, name) || gl.getUniformLocation(p, name + '[0]'); }

    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,0,1, 1,-1,0,1, -1,1,0,1, -1,1,0,1, 1,-1,0,1, 1,1,0,1]), gl.STATIC_DRAW);
    function bindQuad(p) {
      const a = gl.getAttribLocation(p, 'position');
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.enableVertexAttribArray(a);
      gl.vertexAttribPointer(a, 4, gl.FLOAT, false, 0, 0);
    }
    function makeTarget(w, h, wrapS) {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return { tex, fbo, w, h };
    }

    const pal = opts._palette;
    let state = {
      time: Math.floor(3600 * Math.random()),
      colors: buildColors(pal),
      reactBase: 0.6,
      react: [0.6, 0.6, 0.6],
      audio: [0, 0, 0],
      seed: Math.random() * 1000, // фаза дыхания у каждого инстанса своя
    };

    let targets = null, compU = null;
    const pn = program(NOISE_CACHE_FRAG);
    const uN = { p: pn, screen: loc(pn,'vScreenSize'), time: loc(pn,'vTime'), scale: loc(pn,'vScale'), offset: loc(pn,'vOffset'), rot: loc(pn,'vRotation'), react: loc(pn,'vReact') };
    const ps = program(SPARK_LUT_FRAG);
    const uS = { p: ps, time: loc(ps,'vTime') };

    function size() {
      let w, h;
      if (layout === 'page') {
        const k = Math.min(1, 640 / Math.max(2, window.innerHeight));
        w = Math.max(2, Math.round(window.innerWidth * k));
        h = Math.max(2, Math.round(window.innerHeight * k));
      } else {
        // мини-канвас в карточке: половина размера хоста, с потолком по ширине
        w = Math.min(480, Math.max(48, Math.round((host.clientWidth || 160) * 0.5)));
        h = Math.min(240, Math.max(36, Math.round((host.clientHeight || 80) * 0.5)));
      }
      if (canvas.width === w && canvas.height === h && targets) return;
      canvas.width = w; canvas.height = h;
      if (targets) [targets.noise, targets.spark].forEach(t => { gl.deleteFramebuffer(t.fbo); gl.deleteTexture(t.tex); });
      targets = {
        noise: makeTarget(Math.max(1, w >> 1), Math.max(1, h >> 1), gl.CLAMP_TO_EDGE),
        spark: makeTarget(512, 1, gl.REPEAT),
      };
      if (compU) gl.deleteProgram(compU.p);
      const p = program(buildCompositeFrag(opts.blobs || 3, opts.transparent));
      compU = { p,
        screen: loc(p, 'vScreenSize'), time: loc(p, 'vTime'), scale: loc(p, 'vScale'), offset: loc(p, 'vOffset'),
        bg: loc(p, 'vColorBackground'), color: loc(p, 'vColor'), rot: loc(p, 'vRotation'),
        audio: loc(p, 'vAudio'), react: loc(p, 'vReact'), noBlob: loc(p, 'uNoBlob'),
        noiseTex: loc(p, 'vNoiseCache'), sparkTex: loc(p, 'vSparkLut') };
    }

    function render() {
      const bgRgb = hslToRgb(pal.bg.h, pal.bg.s, pal.bg.l);
      const rgb = [];
      state.colors.forEach(c => rgb.push(...hslToRgb(c.h, c.s, c.l)));

      // центр пятна: opts.offset — доли ширины/высоты канваса ([0.5,0.5] — центр)
      const minSide = Math.min(canvas.width, canvas.height);
      const f = opts.offset || [0.5, 0.5];
      const offX = (f[0] * 2 - 1) * canvas.width / (minSide * opts.scale);
      const offY = (1 - f[1] * 2) * canvas.height / (minSide * opts.scale);

      gl.bindFramebuffer(gl.FRAMEBUFFER, targets.noise.fbo);
      gl.viewport(0, 0, targets.noise.w, targets.noise.h);
      gl.useProgram(uN.p);
      bindQuad(uN.p);
      gl.uniform2f(uN.screen, canvas.width, canvas.height);
      gl.uniform1f(uN.time, state.time);
      gl.uniform1f(uN.scale, opts.scale);
      gl.uniform2f(uN.offset, offX, offY);
      gl.uniform3fv(uN.rot, ROTATION.flat());
      gl.uniform1fv(uN.react, state.react);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      gl.bindFramebuffer(gl.FRAMEBUFFER, targets.spark.fbo);
      gl.viewport(0, 0, 512, 1);
      gl.useProgram(uS.p);
      bindQuad(uS.p);
      gl.uniform1f(uS.time, state.time);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      const cp = compU;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(cp.p);
      bindQuad(cp.p);
      gl.uniform2f(cp.screen, canvas.width, canvas.height);
      gl.uniform1f(cp.time, state.time);
      gl.uniform1f(cp.scale, opts.scale);
      gl.uniform2f(cp.offset, offX, offY);
      if (opts.transparent) gl.uniform4f(cp.bg, 0, 0, 0, 0);
      else gl.uniform3f(cp.bg, bgRgb[0], bgRgb[1], bgRgb[2]);
      gl.uniform3fv(cp.color, rgb);
      gl.uniform3fv(cp.rot, ROTATION.flat());
      gl.uniform1fv(cp.audio, state.audio);
      gl.uniform1fv(cp.react, state.react);
      gl.uniform1f(cp.noBlob, opts.mode === 'rays' ? 1 : 0);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, targets.noise.tex); gl.uniform1i(cp.noiseTex, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, targets.spark.tex); gl.uniform1i(cp.sparkTex, 1);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    let last = 0, lastRender = 0;

    function tick(now) {
      if (layout === 'card') {
        // карточка могла изменить размер — пересобираем при расхождении
        const w = Math.min(480, Math.max(48, Math.round((host.clientWidth || 160) * 0.5)));
        const h = Math.min(240, Math.max(36, Math.round((host.clientHeight || 80) * 0.5)));
        if (w !== canvas.width || h !== canvas.height) size();
      }
      const dt = Math.min(100, now - (last || now));
      last = now;
      if (now - lastRender >= 1000 / (opts.fps || 25)) {
        lastRender = now;
        state.time = (state.time + opts.energy * dt / 1000) % 86400;
        const t = now / 1000 + state.seed;
        let bands = breathBands(t);
        if (opts.analyser) {
          const an = opts.analyser;
          an.getByteFrequencyData(opts.freqData);
          const binHz = opts.audioCtx.sampleRate / 2 / an.frequencyBinCount;
          const band = (lo, hi) => {
            const a = Math.max(0, Math.floor(lo / binHz)), b = Math.min(an.frequencyBinCount - 1, Math.ceil(hi / binHz));
            let s = 0; for (let i = a; i <= b; i++) s += opts.freqData[i];
            return clamp01(s / ((b - a + 1) * 255) * 1.7);
          };
          bands = [band(0, 250), band(500, 2000), band(2000, 4000)];
        }
        state.audio = state.audio.map((cur, i) => audioParam(cur, bands[i]));
        render();
      }
    }

    size();

    return {
      tick,
      renderOnce() { size(); render(); },
      pulse() {
        const base = state.reactBase;
        const set = (i, v) => { state.react[i] = v; };
        set(0, 0.95); setTimeout(() => set(1, 0.95), 100); setTimeout(() => set(2, 0.95), 150);
        setTimeout(() => set(0, base), 850); setTimeout(() => set(1, base), 950); setTimeout(() => set(2, base), 1050);
      },
      destroy() {
        if (targets) [targets.noise, targets.spark].forEach(t => { gl.deleteFramebuffer(t.fbo); gl.deleteTexture(t.tex); });
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        canvas.remove();
      },
    };
  }

  function resolveOpts(userOpts) {
    const opts = Object.assign({
      palette: 'green',
      mode: 'blob',
      scale: 0.75,
      offset: [0.5, 0.5],  // центр пятна: [доля ширины, доля высоты], [0.5,0.5] — центр
      energy: 0.45,
      transparent: true,
      fps: 25,
      zIndex: -1,
    }, userOpts || {});
    opts._palette = typeof opts.palette === 'string' ? (PALETTES[opts.palette] || PALETTES.green) : opts.palette;
    return opts;
  }

  /* ================= API ================= */

  // Фон на всю страницу
  function init(userOpts) {
    const opts = resolveOpts(userOpts);
    injectHostCss();
    const inst = createInstance(document.body, 'page', opts);
    if (!inst) { console.warn('VibeBG: WebGL недоступен'); return () => {}; }
    instances.add(inst);
    ensureLoop();
    let resizeTimer = 0;
    const onResize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => inst.renderOnce(), 120); };
    window.addEventListener('resize', onResize);
    return function dispose() {
      window.removeEventListener('resize', onResize);
      instances.delete(inst);
      inst.destroy();
    };
  }

  // Мини-канвасы внутри элементов (карточек). Возвращает dispose.
  function attach(target, userOpts) {
    injectHostCss();
    const opts = resolveOpts(Object.assign({ scale: 0.8, offset: [0.78, 0.5], energy: 0.45 }, userOpts));
    const els = typeof target === 'string'
      ? Array.from(document.querySelectorAll(target))
      : (target instanceof Element ? [target] : Array.from(target || []));
    const added = [];
    const hosts = [];
    els.forEach(el => {
      el.classList.add('vibe-host');
      const inst = createInstance(el, 'card', opts);
      if (inst) { instances.add(inst); added.push(inst); hosts.push(el); }
    });
    ensureLoop();
    let done = false;
    return function dispose() {
      if (done) return; done = true;
      added.forEach(i => { instances.delete(i); i.destroy(); });
      hosts.forEach(h => h.classList.remove('vibe-host'));
    };
  }

  function pulseAll() { instances.forEach(i => i.pulse()); }
  function setPalette(p) {
    instances.forEach(() => {});
    // палитра применяется при создании; для смены на лету пересоздавайте attach
    console.warn('VibeBG.setPalette: примените палитру через опции init/attach.');
  }

  window.VibeBG = {
    init, attach, pulse: pulseAll,
    // отладка: рисует один кадр всех инстансов вручную (для скрытых вкладок)
    _debug: { render: () => instances.forEach(i => i.renderOnce()) },
  };
})();
