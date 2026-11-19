// The calculator engine: a keystroke state machine. press(keyId) in, getDisplay() out.
// No browser APIs here, so it runs in Node for tests and in the app unchanged.
import { UNITS, q, kindOf, inUnit, familyOf, mergeFamily, unitFor, WATER_LB_FT3 } from './units.js';
import { formatQ, fmtNum, fmtInches } from './format.js';
import { MATERIALS, ELBOW_TYPES, pipeData, findSize, pipeType, defaultTypeIndex, takeOut, arcs, pressureLoss, steelOD } from './pipes.js';

export const DEFAULT_PREFS = { math: 'aos', fracRes: 16, fracMode: 'standard', areaDisplay: 'std', volDisplay: 'std', meters: 'fixed', degrees: 'fixed' };

// Secondary (Conv) function of each key.
export const CONV = {
  angle: 'to', offset: 'gap', run: 'cutback', travel: 'roll', mat: 'elbow',
  pow: 'root', sin: 'asin', cos: 'acos', tan: 'atan', size: 'ptype',
  lp: 'flow', rp: 'vel', circle: 'press', sq: 'force', sqrt: 'area',
  mm: 'm', ft: 'ftc', in: 'inc', frac: 'kg', clear: 'pct', bksp: 'pct',
  conv: 'conv', '7': 'lbs', '8': 'gal', '9': 'L', div: 'recip',
  store: 'prefs', '4': 'cfm', '5': 'cfs', '6': 'degF', mul: 'clearall',
  rcl: 'mc', '1': 'gpm', '2': 'lps', '3': 'degC', sub: 'neg',
  mplus: 'mminus', '0': 'cost', dot: 'dmsdeg', eq: 'tape', add: 'pi',
};
const TAG_UNIT = { gpm: 'gpm', lps: 'lps', cfm: 'cfm', cfs: 'cfs', degC: 'degC', degF: 'degF', lbs: 'lb', gal: 'gal', L: 'L', kg: 'kg' };
const OP_SYM = { add: '+', sub: '−', mul: '×', div: '÷', pow: '^', root: 'ʸ√' };
const PREC = { add: 1, sub: 1, mul: 2, div: 2, pow: 3, root: 3 };
const GEO = ['offset', 'run', 'travel', 'angle'];
const WTVOL_UNITS = ['lbft3', 'kgm3', 'lbgal'];
const FLOW_UNITS = ['gpm', 'cfm', 'cfs', 'lps', 'm3s'];
const VEL_UNITS = ['fps', 'fpm', 'mps'];
const PRESS_UNITS = ['psi', 'psf', 'inHg', 'ftHd', 'bar', 'kPa'];
const R2D = 180 / Math.PI, D2R = Math.PI / 180;
const clone = o => JSON.parse(JSON.stringify(o));

export class Calculator {
  constructor(prefs = {}) {
    this.prefs = { ...DEFAULT_PREFS, ...prefs };
    this.reset();
  }

  // ---------- state ----------
  reset() {
    this.s = {
      entry: null, disp: { q: q(0, 'num'), label: '' }, fresh: false, justEval: false,
      ex: { vals: [], ops: [] }, pendingOp: false,
      conv: false, store: false, rcl: false,
      regs: {}, order: [],
      semi: this.defaultSemi(),
      mem: Array(10).fill(null), acc: null,
      lastFn: null, lastKey: null, tempRes: null, err: null,
      tape: [], tapeN: 0, adv: [],
    };
  }
  defaultSemi() { return { mat: 0, type: defaultTypeIndex(0), size: null, elbow: 0, gap: 0.125, unitCost: 0, wtvol: WATER_LB_FT3 }; }
  serialize() { return JSON.stringify({ v: 1, s: this.s }); }
  load(json) {
    try { const o = JSON.parse(json); if (o && o.v === 1 && o.s) { this.reset(); Object.assign(this.s, o.s); } } catch (e) { this.reset(); }
  }
  setPrefs(p) { Object.assign(this.prefs, p); }
  get res() { return Math.max(this.prefs.fracRes, this.s.tempRes || 0); }

  // ---------- display ----------
  fmt(x) { return formatQ(x, this.prefs, this.res); }
  getDisplay() {
    const s = this.s; const d = { label: '', main: '', unit: '', sub: '', error: false };
    const flags = { conv: s.conv, store: s.store, rcl: s.rcl, mem: s.acc != null && s.acc.v !== 0, chain: this.prefs.math === 'chain', adv: s.adv.length > 0, op: s.pendingOp ? OP_SYM[s.ex.ops[s.ex.ops.length - 1]] || '' : '', paren: s.ex.ops.filter(o => o === '(').length };
    if (s.err) return { ...d, label: 'Error', main: 'Error', sub: s.err, error: true, flags };
    if (s.entry) { const t = this.entryText(); return { ...d, label: s.disp.entryLabel || '', main: t.main, unit: t.unit, flags }; }
    const p = s.disp;
    if (p.text != null) return { ...d, label: p.label || '', main: p.text, sub: p.sub || '', flags };
    const f = this.fmt(p.q);
    const ruler = (p.q.unit === 'in' || p.q.unit === 'ftin') ? { v: p.q.v, res: this.res, mode: this.prefs.fracMode } : null;
    return { ...d, label: p.label || '', main: f.main, unit: p.unitText != null ? p.unitText : f.unit, sub: p.sub || '', flags, ruler };
  }
  getStored() { const m = this.s.semi; return { wtvol: m.wtvol, gap: m.gap, unitCost: m.unitCost }; }
  setStored(o) { const m = this.s.semi; for (const k of ['wtvol', 'gap', 'unitCost']) if (o[k] != null && isFinite(o[k])) m[k] = +o[k]; }
  show(x, label = '', extra = {}) { this.s.disp = { q: x, label, ...extra }; }
  showText(text, label = '', sub = '') { this.s.disp = { q: null, text, label, sub }; }
  error(msg) { this.s.err = msg; this.s.entry = null; }

  // ---------- key entry point ----------
  press(id) {
    const s = this.s; const out = { action: null };
    if (s.err) { s.err = null; if (id === 'clear') { this.show(q(0, 'num')); s.lastKey = 'clear'; return out; } }
    if (id === 'conv') { s.conv = !s.conv; s.lastKey = 'conv'; return out; }
    const conv = s.conv; s.conv = false;
    const k = conv ? CONV[id] : id;
    if (s.store) { s.store = false; if (this.storeTo(id, conv)) { s.lastKey = id; return out; } }
    if (s.rcl) { s.rcl = false; const r = this.recall(id, conv); if (r) { s.lastKey = 'rcl-' + id; if (r.action) out.action = r.action; return out; } }
    try { this.dispatch(k, id, out); } catch (e) { this.error(e.message || 'Error'); }
    s.lastKey = conv ? 'c-' + id : (k === 'clear' ? 'clear' : id);
    return out;
  }

