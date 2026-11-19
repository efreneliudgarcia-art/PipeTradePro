// App shell: keypad, display, panels (help, tape, saved tapes, settings, about), storage, offline.
import { Calculator, DEFAULT_PREFS } from './calculator.js';
import { UNITS } from './units.js';
import { toFrac } from './format.js';
import { SOURCES } from './pipedata.js';
import { TOPICS, CHAPTERS, KEY_HELP } from './help.js';
import { APP } from './config.js';

// ---------- storage (never let a storage error break the calculator) ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  raw(k) { try { return localStorage.getItem(k); } catch { return null; } },
  setRaw(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
};
const K = { prefs: 'pw.prefs', state: 'pw.state', tapes: 'pw.tapes' };
const UI_DEFAULTS = { legacy: false, haptic: false };
let prefs = { ...DEFAULT_PREFS, ...UI_DEFAULTS, ...store.get(K.prefs, {}) };
const enginePrefs = () => { const p = {}; for (const k of Object.keys(DEFAULT_PREFS)) p[k] = prefs[k]; return p; };
const calc = new Calculator(enginePrefs());
{ const saved = store.raw(K.state); if (saved) calc.load(saved); }
let saveTimer = null;
function saveState() { clearTimeout(saveTimer); saveTimer = setTimeout(() => store.setRaw(K.state, calc.serialize()), 120); }
function savePrefs() { store.set(K.prefs, prefs); calc.setPrefs(enginePrefs()); }
addEventListener('pagehide', () => store.setRaw(K.state, calc.serialize()));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') store.setRaw(K.state, calc.serialize()); });

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
document.title = APP.name; $('brand').textContent = APP.name; $('drawerBrand').textContent = APP.name; $('drawerTag').textContent = APP.tagline;

// ---------- keypad ----------
// [id, main label, Conv label, style]
const LAYOUT = [
  [['angle', 'Angle/\nSlope', 'T.O./Arc'], ['offset', 'Offset', "Welder's Gap"], ['run', 'Run', 'Cutback'], ['travel', 'Travel', 'Roll'], ['mat', "Pipe\nMat'l", 'Elbow Type']],
  [['pow', 'xʸ', 'ʸ√x'], ['sin', 'Sin', 'sin⁻¹'], ['cos', 'Cos', 'cos⁻¹'], ['tan', 'Tan', 'tan⁻¹'], ['size', 'Pipe\nSize', 'Pipe Type']],
  [['lp', '(', 'Flow'], ['rp', ')', 'Velocity'], ['circle', 'Circle', 'Pressure'], ['sq', 'x²', 'Force'], ['sqrt', '√x', 'Area']],
  [['mm', 'mm', 'm', 'unitk'], ['ft', 'Feet', '', 'unitk'], ['in', 'Inch', '', 'unitk'], ['frac', '/', 'kg', 'unitk'], ['clear', 'Clear', '%', 'clear']],
  [['conv', 'Conv', '', 'conv'], ['7', '7', 'lbs', 'digit'], ['8', '8', 'gal', 'digit'], ['9', '9', 'liters', 'digit'], ['div', '÷', '1/x', 'op']],
  [['store', 'Store', 'Settings', 'mem'], ['4', '4', 'cfm', 'digit'], ['5', '5', 'cfs', 'digit'], ['6', '6', '°F', 'digit'], ['mul', '×', 'Clear All', 'op']],
  [['rcl', 'Rcl', 'MC', 'mem'], ['1', '1', 'gpm', 'digit'], ['2', '2', 'L/s', 'digit'], ['3', '3', '°C', 'digit'], ['sub', '−', '+/−', 'op']],
  [['mplus', 'M+', 'M−', 'mem'], ['0', '0', 'Cost', 'digit'], ['dot', '.', 'D:M:S', 'digit'], ['eq', '=', 'Tape', 'eq'], ['add', '+', 'π', 'op']],
];
const ARIA = { angle: 'Angle or slope', mat: 'Pipe material', size: 'Pipe size', pow: 'x to the power y', lp: 'Open parenthesis', rp: 'Close parenthesis', sq: 'x squared', sqrt: 'Square root', frac: 'Fraction', div: 'Divide', mul: 'Multiply', sub: 'Minus', add: 'Plus', eq: 'Equals', dot: 'Point', mplus: 'Memory plus', bksp: 'Backspace' };
function buildKeypad() {
  const pad = $('keypad'); pad.innerHTML = '';
  const rows = LAYOUT.map(r => r.map(k => k.slice()));
  if (prefs.legacy) {
    rows[3][4] = ['bksp', '⌫', '%', 'clear'];
    const cell = document.createElement('div'); cell.className = 'cell wide';
    cell.innerHTML = `<div class="alt"></div><button class="key clear wide" data-k="clear" aria-label="Clear">Clear</button>`;
    pad.appendChild(cell);
  }
  pad.style.gridTemplateRows = prefs.legacy ? '0.7fr repeat(8, 1fr)' : 'repeat(8, 1fr)';
  for (const row of rows) for (const [id, main, alt, cls] of row) {
    const cell = document.createElement('div'); cell.className = 'cell';
    const label = esc(main).replace('\n', '<br>');
    cell.innerHTML = `<div class="alt">${esc(alt || '')}</div><button class="key ${cls || ''}" data-k="${id}" aria-label="${esc(ARIA[id] || main.replace('\n', ' '))}${alt ? ', second function ' + esc(alt) : ''}">${label}</button>`;
    pad.appendChild(cell);
  }
}

