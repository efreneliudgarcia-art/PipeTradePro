// Units, kinds and conversions. Every quantity is stored in a base unit per kind:
// len: inch, area: in^2, vol: in^3, flow: gpm, vel: ft/s, press: psi, force: lbf,
// mass: lb, temp: deg F, angle: degrees, wpl: lb/ft, wpv: lb/ft^3, money: $, num: plain.

export const GAL_PER_FT3 = 1728 / 231;          // 7.480519...
export const L_PER_FT3 = 28.316846592;
export const WATER_LB_FT3 = 62.42796;            // 1000 kg/m^3
export const WATER_NU_FT2S = 1e-6 / (0.3048 * 0.3048); // 1 cSt
export const G_FT_S2 = 32.174;

// factor = how many base units in one of this unit
export const UNITS = {
  // length (base inch). 'ftin' and 'in' show fractions; 'ft' and 'indec' show decimals.
  ftin: { kind: 'len', f: 12, label: 'feet-inch', family: 'ft', frac: true },
  ft: { kind: 'len', f: 12, label: 'feet', family: 'ft', frac: false },
  in: { kind: 'len', f: 1, label: 'inch', family: 'in', frac: true },
  indec: { kind: 'len', f: 1, label: 'inch', family: 'in', frac: false },
  mm: { kind: 'len', f: 1 / 25.4, label: 'mm', family: 'mm' },
  m: { kind: 'len', f: 1000 / 25.4, label: 'meter', family: 'm' },
  // area (base in^2)
  in2: { kind: 'area', f: 1, label: 'sq inch', family: 'in' },
  ft2: { kind: 'area', f: 144, label: 'sq feet', family: 'ft' },
  mm2: { kind: 'area', f: 1 / 645.16, label: 'sq mm', family: 'mm' },
  m2: { kind: 'area', f: 1e6 / 645.16, label: 'sq meter', family: 'm' },
  // volume (base in^3)
  in3: { kind: 'vol', f: 1, label: 'cu inch', family: 'in' },
  ft3: { kind: 'vol', f: 1728, label: 'cu feet', family: 'ft' },
  mm3: { kind: 'vol', f: 1 / 16387.064, label: 'cu mm', family: 'mm' },
  m3: { kind: 'vol', f: 1e9 / 16387.064, label: 'cu meter', family: 'm' },
  gal: { kind: 'vol', f: 231, label: 'gallons' },
  L: { kind: 'vol', f: 1e6 / 16387.064 / 1000, label: 'liters' },
  // flow (base gpm)
  gpm: { kind: 'flow', f: 1, label: 'gpm', long: 'Gallons per Minute' },
  cfm: { kind: 'flow', f: GAL_PER_FT3, label: 'cfm', long: 'Cubic Feet per Minute' },
  cfs: { kind: 'flow', f: GAL_PER_FT3 * 60, label: 'cfs', long: 'Cubic Feet per Second' },
  lps: { kind: 'flow', f: GAL_PER_FT3 * 60 / L_PER_FT3, label: 'L/s', long: 'Liters per Second' },
  m3s: { kind: 'flow', f: GAL_PER_FT3 * 60 / (L_PER_FT3 / 1000), label: 'm³/s', long: 'Cubic Meters per Second' },
  // velocity (base ft/s)
  fps: { kind: 'vel', f: 1, label: 'ft/s', long: 'Feet per Second' },
  fpm: { kind: 'vel', f: 1 / 60, label: 'ft/min', long: 'Feet per Minute' },
  mps: { kind: 'vel', f: 1 / 0.3048, label: 'm/s', long: 'Meters per Second' },
  // pressure (base psi)
  psi: { kind: 'press', f: 1, label: 'psi', long: 'Pounds per Square Inch' },
  psf: { kind: 'press', f: 1 / 144, label: 'psf', long: 'Pounds per Square Foot' },
  inHg: { kind: 'press', f: 1 / 2.0360206, label: 'in Hg', long: 'Inches of Mercury' },
  ftHd: { kind: 'press', f: WATER_LB_FT3 / 144, label: 'ft head', long: 'Feet of Head' },
  bar: { kind: 'press', f: 1 / 0.0689475729, label: 'bar', long: 'Bar' },
  kPa: { kind: 'press', f: 1 / 6.89475729, label: 'kPa', long: 'Kilopascals' },
  // others
  lbf: { kind: 'force', f: 1, label: 'lbf', long: 'Pound-Force' },
  lb: { kind: 'mass', f: 1, label: 'lb', long: 'Pounds' },
  kg: { kind: 'mass', f: 2.2046226218, label: 'kg', long: 'Kilograms' },
  degF: { kind: 'temp', label: '°F', long: 'Degrees Fahrenheit' },
  degC: { kind: 'temp', label: '°C', long: 'Degrees Celsius' },
  deg: { kind: 'angle', f: 1, label: '°' },
  dms: { kind: 'angle', f: 1, label: 'D:M:S' },
  lbft: { kind: 'wpl', f: 1, label: 'lb/ft', long: 'Pounds per Foot' },
  lbft3: { kind: 'wpv', f: 1, label: 'lb/ft³', long: 'Pounds per Cubic Foot' },
  kgm3: { kind: 'wpv', f: WATER_LB_FT3 / 1000, label: 'kg/m³', long: 'Kilograms per Cubic Meter' },
  lbgal: { kind: 'wpv', f: GAL_PER_FT3, label: 'lb/gal', long: 'Pounds per Gallon' },
  usd: { kind: 'money', f: 1, label: '$' },
  num: { kind: 'num', f: 1, label: '' },
  re: { kind: 'num', f: 1, label: '' },
};

