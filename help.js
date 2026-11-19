// Built-in help. Every example's keys are real keystrokes; tests/help.test.mjs replays them
// and checks the result shown here, so the help can't drift from what the app does.
// Key tokens: numbers ("24", "1/8", "3.5"), key ids (in, ft, offset...), C:id = Conv then that key, CA = Clear All.

export const CHAPTERS = ['Basics', 'Math', 'Pipe data', 'Fitting', 'Plumbing'];

export const TOPICS = [
  { id: 'start', chapter: 'Basics', title: 'Getting around', body: `
<p>Each key has two jobs. The big label is what it does on its own. The small red label above it is what it does after you press <kbd>Conv</kbd>. When Conv is armed, CONV shows on the display.</p>
<p>Hold any key for half a second to open its help. Press Conv first, then hold, to get help for its red function.</p>
<p>Swipe left or right across the display to erase the last thing you typed. If you'd rather have a key for that, turn on Backspace key in Settings.</p>
<p>The app saves everything as you go. Close it, reopen it, and it picks up exactly where you left off.</p>` },

  { id: 'entry', chapter: 'Basics', title: 'Entering numbers and dimensions', body: `
<p>Type the number, then press the unit key. Feet and inches go together, and a fraction follows the inches.</p>
<p>Press a unit key twice for square units and three times for cubic. A fraction typed with no unit key is taken as inches.</p>`,
    examples: [
      { keys: 'CC 7 ft 4 in 3/8 =', result: `7' 4 3/8"`, note: 'Feet, inches and a fraction' },
      { keys: 'CC 1/8 =', result: '0 1/8"', note: 'A fraction on its own is inches' },
      { keys: 'CC 30 ft ft =', result: '30.', unit: 'sq feet', note: 'Square feet' },
      { keys: 'CC 2.4 C:mm =', result: '2.400', unit: 'meter', note: 'Meters' },
    ] },

  { id: 'clear', chapter: 'Basics', title: 'Clearing', body: `
<p><kbd>Clear</kbd> once erases what's on the display. Press it twice in a row to also clear the pending math and the offset, run, travel, angle, flow and pressure values.</p>
<p><kbd>Conv</kbd> <kbd>Clear All</kbd> wipes everything: memory, pipe size and material, welder's gap, unit cost and weight per volume all go back to their starting values. Your settings and saved tapes are kept.</p>` },

  { id: 'memory', chapter: 'Basics', title: 'Memory', body: `
<p><kbd>Store</kbd> then a digit 1–9 saves the displayed value; <kbd>Rcl</kbd> and the same digit brings it back, units included.</p>
<p><kbd>M+</kbd> adds the display to a running total and <kbd>Conv</kbd> <kbd>M−</kbd> subtracts. <kbd>Rcl</kbd> <kbd>M+</kbd> shows the total, <kbd>Rcl</kbd> <kbd>Rcl</kbd> shows it and clears it, and <kbd>Conv</kbd> <kbd>MC</kbd> clears it without touching the display. An M on the display means the total isn't zero.</p>
<p><kbd>Rcl</kbd> then a function key shows what's stored there, for example <kbd>Rcl</kbd> <kbd>Offset</kbd>.</p>`,
    examples: [
      { keys: 'CA 12 ft 6 in store 4 CC rcl 4', result: `12' 6"`, note: 'Store and recall a length' },
      { keys: 'CA 20 mplus 35 mplus rcl mplus', result: '55.', note: 'Running total' },
    ] },

  { id: 'settings', chapter: 'Basics', title: 'Settings', body: `
<p>Open Settings from the menu or with <kbd>Conv</kbd> <kbd>Settings</kbd>.</p>
<ul>
<li><b>Math</b>: order of operations (2 + 3 × 4 = 14) or chaining, left to right (= 20).</li>
<li><b>Fractions</b>: round to the nearest 1/2 through 1/64. Standard reduces 8/16 to 1/2; Constant always shows the chosen denominator. Typing a finer fraction, like a 3/32 gap, shows results at that resolution until you press Clear.</li>
<li><b>Area and volume</b>: Standard picks square or cubic feet when feet are involved and inches otherwise. Or force one unit.</li>
<li><b>Weight per volume</b>: the fluid used for filled pipe weight. Water is 62.42796 lb/ft³.</li>
<li><b>Reset</b> puts the calculator and settings back to new. Backspace key, Haptic feedback and your saved tapes are kept.</li>
</ul>` },

  { id: 'tape', chapter: 'Basics', title: 'Tapes and saved files', body: `
<p>The <b>Math</b> tape keeps the last 20 numbers and operators you entered. The <b>Functions</b> tape lists your inputs and every result you looked at, grouped by function. Open them with <kbd>Conv</kbd> <kbd>Tape</kbd> or the tape button at the top.</p>
<p>From the tape you can save it, share it as a file, or open Saved tapes, where you can view, rename, share or delete them. Clearing the calculator empties the current tape but never your saved ones.</p>` },

  { id: 'math', chapter: 'Math', title: 'Dimension math', body: `
<p>Add, subtract, multiply and divide feet, inches and metric lengths directly. The result keeps the units: feet with anything gives feet and inches, length times length gives area, area times length gives volume, and length divided by length gives a plain number.</p>
<p>A plain number added to a dimension is read in that dimension's main unit.</p>`,
    examples: [
      { keys: 'CC 9 ft 10 in 1/4 + 3 ft 7 in 7/8 =', result: `13' 6 1/8"` },
      { keys: 'CC 21 ft 6 in - 8 ft 11 in 1/2 =', result: `12' 6 1/2"` },
      { keys: 'CC 12 ft x 9 ft 6 in =', result: '114.', unit: 'sq feet', note: 'Floor area' },
      { keys: 'CC 20 ft ÷ 2 ft 6 in =', result: '8.', note: 'How many 2′6″ pieces in 20′' },
    ] },

  { id: 'convert', chapter: 'Math', title: 'Converting units', body: `
<p>With a value showing, press a unit key to convert it. Pressing <kbd>Feet</kbd> or <kbd>Inch</kbd> again switches between fractions and decimals; <kbd>Conv</kbd> <kbd>m</kbd> goes to millimeters and then meters.</p>
<p>The red digit functions enter or convert gpm, L/s, cfm, cfs, °F, °C, lbs, gallons, liters and kg. A volume converts to pounds using the stored weight per volume.</p>`,
    examples: [
      { keys: 'CC 5 ft 7 in 3/4 C:ft', result: '5.645833', unit: 'feet', note: 'To decimal feet' },
      { keys: 'CC 6 ft C:mm', result: '1828.8', unit: 'mm' },
      { keys: 'CC 2 ft ft ft = C:8', result: '14.96104', unit: 'gallons', note: '2 cubic feet in gallons' },
      { keys: 'CC 180 C:6 C:3', result: '82.22222', note: '180 °F in °C' },
    ] },

  { id: 'trig', chapter: 'Math', title: 'Trig and degrees-minutes-seconds', body: `
<p><kbd>Sin</kbd>, <kbd>Cos</kbd> and <kbd>Tan</kbd> work on the number showing, in degrees, so <kbd>A</kbd> <kbd>×</kbd> <kbd>angle</kbd> <kbd>Tan</kbd> <kbd>=</kbd> multiplies by the tangent. Conv gives the inverse functions, which return an angle.</p>
<p>Type degrees, minutes and seconds with two dots: 12.30.45 is 12°30′45″. <kbd>Conv</kbd> <kbd>D:M:S</kbd> switches between that and decimal degrees. D:M:S values add and subtract, so they work for hours and minutes too.</p>`,
    examples: [
      { keys: 'CC 48 in x 30 tan =', result: '27 11/16"', note: 'Rise for 48″ of run at 30°' },
      { keys: 'CC 0.6 C:sin', result: '36.87°', note: 'Angle whose sine is 0.6' },
      { keys: 'CC 12.30.45 C:dot', result: '12.51°' },
      { keys: 'CC 3.40.00 + 2.35.00 =', result: `6°15'00"`, note: '3 h 40 min + 2 h 35 min' },
    ] },

  { id: 'circle', chapter: 'Math', title: 'Circles', body: `
<p>Enter a diameter and press <kbd>Circle</kbd>. Press it again for the area, and again for the circumference.</p>`,
    examples: [{ keys: 'CC 18 in circle circle', result: '254.469', unit: 'sq inch', note: 'Area of an 18″ circle' }, { keys: 'circle', result: '56 9/16"', note: 'Then the circumference' }] },

  { id: 'cost', chapter: 'Math', title: 'Cost', body: `
<p>Store a unit price with <kbd>Store</kbd> <kbd>0</kbd>. Then type a quantity and press <kbd>Conv</kbd> <kbd>Cost</kbd> for the total. If you type a multiplication first, Cost totals that instead and leaves the stored price alone.</p>`,
    examples: [{ keys: 'CA 14.75 store 0 36 C:0', result: '$531.00', note: '36 fittings at $14.75' }, { keys: 'CC 8 x 6.40 C:0', result: '$51.20', note: 'A one-off price' }] },

  { id: 'pipe', chapter: 'Pipe data', title: 'Material, type and size', body: `
<p><kbd>Pipe Mat'l</kbd> shows the material; press it again to step through Steel, Stainless, Brass, Aluminum, Cast Iron, PVC and Copper. <kbd>Conv</kbd> <kbd>Pipe Type</kbd> shows the schedule or type; keep pressing <kbd>Pipe Size</kbd> to step through them, or type a schedule number first (80 <kbd>Conv</kbd> <kbd>Pipe Type</kbd>).</p>
<p>Enter a size and press <kbd>Pipe Size</kbd>, then keep pressing it for outside diameter, inside diameter, wall, material, weight per foot, filled weight per foot and inside area. ACR tube is sized by its actual outside diameter.</p>`,
    examples: [
      { keys: 'CA 40 C:size 4 in size size', result: '4.5', note: 'Steel Sch 40, 4″: OD' },
      { keys: 'size', result: '4.026', note: 'ID' },
      { keys: 'size', result: '0.237', note: 'Wall' },
      { keys: 'size size', result: '10.79034', note: 'Weight, lb/ft' },
    ] },

  { id: 'weight', chapter: 'Pipe data', title: 'Weight and capacity', body: `
<p>Filled weight adds the contents using the stored weight per volume. To change the fluid, type its weight and press <kbd>Store</kbd> <kbd>+</kbd>; press <kbd>+</kbd> again to read that number as kg/m³, and again for lb/gal.</p>
<p>For capacity, show the pipe's inside area with <kbd>Conv</kbd> <kbd>Area</kbd>, multiply by a length, and convert to gallons.</p>`,
    examples: [
      { keys: 'CA 4 in size C:sqrt x 100 ft = C:8', result: '66.13124', unit: 'gallons', note: '100′ of 4″ Std steel' },
      { keys: 'CA 7.2 store + + + 4 in size size size size size size size', result: '15.55178', note: 'Filled with a 7.2 lb/gal fluid' },
    ] },

  { id: 'elbow', chapter: 'Pipe data', title: 'Elbow type', body: `
<p><kbd>Conv</kbd> <kbd>Elbow Type</kbd> shows the elbow used for take-outs; keep pressing <kbd>Pipe Mat'l</kbd> to change it.</p>
<ul>
<li><b>Butt Weld - Long</b>: 1.5 × size radius. A factory 45° or 90° uses the ASME B16.9 center-to-end; other angles are figured as cut from a 90.</li>
<li><b>Butt Weld - Short</b>: 1 × size radius, factory 90s.</li>
<li><b>Field Cut - Long / Short</b>: every angle, 45° included, is figured as cut from a 90.</li>
</ul>
<p>Take-outs and cut marks use carbon steel elbow dimensions for the nominal size, whatever the pipe material.</p>` },

  { id: 'offset', chapter: 'Fitting', title: 'Simple offsets', body: `
<p>Enter any two of <kbd>Offset</kbd>, <kbd>Run</kbd>, <kbd>Travel</kbd> and <kbd>Angle/Slope</kbd>, then press the one you want. The two you entered most recently are the ones used.</p>
<p>With a pipe size set, keep pressing <kbd>Travel</kbd> for cut length, take-out, welder's gap, fitting angle and the three cut marks for trimming a 90 down to that angle.</p>`,
    examples: [
      { keys: 'CA 18 in offset 45 angle travel', result: '25 7/16"', note: '18″ offset with 45s' },
      { keys: 'CC 14 in offset 30 in run travel', result: '33 1/8"', note: 'Unknown angle: travel' },
      { keys: 'angle', result: '25.02°', note: '…and the angle' },
    ] },

  { id: 'cut', chapter: 'Fitting', title: 'Cut length and welder\'s gap', body: `
<p>Cut length is the travel minus two take-outs minus two welder's gaps. The gap starts at 1/8″; set it with <kbd>Conv</kbd> <kbd>Welder's Gap</kbd> (0 is fine for socket or threaded work).</p>
<p>For fittings that aren't in the tables, type the take-out and press <kbd>Conv</kbd> <kbd>T.O./Arc</kbd>; it's used instead of the elbow tables until you clear.</p>`,
    examples: [
      { keys: 'CA 4 in size 12 in offset 20 in run travel travel', result: '19 3/4"', note: '4″ LR, gap 1/8″: cut length' },
      { keys: 'travel', result: '1 11/16"', note: 'Take-out' },
      { keys: 'CA 0 C:offset 2 in 1/2 C:angle 16 in offset 45 angle travel travel', result: '17 5/8"', note: 'Known 2½″ take-out, no gap' },
    ] },

  { id: 'rolling', chapter: 'Fitting', title: 'Rolling offsets', body: `
<p>Enter the offset (rise) and either the advance (as <kbd>Run</kbd>) or an angle, then type the roll and press <kbd>Conv</kbd> <kbd>Roll</kbd>. You get the centerline length straight away; keep pressing <kbd>Travel</kbd> for the rest.</p>`,
    examples: [
      { keys: 'CA 20 in offset 36 in run 9 in C:travel', result: '42 1/8"', note: 'Centerline length' },
      { keys: 'travel', result: '31.35°', note: 'Fitting angle' },
    ] },

  { id: 'combo', chapter: 'Fitting', title: 'Two-plane (combination) offsets', body: `
<p>When the entry and exit fittings sit in different planes, they need different angles. Solve the rolling offset first for the length and entry angle. Then make the length a value with <kbd>=</kbd> after viewing it, store it as <kbd>Travel</kbd>, enter the leg that the exit fitting turns from as <kbd>Run</kbd>, and press <kbd>Angle/Slope</kbd> for the exit angle.</p>` },

  { id: 'takeout', chapter: 'Fitting', title: 'Take-outs and cut marks', body: `
<p>With a pipe size and an angle entered, <kbd>Conv</kbd> <kbd>T.O./Arc</kbd> gives the take-out. Keep pressing <kbd>Angle/Slope</kbd> for the inside, center and outside arc lengths to mark on a 90 before cutting it down.</p>`,
    examples: [
      { keys: 'CA 8 in size 22.5 angle C:angle', result: '2 3/8"', note: '8″ LR at 22½°: take-out' },
      { keys: 'angle angle angle', result: '6 3/8"', note: 'Outside arc' },
    ] },

  { id: 'cutback', chapter: 'Fitting', title: 'Cutback for parallel runs', body: `
<p>For pipes running side by side through the same bend, enter the bend angle and the spacing between pipes as <kbd>Offset</kbd>, then press <kbd>Conv</kbd> <kbd>Cutback</kbd>.</p>`,
    examples: [{ keys: 'CC 60 angle 8 in offset C:run', result: '4 5/8"', note: '60° bend, 8″ centers' }] },

  { id: 'slope', chapter: 'Plumbing', title: 'Drop, slope and grade', body: `
<p>Enter a slope per foot as a fraction with <kbd>Angle/Slope</kbd>, a run, and press <kbd>Offset</kbd> for the total drop. Or enter run and drop and press <kbd>Angle/Slope</kbd> repeatedly for slope per foot, angle, percent grade and grade.</p>`,
    examples: [
      { keys: 'CC 1/4 angle 36 ft run offset', result: `0' 9"`, note: '1/4″ per foot over 36′' },
      { keys: 'CC 40 ft run 5 in offset angle', result: '0 1/8"', note: 'Slope per foot' },
    ] },

  { id: 'flow', chapter: 'Plumbing', title: 'Flow and velocity', body: `
<p>Flow = velocity × area. Enter two and press the third: <kbd>Conv</kbd> <kbd>Flow</kbd>, <kbd>Conv</kbd> <kbd>Velocity</kbd> or <kbd>Conv</kbd> <kbd>Area</kbd>. With a pipe size set, its inside area is used. Keep pressing <kbd>(</kbd> or <kbd>)</kbd> to see other units.</p>`,
    examples: [
      { keys: 'CA 3 in size 60 C:lp C:rp', result: '2.603935', note: '60 gpm in 3″ Std steel, ft/s' },
      { keys: 'rp', result: '156.2361', note: 'ft/min' },
    ] },

  { id: 'pressure', chapter: 'Plumbing', title: 'Pressure, force and area', body: `
<p>Enter any two of <kbd>Conv</kbd> <kbd>Force</kbd> (lbf), <kbd>Conv</kbd> <kbd>Pressure</kbd> (psi) and <kbd>Conv</kbd> <kbd>Area</kbd>, then press the third. Keep pressing <kbd>Circle</kbd> to see pressure in psf, inches of mercury, feet of head, bar and kPa.</p>`,
    examples: [{ keys: 'CA 450 C:sq 3 in in C:sqrt C:circle', result: '150.', note: '450 lbf on 3 in²' }, { keys: 'circle circle circle', result: '345.9988', note: 'In feet of head' }] },

  { id: 'loss', chapter: 'Plumbing', title: 'Pressure loss', body: `
<p>Set the pipe material, type and size, enter a flow (or velocity), and press <kbd>Conv</kbd> <kbd>Pressure</kbd>. You get the loss per foot; enter a length as <kbd>Run</kbd> first for the total. Keep pressing <kbd>Circle</kbd> for the Reynolds number and other units.</p>
<p>The loss is for water at about 68 °F (1 centistoke). Below a Reynolds number of 100,000 it uses the smooth-pipe Blasius friction factor; above that, Colebrook with the material's roughness.</p>`,
    examples: [{ keys: 'CA 1 in size 8 C:lp 25 ft run C:circle', result: '0.431452', note: '8 gpm through 25′ of 1″ Std steel, psi' }] },

  { id: 'data', chapter: 'Pipe data', title: 'Where the numbers come from', body: `
<p>Pipe dimensions follow the published standards: ASME B36.10M and B36.19M for steel and stainless, ASTM D1785 and D2241 for PVC, ASTM B88, B306, B280 and B819 for copper, ASTM B43 for brass, CISPI 301 and ASTM A74 for cast iron soil pipe, and ASME B16.9 for elbow center-to-end dimensions. Aluminum uses the steel schedule dimensions.</p>
<p>Weights are figured from the dimensions and a typical density for each material, so they can differ slightly from a mill's catalog. Check critical cuts and loads against your drawings and specs.</p>` },
];