// Pointer handling that fires each key exactly once: no touch+click double fires.
const active = new Map();
const LONG_MS = 520;
function keyDown(e) {
  const b = e.target.closest('button.key'); if (!b) return;
  e.preventDefault();
  try { b.setPointerCapture(e.pointerId); } catch {}
  b.classList.add('down');
  const st = { b, long: false, t: setTimeout(() => { st.long = true; b.classList.remove('down'); openKeyHelp(b.dataset.k); }, LONG_MS) };
  active.set(e.pointerId, st);
}
function keyUp(e, cancel) {
  const st = active.get(e.pointerId); if (!st) return;
  active.delete(e.pointerId); clearTimeout(st.t); st.b.classList.remove('down');
  if (cancel || st.long) return;
  const r = st.b.getBoundingClientRect();
  if (e.clientX < r.left - 12 || e.clientX > r.right + 12 || e.clientY < r.top - 12 || e.clientY > r.bottom + 12) return;
  pressKey(st.b.dataset.k);
}
const pad = $('keypad');
pad.addEventListener('pointerdown', keyDown);
pad.addEventListener('pointerup', e => keyUp(e, false));
pad.addEventListener('pointercancel', e => keyUp(e, true));
pad.addEventListener('click', e => { const b = e.target.closest('button.key'); if (b && e.detail === 0) pressKey(b.dataset.k); }); // keyboard Enter/Space only
pad.addEventListener('contextmenu', e => e.preventDefault());

function pressKey(id) {
  if (prefs.haptic && navigator.vibrate) { try { navigator.vibrate(12); } catch {} }
  const r = calc.press(id);
  render(); saveState();
  if (r.action === 'tape') openPanel('tape');
  if (r.action === 'prefs') openPanel('settings');
}