  dispatch(k, id, out) {
    const s = this.s;
    if (/^[0-9]$/.test(k)) return this.digit(k);
    switch (k) {
      case 'dot': return this.dot();
      case 'frac': return this.slash();
      case 'ft': case 'in': case 'mm': case 'm': case 'ftc': case 'inc': return this.unitKey(k, id);
      case 'bksp': return this.backspace();
      case 'clear': return this.clear();
      case 'clearall': return this.clearAll();
      case 'add': case 'sub': case 'mul': case 'div': case 'pow': case 'root':
        if (k === 'add' && s.lastFn && s.lastFn.kind === 'wtvol' && s.lastKey === 'add' || k === 'add' && s.lastFn && s.lastFn.kind === 'wtvol' && s.lastKey === 'store-add') return this.cycleWtVol();
        return this.operator(k);
      case 'lp': if (s.lastFn && s.lastFn.kind === 'flow' && !this.hasFresh()) return this.cycle(); return this.openParen();
      case 'rp': if (s.lastFn && s.lastFn.kind === 'vel' && !this.hasFresh()) return this.cycle(); return this.closeParen();
      case 'eq': return this.equals();
      case 'pct': return this.percent();
      case 'sq': case 'sqrt': case 'recip': case 'neg': case 'pi': case 'sin': case 'cos': case 'tan': case 'asin': case 'acos': case 'atan': case 'dmsdeg': return this.unary(k);
      case 'store': s.store = true; return;
      case 'rcl': s.rcl = true; return;
      case 'mplus': case 'mminus': return this.mplus(k === 'mminus' ? -1 : 1);
      case 'mc': s.acc = null; return;
      case 'tape': out.action = 'tape'; return;
      case 'prefs': out.action = 'prefs'; return;
      case 'cost': return this.cost();
      case 'gpm': case 'lps': case 'cfm': case 'cfs': case 'degC': case 'degF': case 'lbs': case 'gal': case 'L': case 'kg': return this.tagOrConvert(TAG_UNIT[k]);
      default: return this.func(k);
    }
  }

  // ---------- number entry ----------
  newEntry() {
    const s = this.s;
    if (s.justEval && !s.pendingOp) { s.ex = { vals: [], ops: [] }; }
    s.justEval = false;
    s.entry = { buf: '', ft: null, inch: null, mm: null, m: null, numer: null, power: 1, lastUnitKey: null, dec: false, dms: false, neg: false };
    s.disp.entryLabel = '';
  }
  digit(d) {
    if (!this.s.entry) this.newEntry();
    const e = this.s.entry; if (e.lastUnitKey && e.buf === '' && e.numer == null && e.power > 1) return;
    if (e.buf.replace(/[^0-9]/g, '').length >= 10) return;
    e.buf = e.buf === '0' ? d : e.buf + d;
  }
  dot() {
    if (!this.s.entry) this.newEntry();
    const e = this.s.entry; if (e.numer != null) return;
    const dots = (e.buf.match(/\./g) || []).length;
    if (dots === 0) e.buf = (e.buf || '0') + '.';
    else if (dots === 1) { e.buf += '.'; e.dms = true; }
  }
  slash() {
    const e = this.s.entry; if (!e || e.dms) return;
    if (e.buf !== '' && e.numer == null && !e.buf.includes('.')) { e.numer = e.buf; e.buf = ''; }
  }
  backspace() {
    const e = this.s.entry; if (!e) return;
    if (e.buf !== '') { const b = e.buf.slice(0, -1); if (e.buf.endsWith('.') && e.dms) e.dms = false; e.buf = b; }
    else if (e.numer != null) { e.buf = e.numer; e.numer = null; }
    else if (e.power > 1) e.power--;
    else if (e.inch != null) { e.buf = String(e.inch); e.inch = null; }
    else if (e.ft != null) { e.buf = String(e.ft); e.ft = null; }
    else if (e.mm != null) { e.buf = String(e.mm); e.mm = null; }
    else if (e.m != null) { e.buf = String(e.m); e.m = null; }
    else if (e.tag) e.tag = null;
    if (!e.buf && e.numer == null && e.ft == null && e.inch == null && e.mm == null && e.m == null) { this.s.entry = null; this.show(q(0, 'num')); }
  }
  segValue(e) { // value of the segment being typed (number or fraction)
    if (e.numer != null) { const d = parseFloat(e.buf); if (d > 0) return { v: parseFloat(e.numer) / d, frac: d }; return { v: parseFloat(e.numer), frac: 0 }; }
    if (e.buf === '' || e.buf === '.') return null;
    return { v: parseFloat(e.buf), frac: 0, dec: e.buf.includes('.') };
  }
  unitKey(k, id) {
    const s = this.s; const e = s.entry;
    const physical = id; // 'ft', 'in' or 'mm'
    if (e && !e.tag && !e.dms) {
      const seg = this.segValue(e);
      const slot = { ft: 'ft', ftc: 'ft', in: 'inch', inc: 'inch', mm: 'mm', m: 'm' }[k];
      const metricMix = (slot === 'mm' || slot === 'm') ? (e.ft != null || e.inch != null) : (e.mm != null || e.m != null);
      if (seg && e[slot] == null && !metricMix && !(seg.frac && e.inch != null)) {
        if (seg.frac) this.noteFrac(seg.frac);
        if (seg.dec) e.dec = true;
        e[slot] = seg.v; e.buf = ''; e.numer = null; e.lastUnitKey = physical; e.power = 1; return;
      }
      if (!seg && e.lastUnitKey === physical) {
        const n = ['ft', 'inch', 'mm', 'm'].filter(x => e[x] != null).length;
        if (n === 1 && e.power < 3) { e.power++; return; }
      }
      // otherwise the entry is complete: finish it, then convert what is shown
      this.finishEntry();
    } else if (e) this.finishEntry();
    this.convertDisplay(k, physical);
  }
  noteFrac(d) { if (d > this.prefs.fracRes && d <= 64) this.s.tempRes = Math.max(this.s.tempRes || 0, d); }

  entryText() {
    const e = this.s.entry; const sign = e.neg ? '-' : '';
    if (e.tag) return { main: sign + (e.buf || '0'), unit: UNITS[e.tag].label };
    if (e.dms) { const p = e.buf.split('.'); return { main: sign + `${p[0] || 0}°${p[1] || ''}'${p[2] != null ? p[2] + '"' : ''}`, unit: 'D:M:S' }; }
    const fracStr = e.numer != null ? `${e.numer}/${e.buf}` : '';
    const parts = [];
    if (e.ft != null) parts.push(`${e.ft}'`);
    if (e.inch != null) parts.push(`${e.inch}${fracStr ? ' ' + fracStr : ''}"`);
    else if (fracStr) parts.push(`${fracStr}${e.ft != null ? '"' : ''}`);
    if (e.mm != null) parts.push(`${e.mm}`);
    if (e.m != null) parts.push(`${e.m}`);
    if (e.inch == null && !fracStr && e.buf !== '') parts.push(e.buf);
    let unit = '';
    const pw = ['', '', 'sq ', 'cu '][e.power];
    if (e.mm != null) unit = pw + 'mm'; else if (e.m != null) unit = pw + 'meter';
    else if (e.ft != null) unit = e.power > 1 ? pw + 'feet' : 'feet-inch';
    else if (e.inch != null || fracStr) unit = e.power > 1 ? pw + 'inch' : 'inch';
    return { main: sign + (parts.join(' ') || '0'), unit };
  }

