/**
 * La composición en HTML.
 *
 * Una sola página por creativo, con todas las escenas. No usa animaciones CSS:
 * `window.__render(t)` calcula el estado exacto de cada elemento para el
 * segundo `t`, y el renderer la llama una vez por cuadro. Así el video sale
 * igual cada vez y ningún cuadro depende de cuánto tardó el anterior.
 *
 * Las grabaciones reales se dibujan en un canvas a partir de sus cuadros (que
 * FFmpeg extrae antes): el Chromium de Playwright no decodifica H.264, y
 * además así cada cuadro del video coincide exactamente con uno de la
 * grabación.
 */

import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { ROOT } from '../config.ts';
import type { Project } from './project.ts';

const fileUrl = (p: string) => pathToFileURL(p).href;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const FONT_FILES: Record<string, { file: string; weight: string }[]> = {
  Fraunces: [{ file: '@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2', weight: '100 900' }],
  Karla: [
    { file: '@fontsource/karla/files/karla-latin-400-normal.woff2', weight: '400' },
    { file: '@fontsource/karla/files/karla-latin-500-normal.woff2', weight: '500' },
    { file: '@fontsource/karla/files/karla-latin-700-normal.woff2', weight: '700' },
    { file: '@fontsource/karla/files/karla-latin-800-normal.woff2', weight: '800' },
  ],
  Archivo: [
    { file: '@fontsource/archivo/files/archivo-latin-400-normal.woff2', weight: '400' },
    { file: '@fontsource/archivo/files/archivo-latin-600-normal.woff2', weight: '600' },
    { file: '@fontsource/archivo/files/archivo-latin-800-normal.woff2', weight: '800' },
    { file: '@fontsource/archivo/files/archivo-latin-900-normal.woff2', weight: '900' },
  ],
};

function fontFaces(families: string[]): string {
  return [...new Set(families)]
    .flatMap((fam) =>
      (FONT_FILES[fam] ?? []).map((f) => `@font-face{font-family:'${fam}';src:url('${fileUrl(join(ROOT, 'node_modules', f.file))}') format('woff2');font-weight:${f.weight};font-style:normal;font-display:block}`)
    )
    .join('\n');
}

