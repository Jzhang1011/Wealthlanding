// node components/life-stages/life-stages.test.js
// Checks the Plan by age data file and the pages generated from it.
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..', '..');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'stages.json'), 'utf8'));
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const fileFor = (href) => {
  const p = href.split('#')[0].replace(/^\//, '');
  return p === '' || p.endsWith('/') ? p + 'index.html' : p;
};
let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };

ok(Array.isArray(data.stages) && data.stages.length === 5, 'five stages');
ok(data.stages[0].id === '45-49' && data.stages[4].id === '63-65', 'stages cover 45 to 65');
const sitemap = read('sitemap.xml');
ok(sitemap.includes('https://www.wealthlanding.com/plan-by-age/</loc>'), 'hub in sitemap');

const seen = new Set();
for (const s of data.stages) {
  const rel = `plan-by-age/${s.id}/index.html`;
  const page = read(rel);
  ok(sitemap.includes(`https://www.wealthlanding.com/plan-by-age/${s.id}/</loc>`), `${s.id} in sitemap`);
  ok(!/name="robots"[^>]+noindex/.test(page), `${s.id} indexable`);
  ok(page.includes('Educational content only'), `${s.id} has the disclaimer`);
  ok(page.includes(s.id === '63-65' ? data.after65.title : "What's coming next"), `${s.id} ends with what comes next`);
  for (const b of s.birthdays) ok(data.sources[b.src], `${s.id} birthday source ${b.src}`);
  for (const ev of s.events) {
    ok(!seen.has(ev.id), `unique event id ${ev.id}`); seen.add(ev.id);
    ok(page.includes(`id="${ev.id}"`), `${s.id} renders ${ev.id}`);
    for (const k of ['happening', 'title']) ok(ev[k] && ev[k].length > 10, `${ev.id}.${k}`);
    for (const k of ['todo', 'decisions', 'mistakes', 'numbers', 'helps']) ok(ev[k].length > 0, `${ev.id}.${k} not empty`);
    for (const n of ev.numbers) ok(data.sources[n.src], `${ev.id} number source ${n.src}`);
    for (const k of ev.official || []) ok(data.sources[k], `${ev.id} official source ${k}`);
    for (const h of ev.helps) {
      const f = fileFor(h.href);
      ok(fs.existsSync(path.join(root, f)), `${ev.id} link exists: ${h.href}`);
      const html = read(f);
      ok(!/name="robots"[^>]+noindex/.test(html), `${ev.id} link is indexable: ${h.href}`);
      ok(!/http-equiv="refresh"/.test(html), `${ev.id} link is not a redirect: ${h.href}`);
      ok(html.includes('<!-- wl:life-stage:start -->') && html.includes('/plan-by-age/'), `${h.href} has the Where this fits block`);
    }
  }
}
for (const [k, v] of Object.entries(data.sources)) ok(/^https:\/\//.test(v.url) && v.name, `source ${k} has https url and name`);
for (const h of data.after65.links) ok(fs.existsSync(path.join(root, fileFor(h.href))), `after65 link ${h.href}`);

// hidden earlier-stage pages stay on disk, noindexed and out of the sitemap
const hidden = ['life_stage/18_25/playbook_hub.html', 'life_stage/25_40/playbook_hub.html', 'learn/early-career/index.html', 'blogs/18_25.html']
  .concat([1, 2, 3, 4, 5].flatMap((i) => [`life_stage/18_25/step_${i}.html`, `life_stage/25_40/step_${i}.html`]));
const hiddenArticles = ['FSA_HSA', 'gig_economy_tax', 'paycheck', 'everyday_cost'].map((f) => `blogs/18_25/${f}.html`);
for (const rel of hidden) {
  ok(/name="robots"[^>]+noindex/.test(read(rel)), `${rel} noindex`);
  ok(!sitemap.includes('wealthlanding.com/' + rel.replace(/index\.html$/, '') + '</loc>'), `${rel} out of sitemap`);
}
for (const rel of hiddenArticles) {
  const t = read(rel);
  ok(/name="robots"[^>]+noindex/.test(t) || /^noindex: true$/m.test(t), `${rel} noindex`);
  ok(!sitemap.includes('wealthlanding.com/' + rel + '</loc>'), `${rel} out of sitemap`);
}
const siteMap = read('components/site-map/site-map.json');
ok(!siteMap.includes('blogs/18_25'), 'site-map.json has no blogs/18_25 links');
const nav = read('components/header-nav.html');
ok(!nav.includes('Plan by age') && !/life_stage\/(18_25|25_40\/(step|playbook))|learn\/early-career/.test(nav), 'top nav has no Plan by age dropdown and no hidden stages');
const home = read('index.html');
ok(home.includes('id="life-stages-explorer"') && home.includes('/plan-by-age/45-49/'), 'homepage journey block');
ok(home.includes('Find my stage') && home.includes('Browse the stages'), 'homepage hero still links to the stages');
const lsCss = read('components/life-stages/life-stages.css');
const homeCard = (lsCss.match(/\.wl-ls-home-grid a \{[^}]+\}/) || [])[0] || '';
ok(/background:\s*#fff/.test(homeCard) && /color:\s*#0f172a/.test(homeCard), 'homepage stage cards are light');
ok(!/background:\s*#0f172a/.test(homeCard), 'homepage stage cards are not dark navy');
ok(/\.wl-ls-home \{[^}]*background:\s*#f6faf7/.test(lsCss), 'homepage age section uses a light green-gray background');
ok(!/life_stage\/18_25|learn\/early-career|life_stage\/25_40\/playbook_hub/.test(home), 'homepage has no hidden-stage links');
ok(/<title>[^<]*45 to 65[^<]*\| WealthLanding<\/title>/.test(home) && !/Every Life Stage/i.test(home), 'homepage title is 45-65 focused');
console.log(`life-stages: ${checks} checks passed`);