  finalizeEntry() {
    const s = this.s; const e = s.entry; if (!e) return null;
    s.entry = null;
    let x;
    if (e.tag) x = q(parseFloat(e.buf || '0'), e.tag);
    else if (e.dms) {
      const p = e.buf.split('.').map(t => parseFloat(t || '0'));
      x = q(p[0] + (p[1] || 0) / 60 + (p[2] || 0) / 3600, 'dms');
    } else {
      const seg = this.segValue(e);
      if (seg && seg.frac) this.noteFrac(seg.frac);
      const hasLen = e.ft != null || e.inch != null || (seg && seg.frac);
      if (e.mm != null || e.m != null) {
        const fam = e.mm != null ? 'mm' : 'm';
        const v = (e.mm != null ? e.mm : e.m) + (seg && e.power === 1 ? seg.v : 0);
        const kind = ['', 'len', 'area', 'vol'][e.power];
        x = q(v, unitFor(kind, fam));
      } else if (hasLen) {
        if (e.power > 1 && e.ft != null) x = q(e.ft, e.power === 2 ? 'ft2' : 'ft3');
        else if (e.power > 1) x = q(e.inch, e.power === 2 ? 'in2' : 'in3');
        else {
          let inches = (e.ft || 0) * 12 + (e.inch || 0);
          if (seg) inches += seg.v; // fraction, or trailing inches typed after feet
          const decFeet = e.ft != null && e.inch == null && !seg && e.dec;
          const unit = e.ft != null ? (decFeet ? 'ft' : 'ftin') : (e.dec && !(seg && seg.frac) ? 'indec' : 'in');
          x = { v: inches, unit };
        }
      } else {
        x = q(seg ? seg.v : 0, 'num');
      }
    }
    if (e.neg) x = { ...x, v: -x.v };
    return x;
  }
  // value the next operation works on
  finishEntry() { const s = this.s; const x = this.finalizeEntry(); this.show(x); s.fresh = true; s.pendingOp = false; return x; }
  operand() {
    const s = this.s;
    if (s.entry) return this.finishEntry();
    return s.disp.q ? clone(s.disp.q) : q(0, 'num');
  }
  hasFresh() { const s = this.s; return !!s.entry || (s.fresh && !!s.disp.q); }
  setResult(x, label = '') { const s = this.s; this.show(x, label); s.fresh = true; s.pendingOp = false; s.lastFn = null; }

  // ---------- arithmetic ----------
  operator(op) {
    const s = this.s;
    if (s.pendingOp && !s.entry) { s.ex.ops[s.ex.ops.length - 1] = op; return; }
    const x = this.operand();
    this.tapeAdd(x, OP_SYM[op]);
    s.ex.vals.push(x);
    const ops = s.ex.ops;
    const chain = this.prefs.math === 'chain';
    while (ops.length && ops[ops.length - 1] !== '(') {
      const top = ops[ops.length - 1];
      if (chain || PREC[top] > PREC[op] || (PREC[top] === PREC[op] && PREC[op] < 3)) this.reduce(); else break;
    }
    ops.push(op);
    this.show(s.ex.vals[s.ex.vals.length - 1]);
    s.pendingOp = true; s.fresh = false; s.justEval = false; s.lastFn = null;
  }
  reduce() {
    const ex = this.s.ex; const op = ex.ops.pop(); const b = ex.vals.pop(); const a = ex.vals.pop();
    ex.vals.push(this.binop(a, op, b));
  }
  openParen() {
    const s = this.s; if (s.entry) return; // ( only starts a group before a number
    if (!s.pendingOp && s.ex.vals.length === 0) s.ex = { vals: [], ops: [] };
    s.ex.ops.push('('); s.pendingOp = false; s.justEval = false;
    this.show(q(0, 'num')); s.fresh = false;
  }
  closeParen() {
    const s = this.s; if (!s.ex.ops.includes('(')) return;
    const x = this.operand(); this.tapeAdd(x, ')');
    s.ex.vals.push(x);
    while (s.ex.ops.length && s.ex.ops[s.ex.ops.length - 1] !== '(') this.reduce();
    s.ex.ops.pop();
    const r = s.ex.vals.pop();
    this.setResult(r);
  }
  equals() {
    const s = this.s;
    if (s.pendingOp && !s.entry) { s.ex.ops.pop(); const last = s.ex.vals.pop(); s.ex.vals.push(last); }
    else if (s.ex.vals.length || s.entry) { const x = this.operand(); this.tapeAdd(x, '='); s.ex.vals.push(x); }
    else { // nothing pending: make whatever is shown a plain value you can store or reuse
      this.setResult(clone(s.disp.q || q(0, 'num'))); s.justEval = true; return;
    }
    while (s.ex.ops.length) { if (s.ex.ops[s.ex.ops.length - 1] === '(') s.ex.ops.pop(); else this.reduce(); }
    const r = s.ex.vals.pop(); s.ex = { vals: [], ops: [] };
    this.tapeAdd(r, 'Total');
    this.setResult(r); s.justEval = true;
  }
  percent() {
    const s = this.s; const b = this.operand(); const ops = s.ex.ops;
    const top = ops[ops.length - 1];
    if (top && top !== '(' && s.ex.vals.length) {
      const a = s.ex.vals[s.ex.vals.length - 1]; let r;
      if (top === 'add' || top === 'sub') { ops.pop(); s.ex.vals.pop(); r = this.binop(a, top, { v: a.v * b.v / 100, unit: a.unit }); }
      else if (top === 'mul') { ops.pop(); s.ex.vals.pop(); r = this.binop(a, 'mul', q(b.v / 100, 'num')); }
      else if (top === 'div') { ops.pop(); s.ex.vals.pop(); r = this.binop(a, 'div', q(b.v / 100, 'num')); }
      else r = q(b.v / 100, 'num');
      this.tapeAdd(b, '%'); this.setResult(r); s.justEval = true; s.ex = s.ex.ops.length ? s.ex : { vals: [], ops: [] };
      return;
    }
    this.setResult({ v: b.v / 100, unit: b.unit === 'num' ? 'num' : b.unit });
  }

