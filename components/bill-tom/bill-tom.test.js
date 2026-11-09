// Unit tests: node components/bill-tom/bill-tom.test.js
// Both Bill and Tom pages must show the numbers the shared calculation produces.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const BT = require('./bill-tom.js');

const root = path.join(__dirname, '..', '..');
const s = BT.story();
const A = BT.ASSUMPTIONS;

// Tax function: 2026 married-filing-jointly brackets after the standard deduction.
assert.strictEqual(BT.ordinaryTax(A.standardDeduction, 1, A), 0);
assert.strictEqual(Math.round(BT.ordinaryTax(100800 + A.standardDeduction, 1, A)), 2480 + 9120);

// Same start, same returns: only conversions differ.
assert.strictEqual(s.tom.totalConverted, 0, 'Tom converts nothing');
assert(s.bill.totalConverted > 0, 'Bill converts');
assert(s.bill.heirs > s.tom.heirs, 'Bill leaves more after tax in this illustration');
for (const who of ['bill', 'tom']) {
  const r = s[who];
  assert(Math.abs(r.heirs - (r.brokerage + r.roth + r.traditional * (1 - A.heirTaxRate))) < 1, who + ' heirs identity');
  r.rows.forEach(row => ['trad', 'brok', 'roth'].forEach(k => assert(row[k] >= -1, `${who} ${k} at ${row.age} non-negative`)));
}
// Bill's conversions keep all ordinary income inside the target bracket.
s.bill.rows.filter(r => r.conv > 0).forEach(r => {
  const idx = Math.pow(1 + A.inflationPct, r.age - A.startAge);
  const ss = r.age >= A.ssStartAge ? A.socialSecurity * idx * A.ssTaxablePct : 0;
  assert(ss + r.rmd + r.conv + r.extra <= (A.conversionBracketTop + A.standardDeduction) * idx + 2, 'bracket cap at ' + r.age);
});

// Every data-bt value written into the pages matches the calculation.
const pages = ['Retirement-simulator/Retirement_Gateway.html', 'blogs/Happy_retirement/how-to-avoid-RMD-taxes.html'];
let count = 0;
for (const p of pages) {
  const html = fs.readFileSync(path.join(root, p), 'utf8');
  assert(html.includes('/components/bill-tom/bill-tom.js'), p + ' loads bill-tom.js');
  for (const m of html.matchAll(/data-bt="(\w+)"[^>]*>([^<]*)</g)) {
    assert(m[1] in s.text, `${p}: unknown key ${m[1]}`);
    assert.strictEqual(m[2], s.text[m[1]], `${p}: ${m[1]} shows "${m[2]}", calculation gives "${s.text[m[1]]}"`);
    count++;
  }
}
// The article headline and the guide/link text use the same rounded figures.
const headline = `Bill Left $${s.text.billShort.slice(1, -1)} Million. Tom Left $${s.text.tomShort.slice(1, -1)} Million.`;
for (const p of [...pages.slice(1), 'blogs/happy_retirement.html', 'blogs/Happy_retirement/archive.json', 'components/tool-guides/tool-guides.json', 'retirement-confidence/withdrawal-sequence/index.html']) {
  assert(fs.readFileSync(path.join(root, p), 'utf8').includes(headline), p + ' uses headline ' + headline);
}

console.log(`bill-tom tests passed (${count} page values): Bill ${s.text.billHeirs}, Tom ${s.text.tomHeirs}, gap ${s.text.gap}`);
