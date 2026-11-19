// Display formatting: 7-digit decimals, fractions, feet-inch, angles, D:M:S.
import { UNITS, inUnit, kindOf } from './units.js';

const gcd = (a, b) => (b ? gcd(b, a % b) : a);

// Up to 7 digits in total (integer digits + decimals), trailing zeros dropped,
// whole numbers end with a dot like a calculator ("50.").
export function fmtNum(x, opt = {}) {
  if (!isFinite(x)) return 'Error';
  if (Object.is(x, -0) || Math.abs(x) < 1e-12) x = 0;
  const neg = x < 0; let a = Math.abs(x);
  const maxDigits = opt.digits || 7;
  if (opt.fixed != null) {
    let s = a.toFixed(opt.fixed);
    return (neg && Number(s) !== 0 ? '-' : '') + s;
  }
  if (a !== 0 && (a >= 1e11 || a < 1e-6)) {
    const e = a.toExponential(maxDigits - 1).replace(/\.?0+e/, 'e').replace('e+', 'E').replace('e-', 'E-');
    return (neg ? '-' : '') + e;
  }
  const intDigits = a < 1 ? 1 : Math.floor(Math.log10(a)) + 1;
  const dec = Math.max(0, maxDigits - intDigits);
  let s = a.toFixed(dec);
  if (s.includes('.')) s = s.replace(/0+$/, '');
  if (!s.includes('.')) s += '.';
  if (opt.noDot && s.endsWith('.')) s = s.slice(0, -1);
  return (neg && Number(s.replace(/\.$/, '')) !== 0 ? '-' : '') + s;
}

// inches -> {whole, n, d} rounded to resolution `res` (denominator).
export function toFrac(inches, res = 16, mode = 'standard') {
  const neg = inches < 0; const a = Math.abs(inches);
  let units = Math.round(a * res);
  let whole = Math.floor(units / res); let n = units % res; let d = res;
  if (n && mode !== 'constant') { const g = gcd(n, d); n /= g; d /= g; }
  return { neg: neg && units !== 0, whole, n, d };
}
export function fracText(f) { return f.n ? `${f.n}/${f.d}` : ''; }

// fractional inches: 33 15/16"   (under one inch: 0 3/32")
export function fmtInches(inches, res, mode, mark = '"') {
  const f = toFrac(inches, res, mode);
  const s = `${f.whole}${f.n ? ' ' + fracText(f) : ''}`;
  return (f.neg ? '-' : '') + s + mark;
}
// feet-inch-fraction: 15' 9 1/2"
export function fmtFtIn(inches, res, mode) {
  const neg = inches < 0; const a = Math.abs(inches);
  const units = Math.round(a * res);
  let ft = Math.floor(units / (12 * res));
  const remUnits = units - ft * 12 * res;
  const f = toFrac(remUnits / res, res, mode);
  return (neg && units ? '-' : '') + `${ft}' ${f.whole}${f.n ? ' ' + fracText(f) : ''}"`;
}
// D:M:S from decimal degrees: 44°17'24"
export function toDMS(deg) {
  const neg = deg < 0; let s = Math.round(Math.abs(deg) * 3600);
  const d = Math.floor(s / 3600); s -= d * 3600; const m = Math.floor(s / 60); s -= m * 60;
  return { neg, d, m, s };
}
export function fmtDMS(deg) {
  const x = toDMS(deg); const p = n => String(n).padStart(2, '0');
  return `${x.neg ? '-' : ''}${x.d}°${p(x.m)}'${p(x.s)}"`;
}

// Quantity -> { main, unit } for the display
export function formatQ(x, prefs, res) {
  const u = UNITS[x.unit]; const kind = kindOf(x); const mode = prefs.fracMode;
  switch (x.unit) {
    case 'ftin': return { main: fmtFtIn(x.v, res, mode), unit: 'feet-inch' };
    case 'in': return { main: fmtInches(x.v, res, mode), unit: 'inch' };
    case 'ft': return { main: fmtNum(x.v / 12) + '', unit: 'feet' };
    case 'indec': return { main: fmtNum(x.v), unit: 'inch' };
    case 'm': return { main: prefs.meters === 'float' ? fmtNum(inUnit(x, 'm')) : fmtNum(inUnit(x, 'm'), { fixed: 3 }), unit: 'meter' };
    case 'deg': return { main: (prefs.degrees === 'float' ? fmtNum(x.v, { noDot: true }) : x.v.toFixed(2)) + '°', unit: '' };
    case 'dms': return { main: fmtDMS(x.v), unit: 'D:M:S' };
    case 'usd': return { main: '$' + (Math.round(x.v * 100) / 100).toFixed(2), unit: '' };
    case 'num': return { main: fmtNum(x.v), unit: '' };
    case 're': return { main: fmtNum(x.v), unit: '' };
    default: return { main: fmtNum(inUnit(x, x.unit)), unit: u.label };
  }
}