  // unit-aware binary math
  binop(a, op, b) {
    const ka = kindOf(a), kb = kindOf(b);
    const famUnit = (kind, ua, ub) => unitFor(kind, mergeFamily(ua, ub), true);
    const areaUnit = (ua, ub) => this.prefs.areaDisplay !== 'std' ? this.prefs.areaDisplay : famUnit('area', ua, ub);
    const volUnit = (ua, ub) => this.prefs.volDisplay !== 'std' ? this.prefs.volDisplay : famUnit('vol', ua, ub);
    const numAs = (n, other) => { // plain number used with a dimension: read it in that dimension's main unit
      const u = other.unit; const base = u === 'ftin' ? 'ft' : u;
      return { v: n.v * (UNITS[base].f || 1), unit: other.unit };
    };
    if (op === 'add' || op === 'sub') {
      const sg = op === 'add' ? 1 : -1;
      if (ka === kb) {
        if (ka === 'temp') return { v: a.v + sg * (b.unit === 'degC' ? b.v - 32 : b.v - 0) * (b.unit === 'degC' ? 1 : 1), unit: a.unit };
        const unit = ka === 'len' ? this.lenUnitMerge(a.unit, b.unit) : (ka === 'area' || ka === 'vol') ? famUnit(ka, a.unit, b.unit) : a.unit;
        return { v: a.v + sg * b.v, unit };
      }
      if (kb === 'num') { const bb = numAs(b, a); return { v: a.v + sg * bb.v, unit: a.unit }; }
      if (ka === 'num') { const aa = numAs(a, b); return { v: aa.v + sg * b.v, unit: b.unit }; }
      throw new Error('Units do not match');
    }
    if (op === 'mul') {
      if (ka === 'num' && kb === 'num') return q(a.v * b.v, 'num');
      if (ka === 'num' || kb === 'num') {
        const [n, x] = ka === 'num' ? [a, b] : [b, a]; const kx = kindOf(x);
        if (kx === 'wpl') return q(x.v * n.v, 'lb');          // lb/ft x feet
        return { v: x.v * n.v, unit: x.unit };
      }
      if (ka === 'len' && kb === 'len') return { v: a.v * b.v, unit: areaUnit(a.unit, b.unit) };
      if ((ka === 'area' && kb === 'len') || (ka === 'len' && kb === 'area')) return { v: a.v * b.v, unit: volUnit(a.unit, b.unit) };
      if (ka === 'wpl' && kb === 'len') return q(a.v * b.v / 12, 'lb');
      if (kb === 'wpl' && ka === 'len') return q(a.v * b.v / 12, 'lb');
      if (ka === 'money' || kb === 'money') return q(a.v * b.v, 'usd');
      throw new Error('Cannot multiply those units');
    }
    if (op === 'div') {
      if (b.v === 0) throw new Error('Divide by zero');
      if (kb === 'num') return { v: a.v / b.v, unit: a.unit };
      if (ka === kb) return q(a.v / b.v, 'num');
      if (ka === 'area' && kb === 'len') return { v: a.v / b.v, unit: unitFor('len', mergeFamily(a.unit, b.unit)) };
      if (ka === 'vol' && kb === 'len') return { v: a.v / b.v, unit: areaUnit(a.unit, b.unit) };
      if (ka === 'vol' && kb === 'area') return { v: a.v / b.v, unit: unitFor('len', mergeFamily(a.unit, b.unit)) };
      if (ka === 'num') return q(a.v / inUnit(b, b.unit), 'num');
      throw new Error('Cannot divide those units');
    }
    const av = inUnit(a, a.unit), bv = inUnit(b, b.unit);
    if (op === 'pow') {
      if (ka === 'len' && kb === 'num' && (bv === 2 || bv === 3)) return { v: Math.pow(a.v, bv), unit: bv === 2 ? areaUnit(a.unit, a.unit) : volUnit(a.unit, a.unit) };
      const r = Math.pow(av, bv); if (!isFinite(r)) throw new Error('Out of range'); return q(r, 'num');
    }
    if (op === 'root') {
      if (bv === 0) throw new Error('Invalid root');
      const r = av < 0 && Math.round(bv) % 2 === 1 ? -Math.pow(-av, 1 / bv) : Math.pow(av, 1 / bv);
      if (!isFinite(r)) throw new Error('Invalid root'); return q(r, 'num');
    }
    throw new Error('Error');
  }
  lenUnitMerge(ua, ub) {
    const fam = mergeFamily(ua, ub);
    const frac = (UNITS[ua].frac !== false) || (UNITS[ub].frac !== false);
    return unitFor('len', fam, frac);
  }

  unary(k) {
    const s = this.s;
    if (k === 'pi') { if (s.entry) s.entry = null; this.setResult(q(Math.PI, 'num')); return; }
    if (k === 'neg' && s.entry) { s.entry.neg = !s.entry.neg; return; }
    const x = this.operand(); const kx = kindOf(x); let r;
    const deg = () => kx === 'angle' ? x.v : inUnit(x, x.unit);
    switch (k) {
      case 'neg': r = { v: -x.v, unit: x.unit }; break;
      case 'sq':
        if (kx === 'len') r = { v: x.v * x.v, unit: unitFor('area', familyOf(x.unit)) };
        else r = q(Math.pow(inUnit(x, x.unit), 2), 'num'); break;
      case 'sqrt':
        if (x.v < 0) throw new Error('Square root of a negative');
        if (kx === 'area') r = { v: Math.sqrt(x.v), unit: unitFor('len', familyOf(x.unit)) };
        else r = q(Math.sqrt(inUnit(x, x.unit)), 'num'); break;
      case 'recip': { const v = inUnit(x, x.unit); if (v === 0) throw new Error('Divide by zero'); r = q(1 / v, 'num'); break; }
      case 'sin': r = q(Math.sin(deg() * D2R), 'num'); break;
      case 'cos': r = q(Math.cos(deg() * D2R), 'num'); break;
      case 'tan': { const d = deg(); if (Math.abs(((d % 180) + 180) % 180 - 90) < 1e-9) throw new Error('Tangent of 90°'); r = q(Math.tan(d * D2R), 'num'); break; }
      case 'asin': case 'acos': { const v = inUnit(x, x.unit); if (Math.abs(v) > 1) throw new Error('Out of range'); r = q((k === 'asin' ? Math.asin(v) : Math.acos(v)) * R2D, 'deg'); break; }
      case 'atan': r = q(Math.atan(inUnit(x, x.unit)) * R2D, 'deg'); break;
      case 'dmsdeg':
        if (x.unit === 'dms') r = { v: x.v, unit: 'deg' };
        else if (x.unit === 'deg') r = { v: x.v, unit: 'dms' };
        else r = q(inUnit(x, x.unit), 'dms');
        break;
    }
    this.tapeAdd(x, { sq: 'x²', sqrt: '√', recip: '1/x', sin: 'sin', cos: 'cos', tan: 'tan', asin: 'sin⁻¹', acos: 'cos⁻¹', atan: 'tan⁻¹', neg: '±', dmsdeg: '→' }[k] || '');
    this.setResult(r);
  }

