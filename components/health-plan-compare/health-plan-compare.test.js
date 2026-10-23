// Unit tests: node components/health-plan-compare/health-plan-compare.test.js
const M = require('./health-plan-compare.js');
const cfg = require('./presets.json');
const assert = require('assert');
const near = (a, b, m) => assert(Math.abs(a - b) < 1e-6, (m || '') + ' expected ' + b + ' got ' + a);
const base = { premium: 100, deductible: 1000, deductibleOut: 2000, coinsIn: 20, coinsOut: 40, oopIn: 3000, oopOut: 6000, employerFund: 0, hdhp: false, copays: { primary: 30, specialist: 50, urgent: 100, rx: 10 } };
const o = { periods: 12, share: 1 };
// premium only at $0
near(M.annualCost(base, 0, o), 1200, 'premium');
// within deductible: dollar for dollar
near(M.annualCost(base, 600, o), 1800);
// after deductible: 1000 + 20% of 4000 = 1800
near(M.annualCost(base, 5000, o), 3000);
// cap: OOP max 3000 reached at 1000 + 2000/0.2 = 11000
near(M.annualCost(base, 11000, o), 4200); near(M.annualCost(base, 50000, o), 4200);
assert.deepStrictEqual(M.kinks(base, o).sort((a, b) => a - b), [1000, 11000]);
// employer fund reduces cost
near(M.annualCost(Object.assign({}, base, { employerFund: 500 }), 0, o), 700);
// out-of-network split: 50% in network
const h = { periods: 12, share: 0.5 };
// x=4000 -> in 2000: 1000+200=1200; out 2000: 2000 (deductible) -> 3200 + 1200 premium
near(M.annualCost(base, 4000, h), 4400);
// OON cap: out track caps at 6000: 2000+0.4(t-2000)=6000 -> t=12000 -> x=24000
assert(M.kinks(base, h).some(k => Math.abs(k - 24000) < 1e-9));
// unlimited OON -> worst case Infinity; fully in-network finite
assert.strictEqual(M.worstCase(Object.assign({}, base, { oopOut: null }), h), Infinity);
near(M.worstCase(base, o), 4200);
// HMO not covered OON: 100% coinsurance, no cap -> pays every OON dollar
const hmo = Object.assign({}, base, { deductibleOut: 0, coinsOut: 100, oopOut: null });
near(M.annualCost(hmo, 1000, { periods: 12, share: 0 }), 2200);
// copays counted toward in-network OOP max
const v = { primary: 10, specialist: 0, urgent: 0, rx: 0 };
near(M.copayTotal(base, v), 300);
near(M.annualCost(base, 0, Object.assign({ visits: v }, o)), 1500);
near(M.annualCost(base, 1e6, Object.assign({ visits: v }, o)), 4200, 'copays share the OOP cap');
near(M.copayTotal(Object.assign({}, base, { hdhp: true }), v), 0, 'HDHP ignores copays');
// cap below deductible
const low = Object.assign({}, base, { deductible: 5000, oopIn: 2000 });
assert.deepStrictEqual(M.kinks(low, o), [2000]); near(M.annualCost(low, 9000, o), 3200);
// break-even: A premium 3000, ded 0, coins 0 (flat) vs B premium 1000, ded 4000, coins 20%, oop 6000
const A = { premium: 3000, deductible: 0, coinsIn: 0, oopIn: 0, deductibleOut: 0, coinsOut: 0, oopOut: 0 };
const B = { premium: 1000, deductible: 4000, coinsIn: 20, oopIn: 6000, deductibleOut: 0, coinsOut: 0, oopOut: 0 };
const one = { periods: 1, share: 1 };
let be = M.breakEvens(A, B, one, 50000);
assert.strictEqual(be.length, 1); near(be[0].x, 2000); near(be[0].cost, 3000);
// crossing in the coinsurance segment: A flat 6000 -> B 1000+4000+0.2(x-4000)=6000 -> x=9000
be = M.breakEvens(Object.assign({}, A, { premium: 6000 }), B, one, 50000);
assert.strictEqual(be.length, 1); near(be[0].x, 9000);
// lines that never cross
assert.strictEqual(M.breakEvens(Object.assign({}, A, { premium: 9000 }), B, one, 1e6).length, 0);
// two crossings: C crosses B twice
const C = { premium: 2000, deductible: 0, coinsIn: 50, oopIn: 2500, deductibleOut: 0, coinsOut: 0, oopOut: 0 };
be = M.breakEvens(C, B, one, 1e6).map(e => e.x);
// C: 2000+0.5x (cap 4500 at x=5000); B: 1000+x until 4000 -> 1000+x=2000+.5x -> x=2000; then B=5000+.2(x-4000) vs C=4500 const -> never; check
assert.deepStrictEqual(be.map(x => Math.round(x * 1e6) / 1e6), [2000]);
// symmetric results and each break-even is a true equality
const P = cfg.plans, opt = { periods: cfg.defaults.freq, share: 1 };
for (let a = 0; a < P.length; a++) for (let b = a + 1; b < P.length; b++) {
  const r = M.breakEvens(P[a], P[b], opt, 1e6);
  r.forEach(e => near(M.annualCost(P[a], e.x, opt), M.annualCost(P[b], e.x, opt), 'equality'));
  assert.deepStrictEqual(r.map(e => e.x.toFixed(6)), M.breakEvens(P[b], P[a], opt, 1e6).map(e => e.x.toFixed(6)));
  console.log(P[a].name, 'vs', P[b].name, r.map(e => e.x.toFixed(2)).join(', ') || 'none');
}
// auto x range is a nice number covering every kink
const xm = M.autoXMax(P, opt); assert(P.every(p => M.kinks(p, opt).every(k => k <= xm)));
console.log('auto x max', xm);
console.log('ALL TESTS PASSED');
