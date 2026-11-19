// Pipe lookups, weights, elbow take-outs and flow math.
import { MATERIALS, ELBOWS } from './pipedata.js';
import { WATER_LB_FT3, WATER_NU_FT2S, G_FT_S2 } from './units.js';

export { MATERIALS };
export const ELBOW_TYPES = ['Butt Weld - Long', 'Butt Weld - Short', 'Field Cut - Long', 'Field Cut - Short'];
export const DEFAULT_MATERIAL = 0; // Steel

export function material(i) { return MATERIALS[i]; }
export function typeIndex(matIdx, typeId) { return Math.max(0, MATERIALS[matIdx].types.findIndex(t => t.id === typeId)); }
export function defaultTypeIndex(matIdx) { return typeIndex(matIdx, MATERIALS[matIdx].defaultType); }
export function pipeType(matIdx, typeIdx) { return MATERIALS[matIdx].types[typeIdx]; }

const near = (a, b) => Math.abs(a - b) < 1e-6;
export function findSize(matIdx, typeIdx, nominal) {
  const t = pipeType(matIdx, typeIdx);
  return t.sizes.find(s => near(s[0], nominal)) || null;
}

// Everything the Pipe Size key can show, for the current material/type/size.
export function pipeData(matIdx, typeIdx, nominal, wtvolLbFt3 = WATER_LB_FT3) {
  const s = findSize(matIdx, typeIdx, nominal);
  if (!s) return null;
  const m = MATERIALS[matIdx];
  const [, od, wall] = s; const id = od - 2 * wall;
  const area = Math.PI / 4 * id * id;                       // in^2
  const weight = Math.PI * (od - wall) * wall * 12 * m.density; // lb/ft
  const fluid = area / 144 * wtvolLbFt3;                     // lb/ft of contents
  return { nominal, od, wall, id, area, weight, filled: weight + fluid, material: m.label, type: pipeType(matIdx, typeIdx).label, roughFt: m.roughFt };
}

// Steel OD for a nominal size (take-outs and arcs are based on carbon steel OD).
export function steelOD(nominal) {
  const s = MATERIALS[0].types.find(t => t.id === 'STD').sizes.find(x => near(x[0], nominal))
    || MATERIALS[0].types.flatMap(t => t.sizes).find(x => near(x[0], nominal));
  return s ? s[1] : null;
}

// Elbow centerline radius (= 90 deg center-to-end) for an elbow type.
export function elbowRadius(nominal, elbowType) {
  const long = elbowType === 0 || elbowType === 2;
  if (long) { const a = ELBOWS.lr90[String(nominal)]; return a != null ? a : 1.5 * nominal; }
  return nominal; // short radius = 1.0 x NPS
}

// Take-out (center to end) for a fitting angle in degrees.
export function takeOut(nominal, elbowType, angleDeg) {
  const r = elbowRadius(nominal, elbowType);
  const factory = elbowType === 0 || elbowType === 1; // butt weld (factory fittings at 45/90)
  if (factory && Math.abs(angleDeg - 90) < 0.005) return r;
  if (elbowType === 0 && Math.abs(angleDeg - 45) < 0.005) {
    const b = ELBOWS.lr45[String(nominal)]; if (b != null) return b;
  }
  return r * Math.tan(angleDeg * Math.PI / 360);
}

export function arcs(nominal, elbowType, angleDeg, odOverride) {
  const r = elbowRadius(nominal, elbowType);
  const od = odOverride || steelOD(nominal) || nominal;
  const th = angleDeg * Math.PI / 180;
  return { inside: (r - od / 2) * th, center: r * th, outside: (r + od / 2) * th };
}

// Pressure loss per foot (psi/ft) for water at 1 cSt; density from stored weight/volume.
// Friction: laminar 64/Re; Blasius below Re 100,000 (matches the reference app);
// Colebrook with the material's roughness above that.
export function pressureLoss(idIn, velFps, roughFt, densLbFt3 = WATER_LB_FT3) {
  const D = idIn / 12;
  const Re = velFps * D / WATER_NU_FT2S;
  let f;
  if (Re <= 0) f = 0;
  else if (Re < 2300) f = 64 / Re;
  else if (Re < 100000) f = 0.3164 / Math.pow(Re, 0.25);
  else {
    f = 0.02; const rr = roughFt / D;
    for (let i = 0; i < 60; i++) f = Math.pow(-2 * Math.log10(rr / 3.7 + 2.51 / (Re * Math.sqrt(f))), -2);
  }
  const hf = f / D * velFps * velFps / (2 * G_FT_S2); // ft of head per ft
  return { Re, f, psiPerFt: hf * densLbFt3 / 144 };
}