  // ---------- memory ----------
  storeTo(id, conv) {
    const s = this.s;
    if (/^[1-9]$/.test(id) && !conv) { const x = this.operand(); s.mem[+id] = x; this.show(x, `Memory ${id}`); s.fresh = true; return true; }
    if (id === '0' && !conv) { const x = this.operand(); s.semi.unitCost = inUnit(x, x.unit); this.show(q(s.semi.unitCost, 'usd'), 'Unit Cost', { unitText: 'per unit' }); s.fresh = false; return true; }
    if (id === 'add' && !conv) {
      const fresh = this.hasFresh(); const x = this.operand();
      const raw = fresh ? inUnit(x, x.unit) : null;
      s.lastFn = { kind: 'wtvol', idx: 0, raw };
      if (raw != null) s.semi.wtvol = q(raw, 'lbft3').v;
      this.show({ v: s.semi.wtvol, unit: 'lbft3' }, 'Weight per Volume'); s.fresh = false; s.lastKey = 'store-add';
      return true;
    }
    return false;
  }
  cycleWtVol() {
    const s = this.s; const f = s.lastFn; f.idx = (f.idx + 1) % WTVOL_UNITS.length; const u = WTVOL_UNITS[f.idx];
    if (f.raw != null) s.semi.wtvol = q(f.raw, u).v;
    this.show({ v: s.semi.wtvol, unit: u }, 'Weight per Volume'); s.fresh = false;
  }
  recall(id, conv) {
    const s = this.s; const k = conv ? CONV[id] : id;
    if (/^[0-9]$/.test(k)) { const x = s.mem[+k] || q(0, 'num'); if (s.entry) s.entry = null; this.show(clone(x), `Memory ${k}`); s.fresh = true; s.pendingOp = false; return {}; }
    if (k === 'mplus') { this.show(clone(s.acc || q(0, 'num')), 'Memory Total'); s.fresh = true; return {}; }
    if (k === 'rcl') { this.show(clone(s.acc || q(0, 'num')), 'Memory Total (cleared)'); s.fresh = true; s.acc = null; return {}; }
    if (k === 'eq') return { action: 'tape' };
    const regView = this.registerView(k);
    if (regView) { s.entry = null; return {}; }
    return null;
  }
  mplus(sign) {
    const s = this.s; const x = this.operand();
    const y = sign < 0 ? { v: -x.v, unit: x.unit } : x;
    s.acc = s.acc ? this.binop(s.acc, 'add', y) : y;
    this.show(x, sign < 0 ? 'M−' : 'M+'); s.fresh = true; s.justEval = true;
  }
  cost() {
    const s = this.s;
    if (s.ex.vals.length || s.pendingOp) { this.equals(); const r = s.disp.q; this.setResult(q(inUnit(r, r.unit), 'usd'), 'Total Cost'); return; }
    const x = this.operand();
    this.setResult(q(inUnit(x, x.unit) * s.semi.unitCost, 'usd'), 'Total Cost'); s.justEval = true;
  }
  tagOrConvert(unit) {
    const s = this.s;
    if (s.entry) { const e = s.entry; if (e.ft == null && e.inch == null && e.mm == null && e.m == null && e.numer == null && !e.dms) { e.tag = unit; this.finishEntry(); return; } }
    const x = s.disp.q; if (!x) return;
    const kx = kindOf(x); const ku = UNITS[unit].kind;
    if (kx === ku) { this.show({ v: x.v, unit }, s.disp.label, {}); return; }
    if (kx === 'vol' && unit === 'lb') { this.show(q(x.v / 1728 * s.semi.wtvol, 'lb'), s.disp.label); return; }
    if (kx === 'vol' && unit === 'kg') { this.show({ v: x.v / 1728 * s.semi.wtvol, unit: 'kg' }, s.disp.label); return; }
    if (kx === 'num') { this.show(q(x.v, unit), s.disp.label); s.fresh = true; return; }
    throw new Error('Cannot convert to ' + UNITS[unit].label);
  }
  convertDisplay(k, physical) {
    const s = this.s; const x = s.disp.q; if (!x) return;
    const kx = kindOf(x); const u = UNITS[x.unit]; let unit = null;
    if (kx === 'len') {
      const fam = u.family;
      if (k === 'ft' || k === 'ftc') unit = fam === 'ft' ? (u.frac ? 'ft' : 'ftin') : (u.frac === false && k === 'ft' ? 'ft' : 'ftin');
      else if (k === 'in' || k === 'inc') unit = fam === 'in' ? (u.frac ? 'indec' : 'in') : (u.frac === false && k === 'in' ? 'indec' : 'in');
      else if (k === 'mm' || k === 'm') unit = fam === 'mm' ? 'm' : fam === 'm' ? 'mm' : 'mm';
    } else if (kx === 'area' || kx === 'vol') {
      const fam = u.family;
      if (k === 'ft' || k === 'ftc') unit = unitFor(kx, 'ft');
      else if (k === 'in' || k === 'inc') unit = unitFor(kx, 'in');
      else if (k === 'mm' || k === 'm') unit = kx === 'vol' ? (fam === 'm' ? 'mm3' : fam === 'mm' ? 'm3' : 'm3') : (fam === 'mm' ? 'm2' : fam === 'm' ? 'mm2' : 'mm2');
    } else if (kx === 'num' && s.fresh) { // a plain number: give it the unit
      const map = { ft: 'ftin', ftc: 'ftin', in: 'in', inc: 'in', mm: 'mm', m: 'm' };
      unit = map[k]; this.show(q(x.v, unit === 'ftin' ? 'ft' : unit), s.disp.label); s.disp.q.unit = unit; return;
    }
    if (unit) this.show({ v: x.v, unit }, s.disp.label, { sub: s.disp.sub });
  }

  // ---------- clear ----------
  clear() {
    const s = this.s;
    if (s.lastKey === 'clear') { this.clearTemp(); return; }
    s.entry = null; s.tempRes = null; this.show(q(0, 'num')); s.fresh = false; s.lastFn = null;
  }
  clearTemp() {
    const s = this.s;
    s.entry = null; s.ex = { vals: [], ops: [] }; s.pendingOp = false; s.justEval = false;
    s.regs = {}; s.order = []; s.lastFn = null; s.tempRes = null; s.tape = []; s.tapeN = 0; s.adv = [];
    this.show(q(0, 'num')); s.fresh = false;
  }
  clearAll() {
    const s = this.s; this.clearTemp();
    s.mem = Array(10).fill(null); s.acc = null; s.semi = this.defaultSemi();
    this.showText('All Cleared', '');
  }

  // ---------- tapes ----------
  tapeAdd(x, op) {
    const s = this.s; s.tapeN += 1; const f = this.fmt(x);
    s.tape.push({ n: s.tapeN, text: f.main, unit: f.unit, op: op || '' });
    if (s.tape.length > 20) s.tape.shift();
  }
  advAdd(section, label, x, text, unitText) {
    const s = this.s; let sec = s.adv.find(z => z.title === section);
    if (!sec) { sec = { title: section, rows: [] }; if (section === 'Input') s.adv.unshift(sec); else s.adv.push(sec); }
    const f = x ? this.fmt(x) : { main: text, unit: '' };
    if (unitText != null) f.unit = unitText;
    const row = sec.rows.find(r => r.label === label);
    if (row) { row.main = f.main; row.unit = f.unit; } else sec.rows.push({ label, main: f.main, unit: f.unit });
  }
  getTape() { return this.s.tape.slice(); }
  getAdvancedTape() { return clone(this.s.adv); }

  // ---------- registers and pipe functions ----------
  setReg(name, x, label) {
    const s = this.s; s.regs[name] = x; s.order = s.order.filter(n => n !== name); s.order.push(name);
    this.show(x, label); s.fresh = false; s.pendingOp = false; s.justEval = false;
    this.advAdd('Input', label, x);
  }
  has(name) { return this.s.regs[name] != null; }
  showOut(o) { this.s.disp = { q: o.q || null, text: o.text, label: o.label, sub: o.sub || '', unitText: o.unitText }; this.s.fresh = false; if (o.section) { if (o.q) this.advAdd(o.section, o.label, o.q, null, o.unitText); else this.advAdd(o.section, o.label, null, o.text, o.sub); } }
  cycle() { const f = this.s.lastFn; f.idx = (f.idx + 1) % f.outputs.length; this.showOut(f.outputs[f.idx]); }
  startFn(cycleKey, kind, outputs) { const s = this.s; s.lastFn = { cycleKey, kind, outputs, idx: 0 }; this.showOut(outputs[0]); }
  lenOut(v) { return { v, unit: this.geoUnit() }; }
  geoUnit() {
    const fams = this.s.order.filter(n => ['offset', 'run', 'travel', 'roll'].includes(n) && this.s.regs[n] && kindOf(this.s.regs[n]) === 'len').map(n => familyOf(this.s.regs[n].unit));
    const fam = fams.includes('ft') ? 'ft' : fams[0] || 'in';
    return unitFor('len', fam, true);
  }

