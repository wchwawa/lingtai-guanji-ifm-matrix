// Generative painterly dawn-sakura hero scene -> assets/hero-dawn.svg
// Deterministic (seeded LCG) so每次生成可复现、可微调。
import { writeFileSync } from 'node:fs';

const W = 1440, H = 810;
let seed = 20260703;
function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
function rr(a, b) { return a + (b - a) * rnd(); }
function gauss(a, b) { return a + (b - a) * (rnd() + rnd()) / 2; }
function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }
const f1 = (n) => Math.round(n * 10) / 10;

/* ── palette ── */
const SKY = { top: '#8E96C2', mid1: '#A8A5CE', mid2: '#CEB3CC', mid3: '#EFC5A9', horizon: '#F8DDA9' };
const PETALS_MID = ['#EFB3C8', '#E89FB8', '#F2BFD0', '#E794B0', '#EBA9BE'];
const PETALS_TOP = ['#F9DCE6', '#FBE7ED', '#F6CBD8', '#FDF0F3'];
const PETALS_DEEP = ['#D98BA6', '#D07E9C'];
const TRUNK = '#453648';

let out = [];
out.push(`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">`);

/* ── defs ── */
out.push(`<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="${SKY.top}"/>
  <stop offset=".32" stop-color="${SKY.mid1}"/>
  <stop offset=".55" stop-color="${SKY.mid2}"/>
  <stop offset=".68" stop-color="${SKY.mid3}"/>
  <stop offset=".74" stop-color="${SKY.horizon}"/>
</linearGradient>
<linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#F8DDA9"/>
  <stop offset=".14" stop-color="#F2CFA7"/>
  <stop offset=".42" stop-color="#DCB4AF"/>
  <stop offset=".72" stop-color="#B9A2C0"/>
  <stop offset="1" stop-color="#9D93BC"/>
</linearGradient>
<radialGradient id="sunGlow" cx=".5" cy=".5" r=".5">
  <stop offset="0" stop-color="#FFF6DC" stop-opacity=".95"/>
  <stop offset=".25" stop-color="#FBE3AE" stop-opacity=".75"/>
  <stop offset=".6" stop-color="#F6C98F" stop-opacity=".32"/>
  <stop offset="1" stop-color="#F6C98F" stop-opacity="0"/>
</radialGradient>
<radialGradient id="dawnWash" cx=".5" cy=".5" r=".5">
  <stop offset="0" stop-color="#F9D9A8" stop-opacity=".5"/>
  <stop offset="1" stop-color="#F9D9A8" stop-opacity="0"/>
</radialGradient>
<mask id="crescent">
  <circle cx="640" cy="200" r="38" fill="#fff"/>
  <circle cx="654" cy="190" r="34" fill="#000"/>
</mask>
<radialGradient id="moonHalo" cx=".5" cy=".5" r=".5">
  <stop offset="0" stop-color="#FFFFFF" stop-opacity=".85"/>
  <stop offset=".35" stop-color="#F5F1FF" stop-opacity=".28"/>
  <stop offset="1" stop-color="#F5F1FF" stop-opacity="0"/>
</radialGradient>
<filter id="b2"><feGaussianBlur stdDeviation="2"/></filter>
<filter id="b4"><feGaussianBlur stdDeviation="4"/></filter>
<filter id="b8"><feGaussianBlur stdDeviation="8"/></filter>
<filter id="b14"><feGaussianBlur stdDeviation="14"/></filter>
<filter id="b22"><feGaussianBlur stdDeviation="22"/></filter>
<filter id="cloudy" x="-30%" y="-30%" width="160%" height="160%">
  <feTurbulence type="fractalNoise" baseFrequency="0.012 0.028" numOctaves="3" seed="7" result="n"/>
  <feDisplacementMap in="SourceGraphic" in2="n" scale="46"/>
  <feGaussianBlur stdDeviation="5"/>
</filter>
<filter id="cloudy2" x="-30%" y="-30%" width="160%" height="160%">
  <feTurbulence type="fractalNoise" baseFrequency="0.02 0.05" numOctaves="3" seed="21" result="n"/>
  <feDisplacementMap in="SourceGraphic" in2="n" scale="34"/>
  <feGaussianBlur stdDeviation="3.2"/>
</filter>
</defs>`);

/* ── sky ── */
out.push(`<rect width="${W}" height="600" fill="url(#sky)"/>`);

