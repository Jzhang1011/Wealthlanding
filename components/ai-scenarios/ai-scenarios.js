/* WealthLanding — AI Economic Scenarios 2030 (shared model + UI).
   Core production block: closed form of Proposition 1 in Korinek, Jones, Sacher, Cotter & McCrory,
   "Economic Scenarios for Transformative AI" (Anthropic Institute WP 2026-02), uniform parameters.
   Everything else (unemployment reabsorption, capacity caps, investment feedback, policy levers,
   hyperscaler mapping) is WealthLanding's own illustrative extension.
   Usage: <div data-ai-scenarios data-src="/components/ai-scenarios/scenarios.json"></div>
   Node: const M = require('./ai-scenarios.js'); M.simulate(cfg, params) */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WLAIScenarios = api;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', api.autoInit);
    else api.autoInit();
  }
})(this, function () {
  'use strict';
  var clamp = function (x, lo, hi) { return Math.min(hi, Math.max(lo, x)); };

  /* Logistic path through the mid-2026 anchor x0 and the 2030 value x1, ceiling xbar (paper eq. 8′). */
  function logistic(x0, x1, xbar, t, anchor) {
    x1 = clamp(x1, x0 * 1.0001, xbar * 0.9999);
    var k = Math.log(((xbar - x0) / x0) * (x1 / (xbar - x1))) / (2030 - anchor);
    return xbar / (1 + ((xbar - x0) / x0) * Math.exp(-k * (t - anchor)));
  }

  /* Paper Proposition 1, uniform parameters. Returns level gaps vs the no-AI path (full employment). */
  function levelBlock(md, a, psi, rho, sigma, eps, c) {
    var sL0 = c.sL0, sK0 = c.sK0, oms = 1 - sigma, ea = Math.exp(-oms * a);
    var S1 = psi * md * (ea - rho);
    var inner = 1 - md * (1 - rho * psi - (1 - psi) * ea);
    var lN = -Math.log(Math.max(inner, 1e-9));
    function at(x) {
      var sL = clamp(1 - (sK0 + sL0 * S1) * Math.exp(oms * x), 1e-6, 1 - 1e-6);
      var dls = Math.log(sL / sL0), dw = (dls + lN) / oms, dy = dw - dls;
      var dk = Math.log((1 - sL) / sK0) + dy - x;
      return { sL: sL, dlnW: dw, dlnYL: dy, dlnK: dk, dlnR: x };
    }
    var lo = -3, hi = 3;
    for (var i = 0; i < 80; i++) { var mid = (lo + hi) / 2; if (eps * mid - at(mid).dlnK > 0) hi = mid; else lo = mid; }
    var r = at((lo + hi) / 2);
    r.lN = lN;
    r.lC = -lN * (c.sL0 - c.sL0 * c.mBar) / (c.sL0 * c.mBar); /* ℓ̃_C ≈ −(s_N0/s_C0)·ℓ̃_N, s_C0/s_L0 = m̄ */
    return r;
  }

  function hyperscalerSignal(h, vals) {
    if (!h) return { s: 0, sAi: 0, parts: [] };
    var mp = h.mapping, parts = [];
    var g = ['aws', 'azure', 'gcp'].filter(function (k) { return vals[k] != null && vals[k] !== '' && isFinite(Number(vals[k])); }).map(function (k) { return Number(vals[k]); });
    if (g.length) { var avg = g.reduce(function (s, v) { return s + v; }, 0) / g.length; parts.push(clamp((avg - mp.cloudRef) / mp.cloudSpan, -1, 1)); }
    var cx = Number(vals.capex), cp = Number(vals.capexPrior);
    if (vals.capex != null && vals.capexPrior != null && isFinite(cx) && isFinite(cp) && cp > 0) parts.push(clamp(((cx / cp - 1) * 100 - mp.capexRef) / mp.capexSpan, -1, 1));
    var sAi = 0;
    if (vals.aiShare != null && vals.aiShare !== '' && isFinite(Number(vals.aiShare))) sAi = clamp((Number(vals.aiShare) - mp.aiShareRef) / mp.aiShareSpan, -1, 1);
    var s = parts.length ? parts.reduce(function (a, b) { return a + b; }, 0) / parts.length : 0;
    return { s: s, sAi: sAi, parts: parts };
  }

  /* Monthly simulation 2024.0 → 2030.0, returns annual points 2025..2030 plus 2030 summary. */
  function simulate(cfg, p) {
    var c = cfg.calibration, ext = cfg.extensions || {}, A = c.anchorYear;
    var sigma = p.sigma, eps = p.epsilon;
    var d2030 = p.d2030, a2030 = p.a2030;
    if (p.hyper && p.hyper.on) {
      var sig = hyperscalerSignal(cfg.hyperscalers, p.hyper.values), st = p.hyper.strength == null ? 1 : p.hyper.strength;
      d2030 = clamp(d2030 * (1 + cfg.hyperscalers.mapping.dNudge * sig.s * st), c.d2026 * 1.01, 0.97);
      a2030 = Math.max(0, a2030 + cfg.hyperscalers.mapping.aNudge * sig.sAi * st);
    }
    var cap = clamp(Math.min(p.power == null ? 100 : p.power, p.chips == null ? 100 : p.chips) / 100, 0, 1);
    var tax = clamp((p.computeTax || 0) / 100 * (ext.computeTaxElasticity || 1), 0, 1);
    var phi = p.feedback || 0, fbCap = ext.feedbackCap || 0.25;
    var h = p.reabsorption * (1 + (p.retrain || 0) / 100);
    var T = (p.transfer || 0) / 100;
    var lC0 = c.mBar * (1 - c.uBar), pool = 0, lCprev = lC0, prevY = 0, out = [], yPrev = null;
    for (var mo = 0; mo <= 72; mo++) {
      var t = 2024 + mo / 12;
      var m = logistic(c.m2026, p.m2030, c.mBar, t, A);
      var d = logistic(c.d2026, d2030, c.dBar, t, A);
      var a = Math.max(0, p.a2026 + (a2030 - p.a2026) / (2030 - A) * (t - A));
      /* Illustrative: supply caps and compute tax scale growth in d and a beyond the mid-2026 anchor. */
      var ramp = clamp((t - A) / (2030 - A), 0, 1), lim = (1 - (1 - cap) * ramp) * (1 - tax * ramp);
      var d26 = Math.min(d, c.d2026), a26 = Math.min(a, p.a2026);
      d = d26 + (d - d26) * lim; a = a26 + (a - a26) * lim;
      /* Illustrative bounded investment feedback: last month's output gap lifts diffusion, capped. */
      d = clamp(d * (1 + Math.min(fbCap, phi * Math.max(0, prevY))), 0, c.dBar);
      var r = levelBlock(m * d, a, p.psi, p.rho, sigma, eps, c);
      /* Illustrative reabsorption: falls in cognitive employment add to an excess pool, drained at rate h/yr. */
      var lCt = lC0 * Math.exp(r.lC);
      var lay = Math.max(0, lCprev - lCt); lCprev = Math.min(lCprev, lCt);
      pool = Math.max(0, pool + lay - pool * Math.min(1, h / 12));
      var U = c.uBar + pool;
      var dlnY = r.dlnYL + c.sL0 * Math.log((1 - U) / (1 - c.uBar));
      prevY = dlnY;
      if (mo % 12 === 0) {
        var Y = Math.exp(dlnY);
        var capInc = (1 - r.sL) * Y - c.sK0;
        var workerInc = (r.sL * Y * (1 - U) / (1 - c.uBar) + T * Math.max(0, capInc)) / c.sL0;
        out.push({
          year: Math.round(t), m: m, d: d, a: a, md: m * d,
          gdpGap: (Y - 1) * 100,
          growth: yPrev == null ? c.baselineGrowth * 100 : (dlnY - yPrev + c.baselineGrowth) * 100,
          laborShare: r.sL * 100, unemployment: U * 100,
          wage: (Math.exp(r.dlnW) - 1) * 100,
          capital: (Math.exp(r.dlnK) - 1) * 100,
          netReturn: (c.rBar * Math.exp(r.dlnR) - c.delta) * 100,
          tfp: c.sL0 * m * d * a * 100,
          workerIncome: (workerInc - 1) * 100
        });
        yPrev = dlnY;
      }
    }
    return { years: out.slice(1), last: out[out.length - 1], d2030eff: d2030, a2030eff: a2030 };
  }

  /* ---------------- UI ---------------- */
  var NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, html) { var e = document.createElement(tag); for (var k in attrs || {}) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; }
  function fmt(v, f) { if (f === 'pct') return Math.round(v * 100) + '%'; if (f === 'pctInt') return Math.round(v) + '%'; return (+v).toFixed(2); }
  function sgn(v, dp) { dp = dp == null ? 1 : dp; return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(dp); }

  function chart(svgHost, title, series, unit) {
    var W = 520, H = 230, L = 46, R = 14, T = 18, B = 30;
    var all = []; series.forEach(function (s) { s.pts.forEach(function (p) { all.push(p[1]); }); });
    var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
    if (hi - lo < 1) { hi += 0.5; lo -= 0.5; }
    var pad = (hi - lo) * 0.1; lo -= pad; hi += pad;
    var xs = function (y) { return L + (y - 2025) / 5 * (W - L - R); }, ys = function (v) { return T + (hi - v) / (hi - lo) * (H - T - B); };
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', title + ': ' + series.map(function (s) { return s.name + ' ' + s.pts.map(function (p) { return p[0] + ' ' + p[1].toFixed(1) + unit; }).join(', '); }).join('; '));
    var g = '';
    for (var i = 0; i <= 4; i++) { var v = lo + (hi - lo) * i / 4, y = ys(v); g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '" class="ais-grid"/><text x="' + (L - 6) + '" y="' + (y + 4) + '" class="ais-axis" text-anchor="end">' + v.toFixed(1) + '</text>'; }
    for (var yr = 2025; yr <= 2030; yr++) g += '<text x="' + xs(yr) + '" y="' + (H - 8) + '" class="ais-axis" text-anchor="middle">' + yr + '</text>';
    series.forEach(function (s) {
      g += '<polyline fill="none" class="' + s.cls + '" points="' + s.pts.map(function (p) { return xs(p[0]).toFixed(1) + ',' + ys(p[1]).toFixed(1); }).join(' ') + '"/>';
      s.pts.forEach(function (p) { if (s.cls === 'ais-line') g += '<circle cx="' + xs(p[0]).toFixed(1) + '" cy="' + ys(p[1]).toFixed(1) + '" r="3" class="ais-dot"/>'; });
    });
    svg.innerHTML = g;
    svgHost.innerHTML = ''; svgHost.appendChild(svg);
  }

  function mount(host, cfg) {
    var uid = 'ais' + Math.random().toString(36).slice(2, 7);
    var presets = cfg.presets, c = cfg.calibration;
    var state = {};
    function applyPreset(id) {
      var pr = presets.filter(function (p) { return p.id === id; })[0];
      Object.assign(state, pr.paper, pr.illustrative, { sigma: c.sigma, epsilon: c.epsilon }, cfg.extensions.defaults);
      state.preset = id;
    }
    var hv = {}; cfg.hyperscalers.inputs.forEach(function (i) { hv[i.key] = i.value; });
    state.hyper = { on: false, strength: 1, values: hv };
    applyPreset('substantial');

    host.classList.add('ais');
    host.innerHTML = '';
    var presetBar = el('div', { class: 'ais-presets', role: 'radiogroup', 'aria-label': 'Scenario preset' });
    presets.forEach(function (p) {
      var b = el('button', { type: 'button', class: 'ais-preset', role: 'radio', 'data-id': p.id }, p.label);
      b.addEventListener('click', function () { applyPreset(p.id); syncInputs(); update(); });
      presetBar.appendChild(b);
    });
    presetBar.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var i = presets.findIndex(function (p) { return p.id === state.preset; }); if (i < 0) i = 0;
      i = (i + (e.key === 'ArrowRight' ? 1 : presets.length - 1)) % presets.length;
      applyPreset(presets[i].id); syncInputs(); update(); presetBar.children[i].focus(); e.preventDefault();
    });
    var narrative = el('p', { class: 'ais-narrative', 'aria-live': 'polite' });
    var kpis = el('div', { class: 'ais-kpis' });
    var layout = el('div', { class: 'ais-layout' });
    var controls = el('div', { class: 'ais-controls' });
    var charts = el('div', { class: 'ais-charts' });
    layout.appendChild(controls); layout.appendChild(charts);

    var inputs = {};
    function sliderGroup(title, list, badge) {
      var fs = el('fieldset', { class: 'ais-group' });
      fs.appendChild(el('legend', {}, title + ' <span class="ais-tag ais-tag-' + badge + '">' + (badge === 'paper' ? 'Paper parameter' : 'WealthLanding illustrative') + '</span>'));
      list.forEach(function (s) {
        var id = uid + '-' + s.key, row = el('div', { class: 'ais-row' });
        var lab = el('label', { for: id }, s.label + (s.source === 'illustrative' && badge === 'paper' ? ' <span class="ais-tag ais-tag-illustrative">illustrative</span>' : ''));
        var out = el('output', { for: id, id: id + '-o' });
        var inp = el('input', { type: 'range', id: id, min: s.min, max: s.max, step: s.step });
        inp.addEventListener('input', function () { state[s.key] = +inp.value; state.preset = null; out.textContent = fmt(+inp.value, s.fmt); update(); });
        inputs[s.key] = { inp: inp, out: out, s: s };
        var top = el('div', { class: 'ais-row-top' }); top.appendChild(lab); top.appendChild(out);
        row.appendChild(top); row.appendChild(inp); fs.appendChild(row);
      });
      controls.appendChild(fs);
    }
    sliderGroup('Model parameters', cfg.sliders, 'paper');
    sliderGroup('Constraints, feedback & policy', cfg.extensions.sliders, 'illustrative');

    /* Hyperscaler proxy panel */
    var hp = el('fieldset', { class: 'ais-group ais-hyper' });
    hp.appendChild(el('legend', {}, 'Hyperscaler proxy signal <span class="ais-tag ais-tag-illustrative">WealthLanding illustrative</span>'));
    var tog = el('label', { class: 'ais-toggle' }); var cb = el('input', { type: 'checkbox', id: uid + '-hon' });
    tog.appendChild(cb); tog.appendChild(document.createTextNode(' Let the signal nudge diffusion (d₂₀₃₀)'));
    cb.addEventListener('change', function () { state.hyper.on = cb.checked; update(); });
    hp.appendChild(tog);
    var stId = uid + '-hst', stRow = el('div', { class: 'ais-row' });
    var stTop = el('div', { class: 'ais-row-top' }); stTop.appendChild(el('label', { for: stId }, 'Signal strength')); var stOut = el('output', { for: stId }, '1.00'); stTop.appendChild(stOut);
    var st = el('input', { type: 'range', id: stId, min: 0, max: 1, step: 0.05, value: 1 });
    st.addEventListener('input', function () { state.hyper.strength = +st.value; stOut.textContent = (+st.value).toFixed(2); update(); });
    stRow.appendChild(stTop); stRow.appendChild(st); hp.appendChild(stRow);
    cfg.hyperscalers.inputs.forEach(function (i) {
      var id = uid + '-h-' + i.key, row = el('div', { class: 'ais-hrow' });
      row.appendChild(el('label', { for: id }, i.label));
      var inp = el('input', { type: 'number', id: id, step: 'any', inputmode: 'decimal' });
      if (i.value != null) inp.value = i.value; else inp.placeholder = i.placeholder || 'enter latest figure';
      inp.addEventListener('input', function () { hv[i.key] = inp.value === '' ? null : +inp.value; update(); });
      row.appendChild(inp);
      var src = i.url ? '<a href="' + i.url + '" target="_blank" rel="noopener">' + i.source + '</a>' : i.source;
      row.appendChild(el('small', {}, (i.date ? i.date + ' · ' : '') + src));
      hp.appendChild(row);
    });
    var sigOut = el('p', { class: 'ais-signal', 'aria-live': 'polite' }); hp.appendChild(sigOut);
    controls.appendChild(hp);

    var chartDefs = [
      { key: 'gdpGap', title: 'GDP vs no-AI baseline (%)', base: 0, unit: '%' },
      { key: 'growth', title: 'Annual real GDP growth (%)', base: c.baselineGrowth * 100, unit: '%' },
      { key: 'laborShare', title: 'Labor share of income (%)', base: c.sL0 * 100, unit: '%' },
      { key: 'unemployment', title: 'Unemployment rate (%)', base: c.uBar * 100, unit: '%' },
      { key: 'wage', title: 'Average real wage vs baseline (%)', base: 0, unit: '%' },
      { key: 'workerIncome', title: 'Worker household income incl. transfers vs baseline (%)', base: 0, unit: '%' }
    ];
    var chartHosts = chartDefs.map(function (d) {
      var fig = el('figure', { class: 'ais-chart' });
      fig.appendChild(el('figcaption', {}, d.title));
      var hostSvg = el('div', { class: 'ais-svg' }); fig.appendChild(hostSvg);
      fig.appendChild(el('div', { class: 'ais-legend' }, '<span class="ais-k ais-k-s"></span>Scenario <span class="ais-k ais-k-b"></span>No-AI baseline'));
      charts.appendChild(fig); return hostSvg;
    });
    var note = el('p', { class: 'ais-ref' });

    host.appendChild(presetBar); host.appendChild(narrative); host.appendChild(kpis); host.appendChild(note); host.appendChild(layout);

    function syncInputs() {
      Object.keys(inputs).forEach(function (k) { var o = inputs[k]; o.inp.value = state[k]; o.out.textContent = fmt(state[k], o.s.fmt); });
    }
    function update() {
      Array.prototype.forEach.call(presetBar.children, function (b) {
        var on = b.getAttribute('data-id') === state.preset; b.setAttribute('aria-checked', on); b.tabIndex = on || (!state.preset && b === presetBar.children[0]) ? 0 : -1;
      });
      var pr = presets.filter(function (p) { return p.id === state.preset; })[0];
      narrative.textContent = pr ? pr.narrative : 'Custom scenario: you have moved at least one slider away from a preset.';
      var res = simulate(cfg, state), L = res.last;
      var cards = [
        ['GDP vs no-AI, 2030', sgn(L.gdpGap) + '%', 'gdpGap'],
        ['Growth in 2030', L.growth.toFixed(1) + '%/yr', 'growth'],
        ['Labor share, 2030', L.laborShare.toFixed(1) + '%', 'laborShare'],
        ['Unemployment, 2030', L.unemployment.toFixed(1) + '%', 'unemployment'],
        ['Avg real wage vs baseline', sgn(L.wage) + '%', 'wage'],
        ['Effective AI share m·d', (L.md * 100).toFixed(1) + '%', null]
      ];
      var ref = pr && isDefault() ? pr.paperResults2030 : null;
      kpis.innerHTML = cards.map(function (k) {
        var r = ref && k[2] && ref[k[2]] != null ? '<small>Paper: ' + (k[2] === 'gdpGap' || k[2] === 'wage' ? sgn(ref[k[2]]) : ref[k[2]].toFixed(1)) + '%</small>' : '';
        return '<div class="ais-kpi"><span>' + k[0] + '</span><strong>' + k[1] + '</strong>' + r + '</div>';
      }).join('');
      note.textContent = ref ? 'Small “Paper” figures are the working paper’s published 2030 results (Table 3) for this preset; the large figures are this page’s reduced-form reproduction.' :
        'Results differ from any paper preset, so no published comparison is shown.';
      var sig = hyperscalerSignal(cfg.hyperscalers, hv);
      sigOut.textContent = 'Signal ' + sgn(sig.s, 2) + ' (−1 to +1). ' + (state.hyper.on ? 'Effective d₂₀₃₀ = ' + (res.d2030eff * 100).toFixed(1) + '% (slider: ' + Math.round(state.d2030 * 100) + '%).' : 'Toggle is off, so the signal is not applied.');
      chartDefs.forEach(function (d, i) {
        chart(chartHosts[i], d.title, [
          { name: 'Baseline', cls: 'ais-base', pts: res.years.map(function (y) { return [y.year, d.base]; }) },
          { name: 'Scenario', cls: 'ais-line', pts: res.years.map(function (y) { return [y.year, y[d.key]]; }) }
        ], d.unit);
      });
    }
    function isDefault() {
      var e = cfg.extensions.defaults; for (var k in e) if (state[k] !== e[k]) return false;
      return !state.hyper.on && state.sigma === c.sigma && state.epsilon === c.epsilon;
    }
    syncInputs(); update();
    return { state: state, update: update };
  }

  function autoInit() {
    var hosts = document.querySelectorAll('[data-ai-scenarios]:not([data-ais-ready])');
    Array.prototype.forEach.call(hosts, function (host) {
      host.setAttribute('data-ais-ready', '1');
      fetch(host.getAttribute('data-src') || '/components/ai-scenarios/scenarios.json')
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (cfg) { mount(host, cfg); })
        .catch(function () { host.innerHTML = '<p class="ais-error">The interactive model could not load its data file. Please refresh the page.</p>'; });
    });
  }

  return { simulate: simulate, levelBlock: levelBlock, logistic: logistic, hyperscalerSignal: hyperscalerSignal, mount: mount, autoInit: autoInit };
});