  // The two most recently entered of Offset, Run, Travel, Angle/Slope solve the triangle; Roll adds to Offset.
  geometry() {
    const r = this.s.regs; const pick = this.s.order.filter(n => GEO.includes(n)).slice(-2);
    const use = n => pick.includes(n);
    let ang = use('angle') ? (kindOf(r.angle) === 'len' ? Math.atan(r.angle.v / 12) * R2D : inUnit(r.angle, r.angle.unit)) : null;
    const ro = this.has('roll') ? r.roll.v : 0;
    let to = use('offset') ? Math.hypot(r.offset.v, ro) : null;
    let run = use('run') ? r.run.v : null; let t = use('travel') ? r.travel.v : null;
    const tn = a => Math.tan(a * D2R), sn = a => Math.sin(a * D2R), cs = a => Math.cos(a * D2R);
    if (t == null) { if (to != null && run != null) t = Math.hypot(to, run); else if (to != null && ang != null) t = to / sn(ang); else if (run != null && ang != null) t = run / cs(ang); }
    if (to == null) { if (t != null && run != null) to = Math.sqrt(Math.max(0, t * t - run * run)); else if (run != null && ang != null) to = run * tn(ang); else if (t != null && ang != null) to = t * sn(ang); }
    if (run == null) { if (t != null && to != null) run = Math.sqrt(Math.max(0, t * t - to * to)); else if (to != null && ang != null) run = to / tn(ang); }
    if (ang == null && to != null && run != null) ang = Math.atan2(to, run) * R2D;
    const offset = to != null ? Math.sqrt(Math.max(0, to * to - (use('offset') ? ro * ro : 0))) : null;
    return { offset, trueOffset: to, run, travel: t, angle: ang, roll: ro, pick };
  }
  need() { return { text: 'Need 2 values', sub: 'Offset, Run, Travel or Angle' }; }

  travelOutputs(label) {
    const s = this.s; const g = this.geometry(); const sec = s.regs.roll ? 'Rolling Offset' : 'Offset';
    if (g.travel == null || g.angle == null) return [{ ...this.need(), label }];
    const out = [{ label, q: this.lenOut(g.travel), section: sec }];
    let TO = null; const size = s.semi.size;
    if (this.has('userTO')) TO = s.regs.userTO.v; else if (size != null) TO = takeOut(size, s.semi.elbow, g.angle);
    if (TO != null) {
      out.push({ label: 'Cut Length', q: this.lenOut(g.travel - 2 * TO - 2 * s.semi.gap), section: sec });
      out.push({ label: 'Take-Out', q: q(TO, 'in'), section: sec });
      out.push({ label: "Welder's Gap", q: q(s.semi.gap, 'in'), section: sec });
    }
    out.push({ label: 'Fitting Angle', q: q(g.angle, 'deg'), section: sec });
    if (!this.has('userTO') && size != null) {
      const a = arcs(size, s.semi.elbow, g.angle);
      out.push({ label: 'Inside Arc', q: q(a.inside, 'in'), section: sec }, { label: 'Center Arc', q: q(a.center, 'in'), section: sec }, { label: 'Outside Arc', q: q(a.outside, 'in'), section: sec });
    }
    return out;
  }
  angleOutputs() {
    const g = this.geometry(); if (g.angle == null) return [{ ...this.need(), label: 'Slope Angle' }];
    const t = Math.tan(g.angle * D2R);
    const runFt = this.has('run') && familyOf(this.s.regs.run.unit) === 'ft';
    const slopeFirst = runFt || (this.has('angle') && kindOf(this.s.regs.angle) === 'len');
    const A = { label: 'Slope Angle', q: q(g.angle, 'deg'), section: 'Slope' };
    const S = { label: 'Slope per Foot', q: q(12 * t, 'in'), section: 'Slope' };
    const P = { label: '% Grade', q: q(100 * t, 'num'), section: 'Slope' };
    const G = { label: 'Grade', q: q(t, 'num'), section: 'Slope' };
    return slopeFirst ? [S, A, P, G] : [A, S, P, G];
  }
  pipeOutputs() {
    const s = this.s; const m = s.semi; const d = pipeData(m.mat, m.type, m.size, m.wtvol);
    const t = pipeType(m.mat, m.type);
    if (m.size == null) return [{ label: 'Pipe Size', text: 'No size set', sub: 'Enter a size, then Pipe Size' }];
    if (!d) return [{ label: 'Pipe Size', text: 'Not available', sub: `${MATERIALS[m.mat].label} ${t.label}` }];
    const sec = 'Pipe Size';
    return [
      { label: 'Pipe Size', q: q(m.size, 'in'), unitText: t.byOD ? 'inch OD' : 'inch nominal', section: sec },
      { label: 'Outside Diameter', q: q(d.od, 'indec'), section: sec },
      { label: 'Inside Diameter', q: q(d.id, 'indec'), section: sec },
      { label: 'Wall Thickness', q: q(d.wall, 'indec'), section: sec },
      { label: 'Material', text: `${d.material}`, sub: d.type, section: sec },
      { label: 'Weight', q: q(d.weight, 'lbft'), section: sec },
      { label: 'Filled Weight', q: q(d.filled, 'lbft'), section: sec },
      { label: 'Inside Area', q: q(d.area, 'in2'), section: sec },
    ];
  }
  pipeArea() { const m = this.s.semi; const d = m.size != null ? pipeData(m.mat, m.type, m.size, m.wtvol) : null; return d ? d.area : null; }
  areaValue() { // in^2: entered area, else pipe area, else circle area
    const r = this.s.regs; if (r.area) return r.area.v;
    const pa = this.pipeArea(); if (pa != null) return pa;
    if (r.circle) return Math.PI / 4 * r.circle.v * r.circle.v;
    return null;
  }
  unitCycle(units, baseVal, label, section, kind, cycleKey, extra = {}) {
    return units.map(u => ({ label: UNITS[u].long || label, q: { v: baseVal, unit: u }, section, ...extra }));
  }

  // Show a stored register (Rcl + key). Returns true if handled.
  registerView(k) {
    const s = this.s; const r = s.regs; const m = s.semi;
    const view = (x, label) => { if (x) this.show(clone(x), label); else this.showText('Not set', label); s.fresh = !!x; };
    switch (k) {
      case 'offset': view(r.offset, 'Offset'); return true;
      case 'run': view(r.run, 'Run'); return true;
      case 'travel': view(r.travel, 'Travel'); return true;
      case 'angle': view(r.angle, kindOf(r.angle || q(0, 'num')) === 'len' ? 'Slope' : 'Angle'); return true;
      case 'roll': view(r.roll, 'Roll'); return true;
      case 'gap': view(q(m.gap, 'in'), "Welder's Gap"); return true;
      case 'to': view(r.userTO, 'Take-Out'); return true;
      case 'circle': view(r.circle, 'Diameter'); return true;
      case 'flow': view(r.flow, 'Flow'); return true;
      case 'vel': view(r.vel, 'Velocity'); return true;
      case 'area': view(r.area, 'Area'); return true;
      case 'force': view(r.force, 'Force'); return true;
      case 'press': view(r.press, 'Pressure'); return true;
      case 'size': if (m.size != null) { this.startFn('size', 'size', this.pipeOutputs()); } else this.showText('No size set', 'Pipe Size'); return true;
      case 'mat': s.lastFn = { cycleKey: 'mat', kind: 'mat', outputs: [], idx: 0 }; this.showText(MATERIALS[m.mat].label, 'Pipe Material'); return true;
      case 'ptype': s.lastFn = { cycleKey: 'size', kind: 'ptype', outputs: [], idx: 0 }; this.showText(pipeType(m.mat, m.type).label, 'Pipe Type', MATERIALS[m.mat].label); return true;
      case 'elbow': s.lastFn = { cycleKey: 'mat', kind: 'elbow', outputs: [], idx: 0 }; this.showText(ELBOW_TYPES[m.elbow], 'Elbow Type'); return true;
    }
    return false;
  }