/* stars */
out.push('<g fill="#FFFFFF">');
for (let i = 0; i < 26; i++) {
  out.push(`<circle cx="${f1(rr(30, W - 30))}" cy="${f1(rr(20, 240))}" r="${f1(rr(0.7, 1.7))}" opacity="${f1(rr(0.15, 0.5))}"/>`);
}
out.push('</g>');

/* moon: crescent embracing old moon */
out.push(`<circle cx="640" cy="200" r="104" fill="url(#moonHalo)" opacity=".5"/>`);
out.push(`<g>
<circle cx="640" cy="200" r="35" fill="#EDE9F7" opacity=".22"/>
<circle cx="640" cy="200" r="38" fill="#FEFDFB" opacity=".97" mask="url(#crescent)"/>
</g>`);

/* clouds: painterly banks (turbulence-displaced blurred blobs) */
function cloudBank(cx, cy, w, h, tint, hi, op, filt) {
  const g = [`<g filter="url(#${filt})" opacity="${op}">`];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const px = cx + gauss(-w / 2, w / 2), py = cy + gauss(-h / 2, h / 2);
    const rw = rr(w * 0.16, w * 0.34), rh = rr(h * 0.22, h * 0.42);
    g.push(`<ellipse cx="${f1(px)}" cy="${f1(py)}" rx="${f1(rw)}" ry="${f1(rh)}" fill="${tint}"/>`);
    if (rnd() < 0.8) g.push(`<ellipse cx="${f1(px + rr(-20, 20))}" cy="${f1(py + rh * 0.45)}" rx="${f1(rw * 0.7)}" ry="${f1(rh * 0.5)}" fill="${hi}"/>`);
  }
  g.push('</g>');
  return g.join('');
}
out.push(cloudBank(1120, 130, 620, 90, '#B9AFDA', '#D9C9E4', 0.75, 'cloudy'));
out.push(cloudBank(1240, 215, 560, 76, '#CBB4D6', '#F1CFD9', 0.8, 'cloudy'));
out.push(cloudBank(180, 250, 460, 70, '#B4A9D6', '#DFC5DC', 0.6, 'cloudy'));
out.push(cloudBank(320, 385, 640, 62, '#D5B3CB', '#F6D3C4', 0.72, 'cloudy2'));
out.push(cloudBank(1030, 420, 700, 58, '#DDB6C4', '#F8D9C0', 0.78, 'cloudy2'));
out.push(cloudBank(660, 480, 900, 46, '#E7C0B8', '#FADFBE', 0.66, 'cloudy2'));

/* dawn wash above horizon */
out.push(`<ellipse cx="620" cy="565" rx="640" ry="190" fill="url(#dawnWash)"/>`);

/* water first: top color continues the sky horizon, seam is color-continuous */
out.push(`<rect y="592" width="${W}" height="${H - 592}" fill="url(#water)"/>`);

/* mountains AFTER water: blurred bases sink into haze instead of being razor-clipped */
out.push(`<g filter="url(#b8)"><path d="M-20 594 L90 546 L210 584 L330 552 L450 590 L560 566 L680 594 L790 570 L910 596 L1030 560 L1150 592 L1270 548 L1360 580 L1460 560 L1460 614 L-20 614 Z" fill="#A393BE" opacity=".42"/></g>`);
out.push(`<g filter="url(#b4)"><path d="M-20 608 L90 564 L200 598 L310 574 L420 606 L530 590 L640 608 L710 602 L710 620 L-20 620 Z" fill="#8B7BA8" opacity=".48"/>
<path d="M860 614 L980 574 L1090 604 L1200 566 L1310 598 L1400 574 L1460 590 L1460 620 L860 620 Z" fill="#8B7BA8" opacity=".52"/></g>`);

/* horizon haze: two soft bands melt sky, mountain bases and water together */
out.push(`<g filter="url(#b14)"><rect x="-30" y="574" width="${W + 60}" height="48" fill="#F9E2B4" opacity=".5"/></g>`);
out.push(`<g filter="url(#b8)"><rect x="-30" y="590" width="${W + 60}" height="24" fill="#FBE9C2" opacity=".42"/></g>`);