// ---------- display ----------
const NICE_UNIT = { 'feet-inch': 'feet · inches' };
function render() {
  const d = calc.getDisplay();
  $('dLabel').textContent = d.label || '';
  const main = $('dMain'); main.textContent = d.main;
  main.className = 'main' + (d.error ? ' err' : '') + (/^[A-Za-z]/.test(d.main) && !d.error ? ' text' : '');
  $('dUnit').textContent = d.error ? d.sub : (d.sub && !d.unit ? d.sub : (NICE_UNIT[d.unit] || d.unit || ''));
  const f = d.flags || {}; const ann = [];
  if (f.conv) ann.push('<span class="conv">CONV</span>');
  if (f.store) ann.push('<span>STO</span>'); if (f.rcl) ann.push('<span>RCL</span>');
  if (f.mem) ann.push('<span>M</span>'); if (f.paren) ann.push(`<span>( ${f.paren}</span>`);
  if (f.op) ann.push(`<span>${esc(f.op)}</span>`); if (f.chain) ann.push('<span>CHAIN</span>');
  $('dAnn').innerHTML = ann.join('');
  $('app').classList.toggle('conv-on', !!f.conv);
  $('tapeDot').hidden = !f.adv;
  drawRuler(d.ruler && !d.error ? d.ruler : null);
  fitMain();
}
function fitMain() {
  const m = $('dMain'); const box = m.parentElement; m.style.fontSize = '';
  let size = parseFloat(getComputedStyle(m).fontSize);
  while (m.scrollWidth > box.clientWidth && size > 22) { size -= 2; m.style.fontSize = size + 'px'; }
}
function drawRuler(r) {
  const svg = $('dRuler');
  if (!r) { svg.innerHTML = ''; return; }
  const den = Math.min(r.res, 32);
  const f = toFrac(Math.abs(r.v), r.res, 'standard'); const pos = f.n / f.d; // fractional inch shown
  const W = 320; let s = '';
  for (let i = 0; i <= den; i++) {
    const x = 2 + (W - 4) * i / den; let h = 6;
    if (i % den === 0) h = 22; else if ((i * 2) % den === 0) h = 18; else if ((i * 4) % den === 0) h = 14; else if ((i * 8) % den === 0) h = 11; else if ((i * 16) % den === 0) h = 8;
    s += `<line x1="${x}" x2="${x}" y1="0" y2="${h}"/>`;
  }
  const mx = 2 + (W - 4) * pos;
  s += `<line class="markline" x1="${mx}" x2="${mx}" y1="0" y2="24"/><path class="mark" d="M${mx - 6} 24 L${mx + 6} 24 L${mx} 15 Z"/>`;
  svg.innerHTML = s;
}
// swipe across the display = backspace
{
  let sx = null, sy = 0;
  const disp = $('display');
  disp.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; });
  disp.addEventListener('pointerup', e => {
    if (sx == null) return; const dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
    if (Math.abs(dx) > 40 && Math.abs(dy) < 40) pressKey('bksp');
  });
  disp.addEventListener('pointercancel', () => { sx = null; });
}
// hardware keyboard (desktop and Chromebooks)
const KEYMAP = { '0': '0', '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9', '.': 'dot', '/': 'frac', '+': 'add', '-': 'sub', '*': 'mul', 'x': 'mul', 'Enter': 'eq', '=': 'eq', 'Backspace': 'bksp', 'Escape': 'clear', '(': 'lp', ')': 'rp', 'f': 'ft', "'": 'ft', 'i': 'in', '"': 'in', 'm': 'mm', 'c': 'conv' };
document.addEventListener('keydown', e => {
  if (!$('panel').hidden || !$('drawer').hidden || $('dialog').open || e.ctrlKey || e.metaKey || e.altKey) return;
  const id = KEYMAP[e.key]; if (!id) return;
  e.preventDefault(); pressKey(id);
});

// ---------- drawer ----------
function openDrawer() { $('drawer').hidden = false; $('scrim').hidden = false; history.pushState({ ui: 'drawer' }, ''); }
function closeDrawer(fromPop) { if ($('drawer').hidden) return; $('drawer').hidden = true; $('scrim').hidden = true; if (!fromPop) history.back(); }
$('menuBtn').addEventListener('click', openDrawer);
$('scrim').addEventListener('click', () => closeDrawer(false));
$('drawer').addEventListener('click', e => {
  const b = e.target.closest('button[data-open]'); if (!b) return;
  const name = b.dataset.open; $('drawer').hidden = true; $('scrim').hidden = true;
  history.replaceState({ ui: 'panel', name }, ''); showPanel(name);
});
$('tapeBtn').addEventListener('click', () => openPanel('tape'));

// ---------- panels (with Android back button support) ----------
let panelStack = [];
function openPanel(name, arg) { history.pushState({ ui: 'panel', name, arg }, ''); showPanel(name, arg); }
function showPanel(name, arg) { panelStack.push({ name, arg }); renderPanel(); }
function renderPanel() {
  const top = panelStack[panelStack.length - 1];
  const p = $('panel'); if (!top) { p.hidden = true; return; }
  p.hidden = false; $('panelActions').innerHTML = ''; $('panelFoot').hidden = true; $('panelFoot').innerHTML = '';
  const old = $('panelBody'); const fresh = old.cloneNode(false); old.replaceWith(fresh); // drop old listeners
  PANELS[top.name](top.arg);
}
$('backBtn').addEventListener('click', () => history.back());
addEventListener('popstate', () => {
  if (!$('drawer').hidden) { closeDrawer(true); return; }
  if ($('dialog').open) { $('dialog').close('cancel'); }
  if (panelStack.length) { panelStack.pop(); renderPanel(); render(); }
});
function setPanel(title, html) { $('panelTitle').textContent = title; $('panelBody').innerHTML = html; }
function setFoot(buttons) { const f = $('panelFoot'); f.hidden = false; f.innerHTML = ''; for (const [label, fn, cls] of buttons) { const b = document.createElement('button'); b.textContent = label; if (cls) b.className = cls; b.addEventListener('click', fn); f.appendChild(b); } }