// Which topic a long-press opens, by key id. Conv functions use 'c:' + key id.
export const KEY_HELP = {
  angle: 'offset', offset: 'offset', run: 'offset', travel: 'offset', mat: 'pipe', size: 'pipe',
  pow: 'math', sin: 'trig', cos: 'trig', tan: 'trig', lp: 'math', rp: 'math', circle: 'circle', sq: 'math', sqrt: 'math',
  mm: 'entry', ft: 'entry', in: 'entry', frac: 'entry', clear: 'clear', bksp: 'start', conv: 'start', store: 'memory', rcl: 'memory', mplus: 'memory',
  dot: 'entry', eq: 'math', add: 'math', sub: 'math', mul: 'math', div: 'math',
  'c:angle': 'takeout', 'c:offset': 'cut', 'c:run': 'cutback', 'c:travel': 'rolling', 'c:mat': 'elbow', 'c:size': 'pipe',
  'c:pow': 'math', 'c:sin': 'trig', 'c:cos': 'trig', 'c:tan': 'trig', 'c:lp': 'flow', 'c:rp': 'flow', 'c:circle': 'pressure', 'c:sq': 'pressure', 'c:sqrt': 'pressure',
  'c:mm': 'convert', 'c:ft': 'convert', 'c:in': 'convert', 'c:frac': 'convert', 'c:clear': 'math', 'c:bksp': 'math', 'c:store': 'settings', 'c:rcl': 'memory', 'c:mplus': 'memory',
  'c:0': 'cost', 'c:1': 'convert', 'c:2': 'convert', 'c:3': 'convert', 'c:4': 'convert', 'c:5': 'convert', 'c:6': 'convert', 'c:7': 'convert', 'c:8': 'convert', 'c:9': 'convert',
  'c:dot': 'trig', 'c:eq': 'tape', 'c:add': 'math', 'c:sub': 'math', 'c:mul': 'clear', 'c:div': 'math',
};
for (let d = 0; d <= 9; d++) KEY_HELP[String(d)] = 'entry';