export function projectHtml(p: Project, frames: Record<string, string[]>): string {
  const { width: W, height: H } = p;
  const [sT, sR, sB, sL] = p.safe;
  const portrait = H / W > 1.2;
  const landscape = W / H > 1.2;
  const u = landscape ? H / 1080 : W / 1080;
  const c = p.brand.colors;
  const display = p.brand.fonts.display;
  const body = p.brand.fonts.body;
  const displayWeight = display === 'Fraunces' ? 600 : 900;
  const hl = p.text.headline;
  const hlSize = Math.round(u * (portrait ? 136 : landscape ? 104 : 104) * Math.min(1, Math.sqrt(30 / Math.max(hl.length, 12))));
  const words = hl.split(/\s+/);

  const media = p.media.map((m, i) => ({
    ...m,
    i,
    src: m.kind === 'screenshot' ? fileUrl(m.file) : undefined,
    frames: m.kind === 'recording' ? (frames[m.assetId] ?? []).map(fileUrl) : undefined,
  }));

  // Tamaño de los dispositivos según el formato.
  const areaW = W - sL - sR;
  const areaH = H - sT - sB;
  const phoneH = Math.round(Math.min(areaH * (portrait ? 0.86 : 0.88), (areaW * 0.9) / 0.48));
  const phoneW = Math.round(phoneH * 0.48);
  const browserW = Math.round(Math.min(areaW * (landscape ? 0.78 : 0.98), ((areaH * 0.62) / 0.66) * (landscape ? 1.25 : 1)));
  const browserH = Math.round(browserW * 0.66);

  const deviceHtml = media
    .map((m) => {
      const inner =
        m.kind === 'recording'
          ? `<canvas class="rec" data-i="${m.i}"></canvas>`
          : `<img class="shot" data-i="${m.i}" src="${m.src}" alt="">`;
      if (m.device === 'phone') {
        return `<div class="device phone" data-i="${m.i}" style="width:${phoneW}px;height:${phoneH}px"><div class="screen">${inner}</div><div class="notch"></div></div>`;
      }
      if (m.device === 'desktop-strip') {
        return `<div class="device strip" data-i="${m.i}" style="width:${browserW}px"><div class="bar"><i></i><i></i><i></i><span>${esc(p.brand.domain)}/panel</span></div><div class="screen">${inner}</div></div>`;
      }
      return `<div class="device browser" data-i="${m.i}" style="width:${browserW}px;height:${browserH}px"><div class="bar"><i></i><i></i><i></i><span>${esc(p.brand.domain)}</span></div><div class="screen">${inner}</div></div>`;
    })
    .join('');

  const bulletsHtml = p.text.bullets
    .map(
      (b, i) =>
        `<li class="bullet" data-i="${i}"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11"/><path d="M6.5 12.5l3.6 3.6 7.4-8.2"/></svg><span>${esc(b)}</span></li>`
    )
    .join('');

  const data = {
    p: { duration: p.duration, fps: p.fps, timeline: p.timeline, template: p.template, W, H },
    media: media.map((m) => ({ i: m.i, kind: m.kind, device: m.device, frames: m.frames ?? [] })),
    words: words.length,
    bullets: p.text.bullets.length,
  };

  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<style>
${fontFaces([display, body])}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:${c.bgDeep}}
body{font-family:'${body}',system-ui,sans-serif;color:${c.text};-webkit-font-smoothing:antialiased}
#stage{position:relative;width:${W}px;height:${H}px;overflow:hidden;background:${c.bg}}
.glow{position:absolute;border-radius:50%;filter:blur(${Math.round(80 * u)}px);opacity:.9}
#g1{width:${Math.round(W * 0.9)}px;height:${Math.round(W * 0.9)}px;background:radial-gradient(circle,${c.accent}55,transparent 65%)}
#g2{width:${Math.round(W * 0.8)}px;height:${Math.round(W * 0.8)}px;background:radial-gradient(circle,${c.accentStrong}44,transparent 65%)}
.grid{position:absolute;inset:0;background-image:linear-gradient(${c.text}08 1px,transparent 1px),linear-gradient(90deg,${c.text}08 1px,transparent 1px);background-size:${Math.round(72 * u)}px ${Math.round(72 * u)}px;mask-image:radial-gradient(ellipse at 50% 40%,#000 20%,transparent 75%)}
.scene{position:absolute;left:${sL}px;top:${sT}px;width:${areaW}px;height:${areaH}px;opacity:0}
.brandmark{position:absolute;left:${sL}px;top:${Math.max(sT - Math.round(96 * u), Math.round(40 * u))}px;display:flex;align-items:center;gap:${Math.round(16 * u)}px;font-weight:700;font-size:${Math.round(40 * u)}px;letter-spacing:-.01em;opacity:0}
.brandmark img{width:${Math.round(60 * u)}px;height:${Math.round(60 * u)}px;border-radius:${Math.round(14 * u)}px}
.eyebrow{display:inline-flex;align-items:center;gap:${Math.round(14 * u)}px;color:${c.accent};font-weight:700;font-size:${Math.round(36 * u)}px;letter-spacing:.05em;text-transform:uppercase;line-height:1.25}
.eyebrow:before{content:'';width:${Math.round(44 * u)}px;height:${Math.max(2, Math.round(4 * u))}px;background:${c.accent};border-radius:2px;flex:none}
.headline{font-family:'${display}',serif;font-weight:${displayWeight};font-size:${hlSize}px;line-height:1.04;letter-spacing:-.02em;margin-top:${Math.round(34 * u)}px}
.headline .w{display:inline-block;margin-right:.24em;will-change:transform}
.headline .w.acc{color:${c.accent}}
#hook{display:flex;flex-direction:column;justify-content:${portrait ? 'center' : 'center'}}
#hook .sub{margin-top:${Math.round(34 * u)}px;font-size:${Math.round(34 * u)}px;line-height:1.35;color:${c.textSoft};max-width:${Math.round(areaW * 0.95)}px}
#mid{display:flex;align-items:center;justify-content:center}
.device{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);opacity:0;box-shadow:0 ${Math.round(40 * u)}px ${Math.round(120 * u)}px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.08)}
.device .screen{position:absolute;overflow:hidden;background:#fff}
.phone{border-radius:${Math.round(64 * u)}px;background:#0b0b0c;padding:${Math.round(16 * u)}px}
.phone .screen{inset:${Math.round(16 * u)}px;border-radius:${Math.round(50 * u)}px}
.phone .notch{position:absolute;top:${Math.round(30 * u)}px;left:50%;transform:translateX(-50%);width:${Math.round(phoneW * 0.3)}px;height:${Math.round(30 * u)}px;border-radius:${Math.round(20 * u)}px;background:#0b0b0c}
.phone .shot,.phone .rec{position:absolute;left:0;top:0;width:100%}
.browser,.strip{border-radius:${Math.round(18 * u)}px;background:#1e2321;overflow:hidden}
.bar{position:absolute;left:0;right:0;top:0;height:${Math.round(52 * u)}px;display:flex;align-items:center;gap:${Math.round(10 * u)}px;padding:0 ${Math.round(20 * u)}px;background:#2a302d}
.bar i{width:${Math.round(14 * u)}px;height:${Math.round(14 * u)}px;border-radius:50%;background:#55605a;display:block}
.bar span{margin-left:${Math.round(14 * u)}px;flex:1;max-width:60%;height:${Math.round(32 * u)}px;border-radius:${Math.round(16 * u)}px;background:#1b201e;color:#b9c2bd;font-size:${Math.round(19 * u)}px;display:flex;align-items:center;padding:0 ${Math.round(16 * u)}px}
.browser .screen{left:0;right:0;top:${Math.round(52 * u)}px;bottom:0}
.browser .shot{position:absolute;left:0;top:0;width:100%;transform-origin:62% 38%}
.strip{position:absolute}
.strip .screen{position:relative;margin-top:${Math.round(52 * u)}px}
.strip .shot{display:block;width:100%}
.label{position:absolute;left:50%;transform:translateX(-50%);top:${portrait ? Math.round(-10 * u) : Math.round(-6 * u)}px;font-size:${Math.round(28 * u)}px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${c.textSoft};display:flex;align-items:center;gap:${Math.round(10 * u)}px;opacity:0;white-space:nowrap}
.label b{width:${Math.round(14 * u)}px;height:${Math.round(14 * u)}px;border-radius:50%;background:#e5484d;display:block}
.callout{position:absolute;left:50%;bottom:${Math.round(10 * u)}px;transform:translateX(-50%);width:max-content;max-width:${Math.round(areaW * 0.96)}px;display:flex;align-items:center;gap:${Math.round(18 * u)}px;padding:${Math.round(22 * u)}px ${Math.round(30 * u)}px;border-radius:${Math.round(24 * u)}px;background:${c.text};color:${c.bgDeep};font-weight:700;font-size:${Math.round(42 * u)}px;line-height:1.2;box-shadow:0 ${Math.round(20 * u)}px ${Math.round(60 * u)}px rgba(0,0,0,.4);opacity:0}
.callout svg,.bullet svg{flex:none;width:${Math.round(60 * u)}px;height:${Math.round(60 * u)}px}
.callout svg circle{fill:${c.accentStrong}}.callout svg path{stroke:#fff;stroke-width:2.6;fill:none;stroke-linecap:round;stroke-linejoin:round}
#claims{display:flex;flex-direction:column;justify-content:center}
#claims ul{list-style:none;display:flex;flex-direction:column;gap:${Math.round(44 * u)}px}
.bullet{display:flex;align-items:center;gap:${Math.round(24 * u)}px;font-size:${Math.round((portrait ? 58 : 46) * u)}px;font-weight:700;line-height:1.15;opacity:0}
.bullet svg circle{fill:${c.accent}22;stroke:${c.accent};stroke-width:1.4}.bullet svg path{stroke:${c.accent};stroke-width:2.6;fill:none;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:22;stroke-dashoffset:22}
.price{margin-top:${Math.round(60 * u)}px;opacity:0}
.price .big{font-family:'${display}',serif;font-weight:${displayWeight};font-size:${Math.round((portrait ? 104 : 76) * u)}px;letter-spacing:-.02em;color:${c.text}}
.price .note{margin-top:${Math.round(14 * u)}px;font-size:${Math.round(30 * u)}px;color:${c.textSoft}}
#cta{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
#cta .logo{display:flex;align-items:center;gap:${Math.round(22 * u)}px;font-family:'${display}',serif;font-weight:${displayWeight};font-size:${Math.round(132 * u)}px;letter-spacing:-.02em}
#cta .logo img{width:${Math.round(140 * u)}px;height:${Math.round(140 * u)}px;border-radius:${Math.round(24 * u)}px}
#cta .tag{margin-top:${Math.round(28 * u)}px;font-size:${Math.round(44 * u)}px;color:${c.textSoft};max-width:${Math.round(areaW * 0.9)}px;line-height:1.3}
#cta .btn{margin-top:${Math.round(80 * u)}px;padding:${Math.round(36 * u)}px ${Math.round(84 * u)}px;border-radius:999px;background:${c.accent};color:${c.onAccent === '#ffffff' ? c.bgDeep : c.onAccent};font-weight:800;font-size:${Math.round(58 * u)}px}
#cta .url{margin-top:${Math.round(36 * u)}px;font-size:${Math.round(42 * u)}px;color:${c.text};font-weight:700;letter-spacing:.01em}
#cta .foot{position:absolute;bottom:${Math.round(0 * u)}px;left:0;right:0;font-size:${Math.round(26 * u)}px;color:${c.textSoft};letter-spacing:.06em;text-transform:uppercase}
</style></head><body><div id="stage">
<div class="glow" id="g1"></div><div class="glow" id="g2"></div><div class="grid"></div>
<div class="brandmark" id="brandmark">${p.brand.logo ? `<img src="${fileUrl(p.brand.logo)}" alt="">` : ''}<span>${esc(p.brand.name)}</span></div>

<section class="scene" id="hook">
  <div class="eyebrow">${esc(p.text.eyebrow)}</div>
  <h1 class="headline">${words.map((w, i) => `<span class="w${i >= Math.ceil(words.length / 2) ? ' acc' : ''}" data-i="${i}">${esc(w)}</span>`).join('')}</h1>
</section>

<section class="scene" id="mid">
  <div class="label" id="label"><b></b><span>${media.some((m) => m.kind === 'recording') && p.template === 'demo' ? 'Grabación real del sistema' : 'Capturas reales del sistema'}</span></div>
  ${deviceHtml}
  ${p.text.callout ? `<div class="callout" id="callout"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="12"/><path d="M6.5 12.5l3.6 3.6 7.4-8.2"/></svg><span>${esc(p.text.callout)}</span></div>` : ''}
</section>

<section class="scene" id="claims">
  <ul>${bulletsHtml}</ul>
  ${p.text.price ? `<div class="price" id="price"><div class="big">${esc(p.text.price)}</div>${p.text.priceNote ? `<div class="note">${esc(p.text.priceNote)}</div>` : ''}</div>` : ''}
</section>

<section class="scene" id="cta">
  <div class="logo">${p.brand.logo ? `<img src="${fileUrl(p.brand.logo)}" alt="">` : ''}<span>${esc(p.brand.name)}</span></div>
  <div class="tag">${esc(p.text.headline)}</div>
  <div class="btn" id="btn">${esc(p.text.cta)}</div>
  <div class="url">${esc(p.text.url)}</div>
  <div class="foot">${esc(p.text.footer)}</div>
</section>
</div>
<script>
const D = ${JSON.stringify(data)};
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const E = {
  out: (t) => 1 - Math.pow(1 - t, 3),
  inout: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  back: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};
const pr = (t, s, d) => cl((t - s) / d);
const S = Object.fromEntries(D.p.timeline.map((s) => [s.id, s]));
const MID = S.demo || S.tour;
const last = D.p.timeline[D.p.timeline.length - 1].id;
function vis(t, s) {
  if (!s || t < s.start || t > s.end + 0.001) return 0;
  const a = E.out(pr(t, s.start, 0.4));
  const b = s.id === last ? 1 : 1 - E.out(pr(t, s.end - 0.32, 0.32));
  return Math.min(a, b);
}
// Cuadros de las grabaciones, precargados para dibujarlos sin esperar.
const REC = {};
window.__ready = Promise.all([
  document.fonts.ready,
  ...$$('img').map((i) => (i.complete ? Promise.resolve() : new Promise((r) => { i.onload = r; i.onerror = r; }))),
  ...D.media.filter((m) => m.kind === 'recording').map((m) =>
    Promise.all(m.frames.map((src) => new Promise((r) => { const im = new Image(); im.onload = () => r(im); im.onerror = () => r(null); im.src = src; }))).then((ims) => {
      // Las grabaciones suelen empezar con la página en blanco mientras carga:
      // se descartan los cuadros iniciales sin contenido (casi sin variación).
      const ok = ims.filter(Boolean);
      const cv0 = document.createElement('canvas');
      cv0.width = 24; cv0.height = 48;
      const cx0 = cv0.getContext('2d', { willReadFrequently: true });
      const vacio = (im) => {
        cx0.drawImage(im, 0, 0, 24, 48);
        const d = cx0.getImageData(0, 0, 24, 48).data;
        let s = 0, s2 = 0, n = 0;
        for (let k = 0; k < d.length; k += 4) { const y = 0.3 * d[k] + 0.59 * d[k + 1] + 0.11 * d[k + 2]; s += y; s2 += y * y; n++; }
        return s2 / n - (s / n) ** 2 < 60;
      };
      let desde = 0;
      while (desde < ok.length - 1 && vacio(ok[desde])) desde++;
      REC[m.i] = ok.slice(desde);
      const cv = $('canvas.rec[data-i="' + m.i + '"]');
      if (cv && REC[m.i][0]) { cv.width = REC[m.i][0].naturalWidth; cv.height = REC[m.i][0].naturalHeight; }
    })
  ),
]);

window.__render = function (t) {
  // Fondo: dos luces que se mueven despacio.
  $('#g1').style.transform = 'translate(' + (-0.25 * D.p.W + Math.sin(t * 0.35) * 0.08 * D.p.W) + 'px,' + (-0.2 * D.p.H + Math.cos(t * 0.3) * 0.05 * D.p.H) + 'px)';
  $('#g2').style.transform = 'translate(' + (0.45 * D.p.W + Math.cos(t * 0.28) * 0.07 * D.p.W) + 'px,' + (0.62 * D.p.H + Math.sin(t * 0.33) * 0.05 * D.p.H) + 'px)';

  // En los formatos bajos no hay lugar arriba para la marca y el rótulo del
  // producto a la vez: durante la escena del producto la marca se esconde.
  const ocultaMarca = D.p.H / D.p.W < 1.5 ? vis(t, MID) : 0;
  $('#brandmark').style.opacity = String(Math.min(E.out(pr(t, 0.1, 0.5)), 1 - E.out(pr(t, S.cta.start - 0.3, 0.3)), 1 - ocultaMarca));

  // Gancho.
  const hk = $('#hook');
  hk.style.opacity = String(vis(t, S.hook));
  const eb = $('.eyebrow');
  const pe = E.out(pr(t, 0.15, 0.5));
  eb.style.opacity = String(pe);
  eb.style.transform = 'translateY(' + (1 - pe) * 30 + 'px)';
  $$('.headline .w').forEach((w, i) => {
    let s, d;
    if (D.p.template === 'kinetic') { s = 0.35 + i * 0.3; d = 0.45; } else { s = 0.45 + i * 0.07; d = 0.6; }
    const q = pr(t, s, d);
    const k = D.p.template === 'kinetic' ? E.back(q) : E.out(q);
    w.style.opacity = String(cl(q * 1.6));
    w.style.transform = D.p.template === 'kinetic' ? 'scale(' + (0.6 + 0.4 * k) + ') translateY(' + (1 - k) * 40 + 'px)' : 'translateY(' + (1 - k) * 70 + 'px)';
  });

  // Producto.
  const mid = $('#mid');
  mid.style.opacity = String(vis(t, MID));
  const lb = $('#label');
  if (lb) lb.style.opacity = String(Math.min(E.out(pr(t, MID.start + 0.3, 0.4)), 1 - E.out(pr(t, MID.end - 0.5, 0.3))));
  // La grabación pesa el doble que una captura: es lo que más muestra.
  const n = D.media.length;
  const pesos = D.media.map((m) => (m.kind === 'recording' ? 2.2 : 1));
  const totalPeso = pesos.reduce((a, b) => a + b, 0);
  let acc = MID.start;
  D.media.forEach((m, k) => {
    const el = $('.device[data-i="' + m.i + '"]');
    const slot = ((MID.end - MID.start) * pesos[k]) / totalPeso;
    const s0 = acc;
    const s1 = s0 + slot;
    acc = s1;
    const inn = E.out(pr(t, s0 + (k ? 0 : 0.15), 0.6));
    const outt = k === n - 1 ? 0 : E.inout(pr(t, s1 - 0.45, 0.45));
    el.style.opacity = String(t < s0 - 0.01 ? 0 : Math.min(inn, 1 - outt));
    const sc = 0.9 + 0.1 * inn - 0.06 * outt;
    el.style.transform = 'translate(-50%,-50%) translateY(' + ((1 - inn) * 120 - outt * 80) + 'px) scale(' + sc + ')';
    const local = cl((t - s0) / slot);
    if (m.kind === 'recording') {
      const fr = REC[m.i] || [];
      const cv = el.querySelector('canvas');
      if (fr.length && cv) {
        // Acelerada hasta 2,6× para que entre el recorrido y termine en el
        // resultado; si sobra escena, se queda en el último cuadro.
        const rate = Math.min(2.6, Math.max(1, fr.length / (slot * D.p.fps)));
        const desde = Math.max(0, fr.length - slot * D.p.fps * rate);
        const idx = Math.min(fr.length - 1, Math.max(0, Math.floor(desde + (t - s0) * D.p.fps * rate)));
        cv.getContext('2d').drawImage(fr[idx], 0, 0);
      }
    } else {
      const img = el.querySelector('img');
      if (m.device === 'phone') {
        const scr = el.querySelector('.screen');
        const over = Math.max(0, img.offsetHeight - scr.clientHeight);
        img.style.transform = 'translateY(' + (-over * 0.55 * E.inout(cl((local - 0.15) / 0.75))) + 'px)';
      } else if (m.device === 'desktop') {
        img.style.transform = 'scale(' + (1 + 0.16 * E.inout(cl((local - 0.1) / 0.85))) + ')';
      }
    }
  });
  const co = $('#callout');
  if (co) {
    const q = pr(t, MID.start + 0.9, 0.5);
    co.style.opacity = String(Math.min(cl(q * 2), 1 - E.out(pr(t, MID.end - 0.4, 0.3))));
    co.style.transform = 'translateX(-50%) scale(' + (0.8 + 0.2 * E.back(q)) + ')';
  }

  // Lo que respalda.
  $('#claims').style.opacity = String(vis(t, S.claims));
  $$('.bullet').forEach((b, i) => {
    const q = pr(t, S.claims.start + 0.2 + i * 0.32, 0.45);
    b.style.opacity = String(E.out(q));
    b.style.transform = 'translateX(' + (1 - E.out(q)) * -50 + 'px)';
    b.querySelector('path').style.strokeDashoffset = String(22 * (1 - E.out(pr(t, S.claims.start + 0.35 + i * 0.32, 0.4))));
  });
  const pc = $('#price');
  if (pc) {
    const q = pr(t, S.claims.start + 0.3 + D.bullets * 0.32, 0.5);
    pc.style.opacity = String(E.out(q));
    pc.style.transform = 'translateY(' + (1 - E.out(q)) * 30 + 'px)';
  }

  // Cierre.
  const ct = $('#cta');
  ct.style.opacity = String(vis(t, S.cta));
  const q = pr(t, S.cta.start, 0.6);
  ct.style.transform = 'scale(' + (0.94 + 0.06 * E.out(q)) + ')';
  const pulse = t > S.cta.start + 0.8 ? 1 + 0.035 * Math.sin((t - S.cta.start - 0.8) * 5.5) : 0.9 + 0.1 * E.back(pr(t, S.cta.start + 0.3, 0.5));
  $('#btn').style.transform = 'scale(' + pulse + ')';
};
</script></body></html>`;
}