  func(k) {
    const s = this.s; const r = s.regs; const m = s.semi; const lf = s.lastFn;
    const fresh = this.hasFresh();
    const x = fresh ? this.operand() : null;
    const physical = Object.keys(CONV).find(key => CONV[key] === k) || k;
    const cycleKey = k; // keys that cycle their own outputs
    // keep cycling the previous function?
    if (!fresh && lf && lf.cycleKey === k) {
      if (lf.kind === 'mat') { m.mat = (m.mat + 1) % MATERIALS.length; m.type = defaultTypeIndex(m.mat); this.showText(MATERIALS[m.mat].label, 'Pipe Material'); this.advAdd('Input', 'Pipe Material', null, MATERIALS[m.mat].label); return; }
      if (lf.kind === 'elbow') { m.elbow = (m.elbow + 1) % ELBOW_TYPES.length; this.showText(ELBOW_TYPES[m.elbow], 'Elbow Type'); return; }
      if (lf.kind === 'ptype') { const n = MATERIALS[m.mat].types.length; m.type = (m.type + 1) % n; this.showText(pipeType(m.mat, m.type).label, 'Pipe Type', MATERIALS[m.mat].label); this.advAdd('Input', 'Pipe Type', null, pipeType(m.mat, m.type).label); return; }
      if (lf.outputs && lf.outputs.length > 1) return this.cycle();
    }
    switch (k) {
      case 'offset':
        if (x) return this.setReg('offset', this.asLen(x), 'Offset');
        { const g = this.geometry(); return this.startFn('offset', 'geo', g.trueOffset == null ? [{ ...this.need(), label: 'Offset' }] : [{ label: 'Offset', q: this.lenOut(g.offset), section: 'Offset' }]); }
      case 'run':
        if (x) return this.setReg('run', this.asLen(x), 'Run');
        { const g = this.geometry(); return this.startFn('run', 'geo', g.run == null ? [{ ...this.need(), label: 'Run' }] : [{ label: 'Run', q: this.lenOut(g.run), section: 'Offset' }]); }
      case 'travel':
        if (x) return this.setReg('travel', this.asLen(x), 'Travel');
        return this.startFn('travel', 'travel', this.travelOutputs(this.has('roll') ? 'Centerline Length' : 'Travel'));
      case 'roll':
        if (x) { this.setReg('roll', this.asLen(x), 'Roll'); return this.startFn('travel', 'travel', this.travelOutputs('Centerline Length')); }
        s.lastFn = null;
        return r.roll ? this.showOut({ label: 'Roll', q: clone(r.roll) }) : this.showOut({ label: 'Roll', text: 'Not set' });
      case 'angle':
        if (x) {
          if (kindOf(x) === 'len') return this.setReg('angle', { v: x.v, unit: 'in' }, 'Slope per Foot');
          const deg = kindOf(x) === 'angle' ? x.v : inUnit(x, x.unit);
          if (!(deg > 0 && deg < 180)) throw new Error('Angle must be 0–180°');
          return this.setReg('angle', q(deg, 'deg'), 'Slope Angle');
        }
        return this.startFn('angle', 'angle', this.angleOutputs());
      case 'to':
        if (x) { const v = this.asLen(x); this.setReg('userTO', { v: v.v, unit: 'in' }, 'Take-Out'); return; }
        {
          if (this.has('userTO')) return this.showOut({ label: 'Take-Out', q: clone(r.userTO) });
          const g = this.geometry(); if (g.angle == null) return this.startFn('angle', 'to', [{ label: 'Take-Out', text: 'Need an angle', sub: 'Enter an angle, or offset and run' }]);
          if (m.size == null) return this.startFn('angle', 'to', [{ label: 'Take-Out', text: 'No size set', sub: 'Enter a size, then Pipe Size' }]);
          const TO = takeOut(m.size, m.elbow, g.angle); const a = arcs(m.size, m.elbow, g.angle);
          return this.startFn('angle', 'to', [{ label: 'Take-Out', q: q(TO, 'in'), section: 'Take-Out' }, { label: 'Inside Arc', q: q(a.inside, 'in'), section: 'Take-Out' }, { label: 'Center Arc', q: q(a.center, 'in'), section: 'Take-Out' }, { label: 'Outside Arc', q: q(a.outside, 'in'), section: 'Take-Out' }]);
        }
      case 'cutback': {
        const g = this.geometry(); const spacing = r.offset ? r.offset.v : null;
        if (g.angle == null || spacing == null) return this.showOut({ label: 'Cutback', text: 'Need angle + offset', sub: 'Offset = spacing between pipes' });
        return this.showOut({ label: 'Cutback', q: { v: spacing * Math.tan(g.angle * D2R / 2), unit: this.geoUnit() }, section: 'Cutback' });
      }
      case 'gap':
        if (x) { const v = this.asLen(x); if (v.v < 0) throw new Error('Gap cannot be negative'); m.gap = v.v; this.show(q(m.gap, 'in'), "Welder's Gap"); s.fresh = false; this.advAdd('Input', "Welder's Gap", q(m.gap, 'in')); return; }
        return this.showOut({ label: "Welder's Gap", q: q(m.gap, 'in') });
      case 'mat':
        s.lastFn = { cycleKey: 'mat', kind: 'mat', outputs: [], idx: 0 };
        return this.showText(MATERIALS[m.mat].label, 'Pipe Material');
      case 'elbow':
        s.lastFn = { cycleKey: 'mat', kind: 'elbow', outputs: [], idx: 0 };
        return this.showText(ELBOW_TYPES[m.elbow], 'Elbow Type');
      case 'ptype':
        if (x) {
          const n = inUnit(x, x.unit); const i = MATERIALS[m.mat].types.findIndex(t => t.num != null && Math.abs(t.num - n) < 1e-9);
          if (i < 0) throw new Error(`No ${n} type for ${MATERIALS[m.mat].label}`);
          m.type = i;
        }
        s.lastFn = { cycleKey: 'size', kind: 'ptype', outputs: [], idx: 0 };
        this.advAdd('Input', 'Pipe Type', null, pipeType(m.mat, m.type).label);
        return this.showText(pipeType(m.mat, m.type).label, 'Pipe Type', MATERIALS[m.mat].label);
      case 'size':
        if (x) {
          const n = kindOf(x) === 'len' ? x.v : inUnit(x, x.unit);
          if (!findSize(m.mat, m.type, n)) throw new Error(`${fmtInches(n, 64, 'standard', '"')} not in ${MATERIALS[m.mat].label} ${pipeType(m.mat, m.type).label}`);
          m.size = n;
          this.advAdd('Input', 'Pipe Material', null, MATERIALS[m.mat].label);
          this.advAdd('Input', 'Pipe Type', null, pipeType(m.mat, m.type).label);
          this.advAdd('Input', 'Pipe Size', q(n, 'in'));
          const outs = this.pipeOutputs(); outs.slice(1).forEach(o => o.q ? this.advAdd(o.section, o.label, o.q) : this.advAdd(o.section, o.label, null, o.text));
          s.lastFn = { cycleKey: 'size', kind: 'size', outputs: outs, idx: 0 };
          this.show(q(n, 'in'), 'Pipe Size', { unitText: pipeType(m.mat, m.type).byOD ? 'inch OD' : 'inch nominal' }); s.fresh = false; return;
        }
        return this.startFn('size', 'size', this.pipeOutputs());
      case 'circle':
        if (x) {
          const d = this.asLen(x); r.circle = d; this.advAdd('Input', 'Diameter', d);
          const outs = this.circleOutputs(); s.lastFn = { cycleKey: 'circle', kind: 'circle', outputs: outs, idx: 0 }; this.showOut(outs[0]); return;
        }
        if (!r.circle) return this.showOut({ label: 'Circle', text: 'Enter a diameter', sub: 'then press Circle' });
        return this.startFn('circle', 'circle', this.circleOutputs());
      case 'flow': {
        if (x) { const f = kindOf(x) === 'flow' ? x : q(inUnit(x, x.unit), 'gpm'); this.setReg('flow', f, 'Flow'); s.lastFn = { cycleKey: 'lp', kind: 'flow', outputs: this.unitCycle(FLOW_UNITS, f.v, 'Flow', 'Flow'), idx: FLOW_UNITS.indexOf(f.unit) }; return; }
        const A = this.areaValue(); let Q = null;
        if (r.vel && A != null) Q = r.vel.v * (A / 144) * 448.8311688;
        else if (r.flow) Q = r.flow.v;
        if (Q == null) return this.showOut({ label: 'Flow', text: 'Need velocity + area', sub: 'or enter a flow' });
        s.lastFn = { cycleKey: 'lp', kind: 'flow', outputs: this.unitCycle(FLOW_UNITS, Q, 'Flow', 'Flow'), idx: 0 }; return this.showOut(s.lastFn.outputs[0]);
      }
      case 'vel': {
        if (x) { const v = kindOf(x) === 'vel' ? x : q(inUnit(x, x.unit), 'fps'); this.setReg('vel', v, 'Velocity'); s.lastFn = { cycleKey: 'rp', kind: 'vel', outputs: this.unitCycle(VEL_UNITS, v.v, 'Velocity', 'Velocity'), idx: VEL_UNITS.indexOf(v.unit) }; return; }
        const A = this.areaValue(); let V = null;
        if (r.flow && A != null) V = (r.flow.v / 448.8311688) / (A / 144);
        else if (r.vel) V = r.vel.v;
        if (V == null) return this.showOut({ label: 'Velocity', text: 'Need flow + area', sub: 'or enter a velocity' });
        s.lastFn = { cycleKey: 'rp', kind: 'vel', outputs: this.unitCycle(VEL_UNITS, V, 'Velocity', 'Velocity'), idx: 0 }; return this.showOut(s.lastFn.outputs[0]);
      }
      case 'area': {
        if (x) { const a = kindOf(x) === 'area' ? x : q(inUnit(x, x.unit), 'in2'); return this.setReg('area', a, 'Area'); }
        let A = null;
        if (r.force && r.press) A = r.force.v / r.press.v;
        else if (r.area) A = r.area.v; else A = this.areaValue();
        if (A == null) return this.showOut({ label: 'Area', text: 'Need force + pressure', sub: 'or a pipe size or diameter' });
        return this.showOut({ label: 'Area', q: q(A, 'in2'), section: 'Area' });
      }
      case 'force': {
        if (x) { const f = q(inUnit(x, x.unit), 'lbf'); return this.setReg('force', f, 'Force'); }
        if (r.press && r.area) return this.showOut({ label: 'Force', q: q(r.press.v * r.area.v, 'lbf'), section: 'Force' });
        if (r.force) return this.showOut({ label: 'Force', q: clone(r.force) });
        return this.showOut({ label: 'Force', text: 'Need pressure + area', sub: 'or enter a force' });
      }
      case 'press': {
        if (x) { const p = kindOf(x) === 'press' ? x : q(inUnit(x, x.unit), 'psi'); return this.setReg('press', p, 'Pressure'); }
        if (r.force && r.area) { const P = r.force.v / r.area.v; s.lastFn = { cycleKey: 'circle', kind: 'press', outputs: this.unitCycle(PRESS_UNITS, P, 'Pressure', 'Pressure'), idx: 0 }; return this.showOut(s.lastFn.outputs[0]); }
        if (m.size != null && (r.flow || r.vel)) return this.pressureLossFn();
        if (r.press) return this.showOut({ label: 'Pressure', q: clone(r.press) });
        return this.showOut({ label: 'Pressure', text: 'Need force + area', sub: 'or pipe size + flow for loss' });
      }
    }
    throw new Error('Unknown key');
  }
  circleOutputs() {
    const d = this.s.regs.circle; const fam = familyOf(d.unit);
    return [{ label: 'Diameter', q: clone(d), section: 'Circle' },
      { label: 'Area', q: { v: Math.PI / 4 * d.v * d.v, unit: unitFor('area', fam) }, section: 'Circle' },
      { label: 'Circumference', q: { v: Math.PI * d.v, unit: unitFor('len', fam) }, section: 'Circle' }];
  }
  pressureLossFn() {
    const s = this.s; const r = s.regs; const m = s.semi; const d = pipeData(m.mat, m.type, m.size, m.wtvol);
    if (!d) return this.showOut({ label: 'Pressure Loss', text: 'Size not available', sub: '' });
    const V = r.flow ? (r.flow.v / 448.8311688) / (d.area / 144) : r.vel.v;
    const pl = pressureLoss(d.id, V, d.roughFt, m.wtvol);
    const lenFt = r.run ? r.run.v / 12 : null;
    const total = lenFt ? pl.psiPerFt * lenFt : pl.psiPerFt;
    const per = lenFt ? '' : ' per ft';
    const sec = 'Pressure Loss';
    const outs = PRESS_UNITS.map(u => ({ label: UNITS[u].long, q: { v: total, unit: u }, unitText: UNITS[u].label + per, section: sec }));
    outs.splice(1, 0, { label: 'Reynolds Number', q: q(pl.Re, 're'), section: sec });
    s.lastFn = { cycleKey: 'circle', kind: 'ploss', outputs: outs, idx: 0 };
    this.showOut(outs[0]);
  }
  asLen(x) { // a register that wants a length: plain numbers are inches
    const k = kindOf(x); if (k === 'len') return x; if (k === 'num') return q(x.v, 'in');
    throw new Error('Needs a length');
  }
}