/* sun on horizon */
out.push(`<circle cx="618" cy="600" r="210" fill="url(#sunGlow)"/>`);
out.push(`<g filter="url(#b4)"><ellipse cx="618" cy="597" rx="30" ry="24" fill="#FFF9E8"/></g>`);
/* sun path on water: stacked glitter streaks */
out.push('<g>');
for (let i = 0; i < 26; i++) {
  const y = 606 + i * rr(6, 9);
  if (y > H - 8) break;
  const spread = 24 + (y - 606) * rr(0.5, 0.9);
  out.push(`<ellipse cx="${f1(618 + rr(-14, 14))}" cy="${f1(y)}" rx="${f1(spread * rr(0.5, 1))}" ry="${f1(rr(1.2, 2.6))}" fill="#FBE7BC" opacity="${f1(rr(0.2, 0.5))}" filter="url(#b2)"/>`);
}
out.push('</g>');
/* soft ripples elsewhere */
out.push('<g stroke="#F4E3D6" stroke-linecap="round" fill="none">');
for (let i = 0; i < 22; i++) {
  const y = rr(625, H - 20), x = rr(30, W - 120), len = rr(40, 160);
  out.push(`<path d="M${f1(x)} ${f1(y)} h${f1(len)}" stroke-width="${f1(rr(0.8, 1.8))}" opacity="${f1(rr(0.06, 0.2))}"/>`);
}
out.push('</g>');

/* ── tree island (right) ── */
out.push(`<g filter="url(#b8)"><ellipse cx="1085" cy="792" rx="240" ry="34" fill="#6B5B72" opacity=".5"/></g>`);
out.push(`<g filter="url(#b2)">
<path d="M905 810 Q1000 726 1090 738 Q1195 726 1290 810 Z" fill="#5C4E66"/>
<path d="M955 792 Q1060 738 1170 762 Q1240 776 1272 806 L955 810 Z" fill="#4E4159" opacity=".85"/>
<path d="M940 776 Q1030 730 1120 742 Q1200 748 1258 786" fill="none" stroke="#8B7893" stroke-width="6" opacity=".5"/>
</g>`);
/* grass blades */
out.push('<g stroke="#665B7A" stroke-linecap="round" fill="none" opacity=".65">');
for (let i = 0; i < 24; i++) {
  const x = rr(940, 1250), y = rr(752, 786);
  out.push(`<path d="M${f1(x)} ${f1(y)} q${f1(rr(-3, 3))} ${f1(-rr(5, 10))} ${f1(rr(-5, 5))} ${f1(-rr(8, 15))}" stroke-width="${f1(rr(1, 2))}"/>`);
}
out.push('</g>');

/* canopy reflection hint in water */
out.push(`<g filter="url(#b14)" opacity=".16"><ellipse cx="1080" cy="770" rx="250" ry="26" fill="#DE9FB4"/></g>`);

/* ── trunk & branches (tapered strokes, bark two-tone) ── */
const branches = [
  ['M1078 762 C1064 690 1050 620 1030 558 C1012 502 1000 462 1002 424', 22],
  ['M1006 470 C962 440 908 402 862 374 C838 360 820 348 806 340', 10],
  ['M862 374 C842 356 826 346 812 342', 5],
  ['M1002 432 C980 396 956 362 932 334', 8],
  ['M932 334 C918 318 908 308 898 300', 4.5],
  ['M1016 520 C1070 482 1128 444 1178 418 C1216 398 1250 380 1276 366', 11],
  ['M1276 366 C1298 354 1314 346 1326 342', 5.5],
  ['M1004 428 C1030 386 1064 342 1094 308 C1108 292 1122 276 1134 264', 8],
  ['M1134 264 C1146 250 1156 240 1164 232', 4],
  ['M1002 424 C996 390 992 352 996 318 C998 300 1002 284 1008 270', 7],
  ['M1008 270 C1012 256 1018 244 1024 234', 3.5],
  ['M1030 558 C1076 536 1120 522 1160 516', 6],
  ['M1050 620 C1010 600 974 588 942 582', 5],
];
out.push('<g fill="none" stroke-linecap="round">');
for (const [d, w] of branches) {
  out.push(`<path d="${d}" stroke="${TRUNK}" stroke-width="${w}"/>`);
  out.push(`<path d="${d}" stroke="#5E4B60" stroke-width="${f1(w * 0.4)}" opacity=".55" transform="translate(-1.5,-1)"/>`);
}
out.push('</g>');