// ---------- dialog + toast ----------
function ask({ title, text = '', input = null, ok = 'OK', danger = false }) {
  return new Promise(res => {
    const d = $('dialog'); $('dialogTitle').textContent = title; $('dialogText').textContent = text; $('dialogText').hidden = !text;
    const inp = $('dialogInput'); inp.hidden = input == null; inp.value = input || '';
    $('dialogOk').textContent = ok; $('dialogOk').className = danger ? 'danger' : 'primary';
    d.onclose = () => res(d.returnValue === 'ok' ? (input == null ? true : inp.value.trim()) : null);
    d.returnValue = ''; d.showModal(); if (input != null) { inp.focus(); inp.select(); }
  });
}
let toastTimer;
function toast(text, action, fn, ms = 3200) {
  $('toastText').textContent = text; const a = $('toastAction');
  a.hidden = !action; a.textContent = action || ''; a.onclick = () => { $('toast').hidden = true; fn && fn(); };
  $('toast').hidden = false; clearTimeout(toastTimer); if (ms) toastTimer = setTimeout(() => { $('toast').hidden = true; }, ms);
}

// ---------- help ----------
const KEY_NAMES = {}; for (const row of LAYOUT) for (const [id, main, alt] of row) KEY_NAMES[id] = { main: main.replace('/\n', '/').replace('\n', ' '), alt };
KEY_NAMES.bksp = { main: '⌫', alt: '%' };
function keysHtml(keys) {
  const out = [];
  for (const tok of keys.trim().split(/\s+/)) {
    if (tok === 'CA') { out.push('<kbd class="c">Conv</kbd>', '<kbd>Clear All</kbd>'); continue; }
    if (tok === 'CC') { out.push('<kbd>Clear</kbd>', '<kbd>Clear</kbd>'); continue; }
    if (tok.startsWith('C:')) { const id = tok.slice(2); out.push('<kbd class="c">Conv</kbd>', `<kbd>${esc(KEY_NAMES[id] ? (KEY_NAMES[id].alt || KEY_NAMES[id].main) : id)}</kbd>`); continue; }
    const sym = { '+': 'add', '-': 'sub', x: 'mul', '÷': 'div', '=': 'eq', '(': 'lp', ')': 'rp' }[tok];
    if (sym) { out.push(`<kbd>${esc(KEY_NAMES[sym].main)}</kbd>`); continue; }
    if (KEY_NAMES[tok]) { out.push(`<kbd${/^\d$/.test(tok) ? ' class="n"' : ''}>${esc(KEY_NAMES[tok].main)}</kbd>`); continue; }
    if (/^[0-9.]+\/[0-9]+$/.test(tok)) { const [a, b] = tok.split('/'); out.push(`<kbd class="n">${a}</kbd>`, '<kbd>/</kbd>', `<kbd class="n">${b}</kbd>`); continue; }
    out.push(`<kbd class="n">${esc(tok)}</kbd>`);
  }
  return out.join(' ');
}
function topicHtml(t) {
  let h = t.body.replace(/<kbd>([^<]*)<\/kbd>/g, (m, s) => s === 'Conv' ? '<kbd class="c">Conv</kbd>' : m);
  for (const ex of t.examples || []) {
    h += `<div class="example"><div class="keys">${keysHtml(ex.keys)}</div><div class="res"><small>${esc(ex.note || 'Shows')}</small><span>${esc(ex.result)}${ex.unit ? ' ' + esc(ex.unit) : ''}</span></div></div>`;
  }
  return h;
}
function openKeyHelp(id) {
  const conv = calc.s.conv; calc.s.conv = false; render();
  const topic = KEY_HELP[(conv ? 'c:' : '') + id] || KEY_HELP[id] || 'start';
  openPanel('topic', topic);
}

