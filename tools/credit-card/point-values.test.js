// Unit tests: node tools/credit-card/point-values.test.js
// Keeps the Card Rewards Router on one set of point values (tools/credit-card/point-values.js).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const PV = require('./point-values.js');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

// 1. Every currency has a numeric value and a floor that is null or not above the value.
Object.entries(PV.currencies).forEach(([key, c]) => {
  assert(typeof c.value === 'number' && c.value > 0, key + ' value');
  assert(c.cashOut === null || (typeof c.cashOut === 'number' && c.cashOut <= c.value), key + ' cashOut <= value');
});
assert(/assumption/i.test(PV.basis), 'basis says the values are assumptions');

// 2. The planner cards' authored ptVal must equal the shared default for their currency,
//    otherwise the planner and the Quick Check would disagree out of the box.
const cardRe = /^\s{2}(\w+):\s*\{ name:"([^"]+)"[^\n]*?ptVal:([\d.]+), ptCur:"([^"]+)"/gm;
let m, checked = 0;
while ((m = cardRe.exec(html))) {
  const [, id, , ptVal, ptCur] = m;
  const key = PV.plannerCurrency[ptCur];
  if (!key) { assert.strictEqual(Number(ptVal), 1, id + ': non-point card should be 1 cent'); continue; }
  assert.strictEqual(Number(ptVal), PV.currencies[key].value, `${id}: ptVal ${ptVal} != ${key} ${PV.currencies[key].value}`);
  checked++;
}
assert(checked >= 20, 'planner cards found: ' + checked);

// 3. No second hard-coded table of point values in the page.
assert(!/transfer:\s*\d/.test(html), 'page must not hard-code transfer values');
assert(/DEFAULT_POINT_VALUES\[key\] = \{ name: c\.name, cashOut: c\.cashOut, transfer: c\.value \}/.test(html), 'defaults derived from point-values.js');

// 4. The static no-JS summary lists the same values.
const summary = (html.match(/<span id="pv-summary">([^<]+)<\/span>/) || [])[1] || '';
const nums = (summary.match(/[\d.]+(?=¢)/g) || []).map(Number);
assert.deepStrictEqual(nums, Object.values(PV.currencies).map(c => c.value), 'static summary matches data');

// 5. Rescaling: run the page's own uApplyPointValues on its UNLOCK_CARDS.
const vm = require('vm');
const start = html.indexOf('const UNLOCK_CARDS = {');
const end = html.indexOf('\n}', html.indexOf('function uApplyPointValues')) + 2;
const ctx = { window: { WL_POINT_VALUES: PV }, uLineCache: { stale: 1 } };
vm.createContext(ctx);
vm.runInContext(html.slice(start, end) + '\nthis.UNLOCK_CARDS = UNLOCK_CARDS; this.uApplyPointValues = uApplyPointValues;', ctx);
const vals = {};
Object.entries(PV.currencies).forEach(([k, c]) => { vals[k] = { transfer: c.value }; });
const before = ctx.UNLOCK_CARDS.vx.rates.other;
ctx.uApplyPointValues(vals);
assert.strictEqual(ctx.UNLOCK_CARDS.vx.rates.other, before, 'defaults leave planner rates unchanged');
assert.deepStrictEqual(Object.keys(ctx.uLineCache), [], 'line cache cleared');
vals.c1.transfer = 2.0;
ctx.uApplyPointValues(vals);
assert.strictEqual(ctx.UNLOCK_CARDS.vx.ptVal, 2.0);
assert.strictEqual(ctx.UNLOCK_CARDS.vx.rates.other, 4, 'Venture X 2x miles at 2.0 cents = 4 cents per dollar');
vals.c1.transfer = 1.5;
ctx.uApplyPointValues(vals);
assert.strictEqual(ctx.UNLOCK_CARDS.vx.rates.other, 3, 'back to default');

console.log('point-values tests passed (' + checked + ' planner cards)');
