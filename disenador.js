// Disenador de QR: arma el SVG a partir del diseno guardado en qr.codigos.diseno
const LOGO_OK = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+\/=]+$/;
const DEF = { fg: '#000000', bg: '#ffffff', transp: false, grad: false, c2: '#15a97c', radial: false, forma: 'cuadrado', borde: 'cuadrado', centro: 'cuadrado', cb: null, cc: null, marco: 'ninguno', mtexto: 'ESCANEAME', mcolor: '#000000', mfuente: 'sans', logo: null, preset: null, limpio: true, ecc: 'M' };
const OPC = { marco: ['ninguno', 'pildora', 'caja', 'cajaArriba', 'texto'], forma: ['cuadrado', 'redondeado', 'puntos', 'diamante', 'pequeno', 'lineas'], borde: ['cuadrado', 'redondeado', 'circulo', 'hojaA', 'hojaB'], centro: ['cuadrado', 'redondeado', 'circulo', 'diamante', 'cruz', 'estrella'] };
const FUENTES = { sans: ['Sans-Serif', 'system-ui, Arial, sans-serif'], serif: ['Serif', 'Georgia, serif'], mono: ['Monoespaciada', 'ui-monospace, Courier New, monospace'], impact: ['Impact', "Impact, 'Arial Black', sans-serif"] };
const ico = (bg, g) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="' + bg + '"/>' + g + '</svg>');
const PRESETS = {
  enlace: ico('#7c3aed', '<g fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"><path d="M27 37a9 9 0 0 0 13 0l7-7a9 9 0 0 0-13-13l-3 3"/><path d="M37 27a9 9 0 0 0-13 0l-7 7a9 9 0 0 0 13 13l3-3"/></g>'),
  ubicacion: ico('#dc2626', '<path fill="#fff" d="M32 12a14 14 0 0 0-14 14c0 10 14 26 14 26s14-16 14-26A14 14 0 0 0 32 12zm0 19a5 5 0 1 1 0-10 5 5 0 0 1 0 10z"/>'),
  correo: ico('#f59e0b', '<g fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round"><rect x="14" y="20" width="36" height="24" rx="3"/><path d="M14 23l18 14 18-14"/></g>'),
  wifi: ico('#0ea5e9', '<g fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"><path d="M14 27a26 26 0 0 1 36 0"/><path d="M20 34a17 17 0 0 1 24 0"/><path d="M26 41a8 8 0 0 1 12 0"/></g><circle cx="32" cy="47" r="3.5" fill="#fff"/>'),
  tarjeta: ico('#0369a1', '<rect x="12" y="18" width="40" height="28" rx="4" fill="#fff"/><circle cx="26" cy="29" r="5" fill="#0369a1"/><path d="M18 42c1-6 14-6 16 0z" fill="#0369a1"/><rect x="38" y="27" width="10" height="3" fill="#0369a1"/><rect x="38" y="34" width="10" height="3" fill="#0369a1"/>'),
  menu: ico('#16a34a', '<g fill="#fff"><rect x="19" y="14" width="4" height="36" rx="2"/><path d="M43 14c-4 0-6 6-6 12 0 3 2 4 4 4v20h4V14z"/></g>')
};
const svgUrl = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
const f2 = n => Math.round(n * 100) / 100;
// rectangulo con radios por esquina: arriba-izq, arriba-der, abajo-der, abajo-izq
function rr(x, y, w, h, a, b, c, d) {
  const A = (r, px, py) => r ? 'A' + r + ',' + r + ' 0 0 1 ' + f2(px) + ',' + f2(py) : '';
  return 'M' + f2(x + a) + ',' + f2(y) + 'H' + f2(x + w - b) + A(b, x + w, y + b) + 'V' + f2(y + h - c) + A(c, x + w - c, y + h) +
    'H' + f2(x + d) + A(d, x, y + h - d) + 'V' + f2(y + a) + A(a, x + a, y) + 'Z';
}
const circ = (cx, cy, r) => 'M' + f2(cx - r) + ',' + f2(cy) + 'a' + r + ',' + r + ' 0 1,0 ' + f2(2 * r) + ',0a' + r + ',' + r + ' 0 1,0 ' + f2(-2 * r) + ',0Z';
const estrella = (cx, cy, R, r) => { let d = ''; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r : R; d += (i ? 'L' : 'M') + f2(cx + q * Math.cos(a)) + ',' + f2(cy + q * Math.sin(a)); } return d + 'Z'; };
const MOD = {
  cuadrado: (x, y) => 'M' + x + ',' + y + 'h1v1h-1z',
  redondeado: (x, y) => rr(x, y, 1, 1, .3, .3, .3, .3),
  puntos: (x, y) => circ(x + .5, y + .5, .45),
  diamante: (x, y) => 'M' + (x + .5) + ',' + y + 'L' + (x + 1) + ',' + (y + .5) + 'L' + (x + .5) + ',' + (y + 1) + 'L' + x + ',' + (y + .5) + 'Z',
  pequeno: (x, y) => 'M' + (x + .12) + ',' + (y + .12) + 'h.76v.76h-.76z'
};
const BORDE = { cuadrado: [[0, 0, 0, 0], [0, 0, 0, 0]], redondeado: [[2, 2, 2, 2], [1, 1, 1, 1]], circulo: [[3.5, 3.5, 3.5, 3.5], [2.5, 2.5, 2.5, 2.5]], hojaA: [[3.5, 0, 3.5, 0], [2.5, 0, 2.5, 0]], hojaB: [[0, 3.5, 0, 3.5], [0, 2.5, 0, 2.5]] };
const CENTRO = {
  cuadrado: (x, y) => rr(x, y, 3, 3, 0, 0, 0, 0),
  redondeado: (x, y) => rr(x, y, 3, 3, .8, .8, .8, .8),
  circulo: (x, y) => circ(x + 1.5, y + 1.5, 1.5),
  diamante: (x, y) => 'M' + (x + 1.5) + ',' + (y - .2) + 'L' + (x + 3.2) + ',' + (y + 1.5) + 'L' + (x + 1.5) + ',' + (y + 3.2) + 'L' + (x - .2) + ',' + (y + 1.5) + 'Z',
  cruz: (x, y) => 'M' + (x + .6) + ',' + y + 'H' + (x + 2.4) + 'V' + (y + .6) + 'H' + (x + 3) + 'V' + (y + 2.4) + 'H' + (x + 2.4) + 'V' + (y + 3) + 'H' + (x + .6) + 'V' + (y + 2.4) + 'H' + x + 'V' + (y + .6) + 'H' + (x + .6) + 'Z',
  estrella: (x, y) => estrella(x + 1.5, y + 1.5, 1.9, 1.1)
};
const hx = (v, def) => /^#[0-9a-f]{6}$/i.test(v || '') ? v : def;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function qrDiseno(text, o) {
  const d = Object.assign({}, DEF, o);
  const fg = hx(d.fg, '#000000'), bg = hx(d.bg, '#ffffff'), c2 = hx(d.c2, '#15a97c'), mc = hx(d.mcolor, '#000000');
  const logo = d.preset && PRESETS[d.preset] ? PRESETS[d.preset] : (LOGO_OK.test(d.logo || '') ? d.logo : null);
  const q = qrcode(0, logo ? 'H' : (['L', 'M', 'Q', 'H'].includes(d.ecc) ? d.ecc : 'M'));
  q.addData(text); q.make();
  const n = q.getModuleCount(), m = 4, s = n + 2 * m;
  const L = logo ? Math.round(n * 0.2) : 0, a = (n - L) / 2;
  const enLogo = (r, c) => logo && d.limpio && r >= a - 1 && r < a + L + 1 && c >= a - 1 && c < a + L + 1;
  const ojo = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  const osc = (r, c) => c < n && q.isDark(r, c) && !ojo(r, c) && !enLogo(r, c);
  let b = '';
  for (let r = 0; r < n; r++) {
    if (d.forma === 'lineas') {
      let c = 0;
      while (c < n) { if (!osc(r, c)) { c++; continue; } let e = c; while (e < n && osc(r, e)) e++; b += rr(c + m, r + m + .1, e - c, .8, .4, .4, .4, .4); c = e; }
      continue;
    }
    const fm = MOD[d.forma] || MOD.cuadrado;
    for (let c = 0; c < n; c++) if (osc(r, c)) b += fm(c + m, r + m);
  }
  const fill = d.grad ? 'url(#g)' : fg;
  const defs = !d.grad ? '' : d.radial
    ? '<radialGradient id="g" gradientUnits="userSpaceOnUse" cx="' + (m + n / 2) + '" cy="' + (m + n / 2) + '" r="' + (n / 1.6) + '"><stop offset="0" stop-color="' + fg + '"/><stop offset="1" stop-color="' + c2 + '"/></radialGradient>'
    : '<linearGradient id="g" gradientUnits="userSpaceOnUse" x1="' + m + '" y1="' + m + '" x2="' + (m + n) + '" y2="' + (m + n) + '"><stop offset="0" stop-color="' + fg + '"/><stop offset="1" stop-color="' + c2 + '"/></linearGradient>';
  const cb = d.cb ? hx(d.cb, fg) : fill, cc = d.cc ? hx(d.cc, fg) : fill;
  const bo = BORDE[d.borde] || BORDE.cuadrado, ce = CENTRO[d.centro] || CENTRO.cuadrado;
  let rb = '', rc = '';
  for (const [ex, ey] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
    const x = ex + m, y = ey + m;
    rb += rr(x, y, 7, 7, ...bo[0]) + rr(x + 1, y + 1, 5, 5, ...bo[1]);
    rc += ce(x + 2, y + 2);
  }
  const lg = logo ? '<image x="' + (a + m) + '" y="' + (a + m) + '" width="' + L + '" height="' + L + '" href="' + logo + '"/>' : '';
  const caja = d.marco === 'caja' || d.marco === 'cajaArriba';
  const fondo = (d.transp && !caja) ? '' : '<rect width="' + s + '" height="' + s + '" fill="' + bg + '"/>';
  const qr = fondo + '<path d="' + b + '" fill="' + fill + '"/><path d="' + rb + '" fill="' + cb + '" fill-rule="evenodd"/><path d="' + rc + '" fill="' + cc + '"/>' + lg;
  // marco con frase
  const txt = esc(String(d.mtexto || '').slice(0, 20)), fam = (FUENTES[d.mfuente] || FUENTES.sans)[1];
  const claro = lum(mc) > 0.5, tc = claro ? '#000000' : '#ffffff';
  const fs = Math.min(4.2, (s - 4) / (Math.max(txt.length, 1) * 0.66));
  const T = (cx, cy, col) => '<text x="' + cx + '" y="' + cy + '" font-size="' + f2(fs) + '" font-weight="700" text-anchor="middle" dominant-baseline="central" fill="' + col + '" font-family="' + esc(fam) + '">' + txt + '</text>';
  let W = s, H = s, cuerpo = '<g>' + qr + '</g>';
  if (d.marco === 'pildora') { H = s + 9; cuerpo += '<rect x="' + f2(s * .12) + '" y="' + (s + 1) + '" width="' + f2(s * .76) + '" height="6.5" rx="3.25" fill="' + mc + '"/>' + T(s / 2, s + 4.3, tc); }
  else if (d.marco === 'texto') { H = s + 7; cuerpo += T(s / 2, s + 3.6, mc); }
  else if (caja) {
    W = s + 6; H = s + 6 + 9; const top = d.marco === 'cajaArriba';
    cuerpo = '<rect width="' + W + '" height="' + H + '" rx="5" fill="' + mc + '"/><g transform="translate(3,' + (top ? 12 : 3) + ')">' + qr + '</g>' + T(W / 2, top ? 6.2 : s + 6 + 4.8, tc);
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W * 10 + '" height="' + H * 10 + '"><defs>' + defs + '</defs>' + cuerpo + '</svg>';
}
function mini(D, campo, key) {
  const t = Object.assign({}, D, { [campo]: key, logo: null, preset: null });
  if (campo !== 'marco') t.marco = 'ninguno';
  return svgUrl(qrDiseno('qr', t));
}