// ---------- tapes ----------
function mathTapeHtml(tape) {
  if (!tape.length) return '<p class="empty">Nothing on the math tape yet. Numbers and operators show here as you calculate.</p>';
  return `<table class="tape">${tape.map(r => `<tr class="${r.op === 'Total' ? 'total' : ''}"><td class="n">${String(r.n).padStart(2, '0')}</td><td class="v">${esc(r.text)}</td><td class="u">${esc(r.unit || '')}</td><td class="op">${esc(r.op === 'Total' ? '' : r.op)}</td></tr>`).join('')}</table>`;
}
const SEC_COLORS = ['#3D4A58', '#5B4B8A', '#2F6B4F', '#8A4B2F', '#2F5E8A', '#7A6A1E', '#6B2F5E'];
function advTapeHtml(adv) {
  if (!adv.length) return '<p class="empty">Nothing on the functions tape yet. Inputs and results from pipe, offset and flow keys collect here.</p>';
  let i = 0;
  return adv.map(sec => `<div class="adv-sec"><h4 style="background:${sec.title === 'Input' ? '#2A2E33' : SEC_COLORS[(i++) % SEC_COLORS.length]}">${esc(sec.title)}</h4>${sec.rows.map(r => `<div class="r"><span>${esc(r.label)}</span><b>${esc(r.main)} <small>${esc(r.unit || '')}</small></b></div>`).join('')}</div>`).join('');
}
function tapeDocument(name, mathHtml, advHtml) {
  const css = `body{font-family:Arial,sans-serif;margin:24px;color:#111}h1{font-size:20px}h2{font-size:16px;margin-top:24px}table{border-collapse:collapse;width:100%;max-width:520px}td{padding:6px 8px;border-bottom:1px solid #ddd}td.v{text-align:right;font-weight:bold}td.n,td.u{color:#666}.adv-sec{max-width:520px;margin-bottom:12px;border:1px solid #ccc}.adv-sec h4{margin:0;padding:6px 10px;color:#fff;background:#3D4A58}.r{display:flex;justify-content:space-between;padding:6px 10px;border-top:1px solid #eee}.empty{color:#666}tr.total td{background:#FFF4C2}`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(name)}</title><style>${css}</style></head><body><h1>${esc(name)}</h1><p>${esc(APP.name)} · ${new Date().toLocaleString()}</p><h2>Math tape</h2>${mathHtml}<h2>Functions tape</h2>${advHtml}</body></html>`;
}
async function shareDoc(name, html) {
  const fname = (name.replace(/[^\w\- ]+/g, '').trim() || 'tape').replace(/\s+/g, '-') + '.html';
  try {
    const file = new File([html], fname, { type: 'text/html' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' })); a.download = fname;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  toast('Tape downloaded as ' + fname);
}
const tapes = () => store.get(K.tapes, []);
const setTapes = t => store.set(K.tapes, t);
function defaultName() { const d = new Date(); return `Tape ${d.getMonth() + 1}-${d.getDate()} ${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`; }

// ---------- settings ----------
function seg(name, value, options) {
  return `<div class="seg" role="radiogroup">${options.map(([v, l]) => `<label><input type="radio" name="${name}" value="${esc(v)}" ${String(value) === String(v) ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div>`;
}
function sw(name, on) { return `<label class="switch"><input type="checkbox" name="${name}" ${on ? 'checked' : ''} aria-label="${esc(name)}"><span></span></label>`; }
function parseLen(str) { // "1/8", "0.125", "1 1/2" -> inches
  const s = String(str).trim(); let m;
  if ((m = s.match(/^(\d+(?:\.\d+)?)\s+(\d+)\/(\d+)$/))) return +m[1] + m[2] / m[3];
  if ((m = s.match(/^(\d+)\/(\d+)$/))) return m[1] / m[2];
  if (/^\d*\.?\d+$/.test(s)) return parseFloat(s);
  return NaN;
}

const PANELS = {
  help() {
    setPanel('Help', `<input class="search" id="hs" type="search" placeholder="Search help" aria-label="Search help"><div class="toc" id="toc"></div>`);
    const draw = qv => {
      const qq = qv.trim().toLowerCase();
      const list = TOPICS.filter(t => !qq || (t.title + ' ' + t.body.replace(/<[^>]+>/g, ' ')).toLowerCase().includes(qq));
      $('toc').innerHTML = list.length ? CHAPTERS.map(ch => { const ts = list.filter(t => t.chapter === ch); return ts.length ? `<h3>${esc(ch)}</h3>` + ts.map(t => `<button data-t="${t.id}">${esc(t.title)}</button>`).join('') : ''; }).join('') : `<p class="empty">No topics match “${esc(qv)}”.</p>`;
    };
    draw('');
    $('hs').addEventListener('input', e => draw(e.target.value));
    $('toc').addEventListener('click', e => { const b = e.target.closest('button[data-t]'); if (b) openPanel('topic', b.dataset.t); });
  },
  topic(id) {
    const i = TOPICS.findIndex(t => t.id === id); const t = TOPICS[i] || TOPICS[0];
    const prev = TOPICS[i - 1], next = TOPICS[i + 1];
    setPanel(t.title, topicHtml(t) + `<div class="pager">${prev ? `<button class="btn" data-go="${prev.id}">‹ ${esc(prev.title)}</button>` : '<span></span>'}${next ? `<button class="btn" data-go="${next.id}">${esc(next.title)} ›</button>` : '<span></span>'}</div><p class="muted" style="margin-top:18px"><a href="#" id="allTopics">All help topics</a></p>`);
    $('panelBody').querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { panelStack[panelStack.length - 1].arg = b.dataset.go; history.replaceState({ ui: 'panel', name: 'topic', arg: b.dataset.go }, ''); renderPanel(); }));
    $('allTopics').addEventListener('click', e => { e.preventDefault(); openPanel('help'); });
  },
  tape(tab) {
    tab = tab || (calc.getAdvancedTape().length && !calc.getTape().length ? 'adv' : 'math');
    const math = calc.getTape(), adv = calc.getAdvancedTape();
    setPanel('Tape', `<div class="tabs" role="tablist"><button role="tab" aria-selected="${tab === 'math'}" data-tab="math">Math</button><button role="tab" aria-selected="${tab === 'adv'}" data-tab="adv">Functions</button></div>${tab === 'math' ? mathTapeHtml(math) : advTapeHtml(adv)}<p class="muted">Clearing the calculator (Clear twice, or Clear All) empties this tape. Saved tapes are kept.</p>`);
    $('panelBody').querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { panelStack[panelStack.length - 1].arg = b.dataset.tab; renderPanel(); }));
    const empty = !math.length && !adv.length;
    setFoot([
      ['Save', async () => {
        if (empty) return toast('The tape is empty. Do a calculation first.');
        const name = await ask({ title: 'Save tape', text: 'Name it (25 characters max).', input: defaultName(), ok: 'Save' });
        if (!name) return; const list = tapes();
        list.unshift({ id: Date.now().toString(36), name: name.slice(0, 25), created: Date.now(), math: mathTapeHtml(math), adv: advTapeHtml(adv) });
        if (setTapes(list)) toast('Saved “' + name.slice(0, 25) + '”', 'View', () => openPanel('saved')); else toast('Could not save: storage is full. Delete some saved tapes.');
      }],
      ['Share', () => { if (empty) return toast('The tape is empty. Do a calculation first.'); const n = defaultName(); shareDoc(n, tapeDocument(n, mathTapeHtml(math), advTapeHtml(adv))); }],
      ['Saved tapes', () => openPanel('saved'), 'primary'],
    ]);
  },
  saved() {
    const list = tapes();
    setPanel('Saved tapes', list.length ? list.map(t => `<div class="saved-item" data-id="${t.id}"><div class="t">${esc(t.name)}</div><div class="d">${new Date(t.created).toLocaleString()}</div><div class="acts"><button class="btn primary" data-a="view">View</button><button class="btn" data-a="share">Share</button><button class="btn" data-a="rename">Rename</button><button class="btn danger" data-a="delete">Delete</button></div></div>`).join('') : '<p class="empty">No saved tapes. Open the tape and tap Save to keep one.</p>');
    if (list.length) setFoot([['Delete all', async () => { if (await ask({ title: 'Delete all saved tapes?', text: `This deletes ${list.length} saved tape${list.length > 1 ? 's' : ''}. The current tape and your settings stay.`, ok: 'Delete all', danger: true })) { setTapes([]); renderPanel(); toast('Deleted all saved tapes'); } }, 'danger']]);
    $('panelBody').addEventListener('click', async e => {
      const b = e.target.closest('button[data-a]'); if (!b) return;
      const id = b.closest('.saved-item').dataset.id; const all = tapes(); const t = all.find(x => x.id === id); if (!t) return;
      if (b.dataset.a === 'view') openPanel('savedView', id);
      if (b.dataset.a === 'share') shareDoc(t.name, tapeDocument(t.name, t.math, t.adv));
      if (b.dataset.a === 'rename') { const n = await ask({ title: 'Rename tape', input: t.name, ok: 'Rename' }); if (n) { t.name = n.slice(0, 25); setTapes(all); renderPanel(); toast('Renamed to “' + t.name + '”'); } }
      if (b.dataset.a === 'delete') { if (await ask({ title: `Delete “${t.name}”?`, ok: 'Delete', danger: true })) { setTapes(all.filter(x => x.id !== id)); renderPanel(); toast('Deleted “' + t.name + '”'); } }
    });
  },
  savedView(id) {
    const t = tapes().find(x => x.id === id);
    if (!t) { setPanel('Saved tape', '<p class="empty">This tape was deleted.</p>'); return; }
    setPanel(t.name, `<p class="muted">${new Date(t.created).toLocaleString()}</p><h3>Math</h3>${t.math}<h3>Functions</h3>${t.adv}`);
    setFoot([['Share', () => shareDoc(t.name, tapeDocument(t.name, t.math, t.adv)), 'primary']]);
  },
  settings() {
    const st = calc.getStored();
    const wvUnit = prefs.wtvolUnit || 'lbft3';
    const wvShown = +(st.wtvol / UNITS[wvUnit].f).toPrecision(7);
    setPanel('Settings', `
<div class="group"><h3>General</h3>
 <div class="row"><div class="row-head"><span class="name">Backspace key</span>${sw('legacy', prefs.legacy)}</div><div class="help">Adds a ⌫ key where Clear is and moves Clear to its own row. Swiping the display always works too.</div></div>
 <div class="row"><div class="row-head"><span class="name">Haptic feedback</span>${sw('haptic', prefs.haptic)}</div><div class="help">A short buzz on each key press, on phones that support it.</div></div>
 <div class="row"><span class="name">Math</span>${seg('math', prefs.math, [['aos', 'Order of operations'], ['chain', 'Chaining']])}</div>
</div>
<div class="group"><h3>Display</h3>
 <div class="row"><span class="name">Fraction resolution</span>${seg('fracRes', prefs.fracRes, [[2, '1/2'], [4, '1/4'], [8, '1/8'], [16, '1/16'], [32, '1/32'], [64, '1/64']])}</div>
 <div class="row"><span class="name">Fraction mode</span>${seg('fracMode', prefs.fracMode, [['standard', 'Standard (8/16 → 1/2)'], ['constant', 'Constant']])}</div>
 <div class="row"><span class="name">Area</span>${seg('areaDisplay', prefs.areaDisplay, [['std', 'Standard'], ['ft2', 'sq ft'], ['in2', 'sq in'], ['m2', 'sq m']])}</div>
 <div class="row"><span class="name">Volume</span>${seg('volDisplay', prefs.volDisplay, [['std', 'Standard'], ['ft3', 'cu ft'], ['m3', 'cu m']])}</div>
 <div class="row"><span class="name">Meters</span>${seg('meters', prefs.meters, [['fixed', '0.000'], ['float', 'Float']])}</div>
 <div class="row"><span class="name">Decimal degrees</span>${seg('degrees', prefs.degrees, [['fixed', '0.00'], ['float', 'Float']])}</div>
</div>
<div class="group"><h3>Stored values</h3>
 <div class="row"><span class="name">Weight per volume</span><div class="field"><input id="wv" inputmode="decimal" value="${wvShown}" aria-label="Weight per volume"><select id="wvu" aria-label="Unit">${['lbft3', 'kgm3', 'lbgal'].map(u => `<option value="${u}" ${u === wvUnit ? 'selected' : ''}>${UNITS[u].label}</option>`).join('')}</select></div><div class="help">Used for filled pipe weight. Water is 62.42796 lb/ft³.</div></div>
 <div class="row"><span class="name">Welder's gap</span><div class="field"><input id="gap" inputmode="decimal" value="${toFrac(st.gap, 64).n ? (toFrac(st.gap, 64).whole ? toFrac(st.gap, 64).whole + ' ' : '') + toFrac(st.gap, 64).n + '/' + toFrac(st.gap, 64).d : toFrac(st.gap, 64).whole}" aria-label="Welder's gap in inches"><span>inch</span></div><div class="help">Subtracted twice from cut lengths. Type 1/8, 3/32 or 0.</div></div>
 <div class="row"><span class="name">Unit cost</span><div class="field"><span>$</span><input id="uc" inputmode="decimal" value="${st.unitCost}" aria-label="Unit cost"></div></div>
</div>
<div class="group"><h3>Reset</h3>
 <div class="row"><div class="help">Puts the calculator and these settings back to new. Backspace key, haptic feedback and saved tapes are kept.</div><button class="btn danger" id="resetBtn">Reset calculator and settings</button></div>
</div>`);
    const body = $('panelBody');
    body.addEventListener('change', e => {
      const t = e.target;
      if (t.type === 'checkbox') { prefs[t.name] = t.checked; savePrefs(); if (t.name === 'legacy') buildKeypad(); }
      else if (t.type === 'radio') { prefs[t.name] = t.name === 'fracRes' ? +t.value : t.value; savePrefs(); }
      else if (t.id === 'wv' || t.id === 'wvu') {
        const v = parseFloat($('wv').value); const u = $('wvu').value;
        if (t.id === 'wvu' && isFinite(v)) { /* keep the same fluid, show it in the new unit */ prefs.wtvolUnit = u; savePrefs(); $('wv').value = +(calc.getStored().wtvol / UNITS[u].f).toPrecision(7); return; }
        if (!(v > 0)) { toast('Enter a weight per volume above zero.'); $('wv').value = +(calc.getStored().wtvol / UNITS[u].f).toPrecision(7); return; }
        calc.setStored({ wtvol: v * UNITS[u].f }); prefs.wtvolUnit = u; savePrefs(); saveState();
      } else if (t.id === 'gap') {
        const g = parseLen(t.value); if (!(g >= 0) || g > 2) { toast('Type the gap in inches, like 1/8 or 0.125.'); return; }
        calc.setStored({ gap: g }); saveState();
      } else if (t.id === 'uc') {
        const c = parseFloat(t.value); if (!(c >= 0)) { toast('Type a price, like 14.75.'); return; }
        calc.setStored({ unitCost: c }); saveState();
      }
      render();
    });
    $('resetBtn').addEventListener('click', async () => {
      if (!await ask({ title: 'Reset calculator and settings?', text: 'Memory, pipe selections, stored values and display settings go back to new. Saved tapes are kept.', ok: 'Reset', danger: true })) return;
      const keep = { legacy: prefs.legacy, haptic: prefs.haptic };
      prefs = { ...DEFAULT_PREFS, ...UI_DEFAULTS, ...keep }; savePrefs(); calc.reset(); saveState(); buildKeypad(); render(); renderPanel(); toast('Calculator and settings reset');
    });
  },
  about() {
    setPanel('About', `
<h3>${esc(APP.name)} ${esc(APP.version)}</h3>
<p>A calculator for pipefitters: feet-inch-fraction math, pipe data for seven materials, simple and rolling offsets, take-outs and cut marks, drop and slope, flow, velocity, pressure and pressure loss.</p>
<p>It runs entirely on your phone. Nothing you type is sent anywhere, there are no ads or accounts, and it works with no signal once it's installed.</p>
<h3>Where the numbers come from</h3>
<ul>${SOURCES.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
<p class="muted">Pressure loss uses water at 1 cSt: Blasius friction below a Reynolds number of 100,000, Colebrook with material roughness above.</p>
<h3>Use with judgment</h3>
<p>Results are only as good as the inputs and the standard dimensions behind them. Check critical cuts, weights and pressures against your drawings, specs and the manufacturer's data before you cut or build.</p>
<h3>Credits</h3>
<p class="muted">Type: Barlow, by Jeremy Tribby, under the SIL Open Font License. Pipe schedule tables cross-checked against the open-source fluids library (MIT).</p>
<p class="muted" id="offlineState"></p>`);
    const s = $('offlineState');
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) s.textContent = 'Offline ready: this version is saved on your device.';
    else s.textContent = 'Not saved for offline use yet. Open the app once with a connection and it will be.';
  },
};

// ---------- install + offline ----------
let installEvt = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; $('installBtn').hidden = false; });
$('installBtn').addEventListener('click', async () => { closeDrawer(false); if (!installEvt) return; installEvt.prompt(); try { await installEvt.userChoice; } catch {} installEvt = null; $('installBtn').hidden = true; });
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading) return; reloading = true; location.reload(); });
  navigator.serviceWorker.register('sw.js').then(reg => {
    const offer = w => toast('A new version is ready.', 'Update', () => w.postMessage('skipWaiting'), 0);
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => { const w = reg.installing; w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); }); });
  }).catch(() => {});
}

// ---------- start ----------
history.replaceState({ ui: 'calc' }, '');
buildKeypad(); render();
addEventListener('resize', fitMain);
window.__pw = { calc, pressKey, render, openPanel }; // used by the automated UI test