/* ── canopy: 3 layers ── */
const clusters = [
  [806, 336, 104, 68], [920, 296, 108, 70], [1010, 248, 116, 74], [1124, 230, 124, 76],
  [1230, 286, 112, 72], [1322, 348, 94, 62], [878, 380, 82, 52], [1160, 328, 100, 64],
  [1044, 326, 96, 60], [950, 354, 78, 50], [1272, 418, 74, 48], [1184, 506, 74, 46],
  [868, 328, 76, 48], [978, 298, 82, 52], [1078, 264, 86, 54], [1180, 262, 84, 52],
  [1282, 330, 78, 50], [1026, 226, 78, 48], [940, 574, 58, 36], [1096, 300, 80, 50],
  [1006, 388, 66, 42], [1120, 398, 62, 40],
];
/* layer 0: blurred mass */
out.push('<g filter="url(#b14)">');
for (const [cx, cy, rx, ry] of clusters) {
  out.push(`<ellipse cx="${cx}" cy="${cy}" rx="${f1(rx * 0.96)}" ry="${f1(ry * 0.96)}" fill="#E2A2BA" opacity=".92"/>`);
}
out.push('</g>');
/* layer 0.5: inner volume */
out.push('<g filter="url(#b8)">');
for (const [cx, cy, rx, ry] of clusters) {
  out.push(`<ellipse cx="${cx}" cy="${f1(cy - ry * 0.12)}" rx="${f1(rx * 0.8)}" ry="${f1(ry * 0.8)}" fill="#ECB0C4" opacity=".85"/>`);
}
out.push('</g>');
/* layer 1: mid petals */
out.push('<g filter="url(#b2)">');
for (const [cx, cy, rx, ry] of clusters) {
  const n = Math.round((rx * ry) / 150);
  for (let i = 0; i < n; i++) {
    const px = gauss(cx - rx, cx + rx), py = gauss(cy - ry, cy + ry);
    const lit = py < cy;
    const col = lit && rnd() < 0.45 ? pick(PETALS_TOP) : rnd() < 0.16 ? pick(PETALS_DEEP) : pick(PETALS_MID);
    out.push(`<circle cx="${f1(px)}" cy="${f1(py)}" r="${f1(rr(5, 13))}" fill="${col}" opacity="${f1(rr(0.55, 0.95))}"/>`);
  }
}
out.push('</g>');
/* layer 2: crisp sparkle petals */
out.push('<g>');
for (const [cx, cy, rx, ry] of clusters) {
  const n = Math.round((rx * ry) / 330);
  for (let i = 0; i < n; i++) {
    const px = gauss(cx - rx, cx + rx), py = gauss(cy - ry * 1.1, cy + ry * 0.7);
    out.push(`<circle cx="${f1(px)}" cy="${f1(py)}" r="${f1(rr(2.2, 5.5))}" fill="${pick(PETALS_TOP)}" opacity="${f1(rr(0.7, 1))}"/>`);
  }
}
out.push('</g>');

/* drifting petals to the left */
out.push('<g>');
for (let i = 0; i < 14; i++) {
  const x = rr(420, 990), y = rr(230, 470), s = rr(0.7, 1.4), rot = rr(0, 360);
  out.push(`<path d="M0 0 C3.4 -2.2 5.6 0 4.4 3.2 C2.4 5.6 -1 4.4 -1.1 1.2 Z" fill="${pick(PETALS_MID)}" opacity="${f1(rr(0.5, 0.95))}" transform="translate(${f1(x)},${f1(y)}) scale(${f1(s * 2.6)}) rotate(${f1(rot)})"/>`);
}
out.push('</g>');

/* foreground bokeh blossoms bottom corners */
function bokeh(cx, cy, spanX, spanY, n, blur, baseR, op) {
  const g = [`<g filter="url(#${blur})" opacity="${op}">`];
  for (let i = 0; i < n; i++) {
    g.push(`<circle cx="${f1(gauss(cx - spanX, cx + spanX))}" cy="${f1(gauss(cy - spanY, cy + spanY))}" r="${f1(rr(baseR * 0.5, baseR * 1.5))}" fill="${pick([...PETALS_MID, ...PETALS_TOP])}"/>`);
  }
  g.push('</g>');
  return g.join('');
}
out.push(bokeh(985, 738, 95, 26, 12, 'b8', 15, 0.85));
out.push(bokeh(1205, 748, 105, 28, 12, 'b8', 15, 0.8));
out.push(bokeh(120, 790, 280, 74, 30, 'b22', 28, 0.85));
out.push(bokeh(1360, 800, 220, 60, 20, 'b22', 24, 0.7));
out.push(bokeh(60, 730, 160, 50, 12, 'b14', 14, 0.5));

/* gentle vignette top corners to seat the text */
out.push(`<rect width="${W}" height="220" fill="url(#sky)" opacity="0"/>`);

out.push('</svg>');

const outputUrl = new URL('../assets/hero-dawn.svg', import.meta.url);
writeFileSync(outputUrl, out.join('\n'));
console.log('written assets/hero-dawn.svg', (out.join('\n').length / 1024).toFixed(1) + 'KB');
