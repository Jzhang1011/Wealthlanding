// Unit tests: node Retirement-simulator/tests/optimize-roth.test.js
// Runs the OptimizeRoth.html projection engine against a stub DOM built from the
// page's own default inputs, then checks the four strategy cards.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'OptimizeRoth.html'), 'utf8');

// Default form values, read from the markup (first element wins for duplicate ids).
const fields = {};
for (const m of html.matchAll(/<input\b[^>]*>/g)) {
  const tag = m[0];
  const id = (tag.match(/\bid="([^"]+)"/) || [])[1];
  if (!id || fields[id]) continue;
  fields[id] = { value: (tag.match(/\bvalue="([^"]*)"/) || [, ''])[1], checked: /\bchecked\b/.test(tag) };
}
for (const m of html.matchAll(/<select\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)) {
  if (fields[m[1]]) continue;
  const opts = [...m[2].matchAll(/<option\b[^>]*value="([^"]*)"([^>]*)>/g)];
  const sel = opts.find(o => /\bselected\b/.test(o[2])) || opts[0];
  fields[m[1]] = { value: sel ? sel[1] : '' };
}

// A do-nothing object for every other DOM call the page makes.
function stub() {
  const fn = function () { return stub(); };
  return new Proxy(fn, {
    get(t, k) {
      if (k === Symbol.toPrimitive) return () => '';
      if (k === 'length') return 0;
      if (k === 'value') return '';
      if (k === 'checked') return false;
      if (k === 'style' || k === 'dataset') return {};
      if (k in t && k !== 'name') return t[k];
      return stub();
    },
    set() { return true; },
    apply() { return stub(); },
    construct() { return stub(); },
  });
}
// Form fields keep their real value/checked; anything else falls through to the stub.
const field = base => new Proxy(base, {
  get(t, k) { return k in t ? t[k] : stub()[k]; },
  set(t, k, v) { t[k] = v; return true; },
});
const elements = {};
const document = new Proxy({}, {
  get(_, k) {
    if (k === 'getElementById') return id => {
      if (!(id in elements)) elements[id] = fields[id] ? field(fields[id]) : stub();
      return elements[id];
    };
    if (k === 'querySelectorAll') return () => [];
    return stub();
  },
});
const store = {};
const ctx = {
  document, console, Intl, Math, Number, JSON, Object, Array, String, Infinity, isFinite, parseFloat, parseInt,
  Chart: function () { return stub(); },
  localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  setTimeout: () => 0, requestAnimationFrame: () => 0, addEventListener() {}, location: { search: '' },
};
ctx.window = ctx;
vm.createContext(ctx);

const start = html.indexOf('<script>', html.indexOf('retirement-os.js')) + '<script>'.length;
const end = html.indexOf('</script>', start);
vm.runInContext(html.slice(start, end) + '\n;this.__api={STRATEGY_LIBRARY,scenarioResult,project};', ctx);
const { STRATEGY_LIBRARY, scenarioResult } = ctx.__api;

const results = {};
for (const def of Object.values(STRATEGY_LIBRARY)) results[def.id] = scenarioResult(def);
const ids = Object.keys(results);
assert.deepStrictEqual(ids.sort(), ['balanced', 'cashflow', 'legacy', 'lowest_tax']);

// 1. Household costs (long-term care, mortgage, college) are the same for every strategy.
//    The bug: they only applied under the 'custom' preset, so Balanced and Lowest Tax paid
//    them and the other two did not, and only those two showed "Estate at 85 $0".
const costsByAge = id => results[id].rows.map(r => [r.age, Math.round(r.ltcSpend), Math.round(r.mortgageSpend), Math.round(r.collegeSpend)]);
for (const id of ids) assert.deepStrictEqual(costsByAge(id), costsByAge('balanced'), id + ' household costs match balanced');
assert(results.cashflow.rows.some(r => r.ltcSpend > 0), 'long-term care modeled for the U.S. cash-flow strategy');
assert(results.legacy.rows.some(r => r.mortgageSpend > 0), 'mortgage modeled for the legacy strategy');

// 2. A $0 estate always comes with a recorded shortfall, and vice versa.
for (const id of ids) {
  const r = results[id];
  const zero = r.term.afterTax <= 0.5;
  assert.strictEqual(zero, r.runsOutAge !== null, `${id}: $0 estate <=> runsOutAge (${r.term.afterTax}, ${r.runsOutAge})`);
  if (r.runsOutAge !== null) assert(r.unfunded > 0, id + ': unfunded spending reported');
  r.rows.forEach(row => assert(row.shortfall >= 0, id + ' shortfall non-negative'));
}

// 3. With no long-term care and no mortgage, the sample household never runs out,
//    so no strategy shows a $0 estate.
fields.ltcAnnualCost.value = '0';
fields.mortgageAnnual.value = '0';
for (const def of Object.values(STRATEGY_LIBRARY)) {
  const r = scenarioResult(def);
  assert(r.term.afterTax > 0, def.id + ' estate positive without LTC/mortgage: ' + r.term.afterTax);
  assert.strictEqual(r.runsOutAge, null, def.id + ' does not run out');
}

console.log('optimize-roth tests passed:', ids.map(id => `${id} estate ${Math.round(results[id].term.afterTax)}${results[id].runsOutAge ? ' (runs out ' + results[id].runsOutAge + ')' : ''}`).join(', '));