export const BASE_UNIT = { len: 'in', area: 'in2', vol: 'in3', flow: 'gpm', vel: 'fps', press: 'psi', force: 'lbf', mass: 'lb', temp: 'degF', angle: 'deg', wpl: 'lbft', wpv: 'lbft3', money: 'usd', num: 'num' };

export function q(v, unit) { // value given in `unit`
  const u = UNITS[unit];
  if (u.kind === 'temp') return { v: unit === 'degC' ? v * 9 / 5 + 32 : v, unit };
  return { v: v * u.f, unit };
}
export function kindOf(x) { return UNITS[x.unit].kind; }
export function inUnit(x, unit) { // numeric value of quantity x expressed in `unit`
  const u = UNITS[unit];
  if (u.kind === 'temp') return unit === 'degC' ? (x.v - 32) * 5 / 9 : x.v;
  return x.v / u.f;
}
export function convert(x, unit) { return { v: x.v, unit }; }
export const isLen = x => kindOf(x) === 'len';
export const ftFamily = u => UNITS[u] && UNITS[u].family === 'ft';
export const metricFamily = u => UNITS[u] && (UNITS[u].family === 'mm' || UNITS[u].family === 'm');

// Which family a pair of length-like operands should be shown in.
export function familyOf(unit) { return UNITS[unit] ? UNITS[unit].family : undefined; }
export function mergeFamily(a, b) {
  const fa = familyOf(a), fb = familyOf(b);
  if (fa === 'ft' || fb === 'ft') return 'ft';
  if (fa === 'in' || fb === 'in') return 'in';
  if (fa === 'm' || fb === 'm') return 'm';
  if (fa === 'mm' || fb === 'mm') return 'mm';
  return fa || fb || 'in';
}
export function unitFor(kind, family, preferFrac = true) {
  if (kind === 'len') return family === 'ft' ? (preferFrac ? 'ftin' : 'ft') : family === 'in' ? (preferFrac ? 'in' : 'indec') : family;
  if (kind === 'area') return { ft: 'ft2', in: 'in2', mm: 'mm2', m: 'm2' }[family] || 'in2';
  if (kind === 'vol') return { ft: 'ft3', in: 'in3', mm: 'mm3', m: 'm3' }[family] || 'in3';
  return BASE_UNIT[kind];
}
