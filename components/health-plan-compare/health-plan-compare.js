/* WealthLanding — Health Plan Comparison Calculator (shared model + UI).
   Usage: <div data-health-plan-compare data-src="/components/health-plan-compare/presets.json"></div>
   Node:  const M = require('./health-plan-compare.js'); M.annualCost(plan, x, opts); M.breakEvens(a, b, opts, xMax)
   Modeling rule (simplified, piecewise linear in allowed amount x):
     in-network share s of x goes to the in-network track, the rest to the out-of-network track.
     Each track: spending first fills that track's deductible, then the member pays coinsurance,
     capped at that track's out-of-pocket maximum (out-of-network may be unlimited).
     Optional copays from the usage section are a fixed in-network amount that counts toward the
     in-network out-of-pocket maximum (ACA rule). HDHPs ignore copays (deductible applies first).
     Annual cost = annual premium − employer HSA/HRA contribution + in-network OOP + out-of-network OOP. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WLHealthPlanCompare = api;
  if (typeof document !== 'undefined') {
    var boot = function () { document.querySelectorAll('[data-health-plan-compare]').forEach(function (el) { api.mount(el); }); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var VISIT_KEYS = ['primary', 'specialist', 'urgent', 'rx'];
  var EPS = 1e-9;

  function num(v, d) { var n = parseFloat(v); return isFinite(n) ? n : (d || 0); }
  function cap(v) { return (v === null || v === undefined || v === '' || !isFinite(v)) ? Infinity : Math.max(0, +v); }

  function annualPremium(plan, periods) { return num(plan.premium) * (periods || 1); }

  function copayTotal(plan, visits) {
    if (plan.hdhp || !visits) return 0;
    var c = plan.copays || {}, t = 0;
    VISIT_KEYS.forEach(function (k) { t += Math.max(0, num(c[k])) * Math.max(0, num(visits[k])); });
    return t;
  }

  // Member share of one track for allowed amount t.
  function track(t, ded, coins, capAmt) {
    var d = Math.max(0, ded), h = t <= d ? t : d + coins * (t - d);
    return Math.min(capAmt, h);
  }

  function legs(plan, opts) {
    opts = opts || {};
    var s = opts.share === undefined ? 1 : Math.min(1, Math.max(0, opts.share));
    var cp = copayTotal(plan, opts.visits), oopIn = cap(plan.oopIn);
    var cpPaid = Math.min(cp, oopIn);
    return {
      s: s, copays: cpPaid,
      inn: { w: s, d: num(plan.deductible), c: num(plan.coinsIn) / 100, cap: Math.max(0, oopIn - cpPaid) },
      out: { w: 1 - s, d: num(plan.deductibleOut), c: num(plan.coinsOut) / 100, cap: cap(plan.oopOut) }
    };
  }

  function outOfPocket(plan, x, opts) {
    var L = legs(plan, opts);
    var i = track(L.inn.w * x, L.inn.d, L.inn.c, L.inn.cap), o = track(L.out.w * x, L.out.d, L.out.c, L.out.cap);
    return { copays: L.copays, inNetwork: i, outNetwork: o, total: L.copays + i + o };
  }

  function annualCost(plan, x, opts) {
    opts = opts || {};
    return annualPremium(plan, opts.periods) - Math.max(0, num(plan.employerFund)) + outOfPocket(plan, x, opts).total;
  }

  // x values where a plan's cost line changes slope.
  function kinks(plan, opts) {
    var L = legs(plan, opts), out = [];
    [L.inn, L.out].forEach(function (k) {
      if (k.w <= EPS) return;
      var d = Math.max(0, k.d);
      if (k.cap <= d) { out.push(k.cap / k.w); return; }
      if (d > 0) out.push(d / k.w);
      if (isFinite(k.cap) && k.c > EPS) out.push((d + (k.cap - d) / k.c) / k.w);
    });
    return out.filter(function (v) { return isFinite(v) && v >= 0; });
  }

  // Premium − employer fund + the most the member can pay (Infinity if an out-of-network track has no cap).
  function worstCase(plan, opts) {
    var c = annualCost(plan, 1e12, opts);
    return c > 1e9 ? Infinity : c;
  }

  // Exact intersections of two piecewise-linear cost lines on [0, xMax].
  function breakEvens(a, b, opts, xMax) {
    var pts = [0].concat(kinks(a, opts), kinks(b, opts)).filter(function (v) { return v <= xMax; });
    pts.push(xMax);
    pts.sort(function (p, q) { return p - q; });
    var res = [];
    function add(x) {
      if (res.length && Math.abs(res[res.length - 1].x - x) < 1e-6) return;
      res.push({ x: x, cost: annualCost(a, x, opts) });
    }
    for (var i = 0; i < pts.length - 1; i++) {
      var p = pts[i], q = pts[i + 1];
      if (q - p < 1e-9) continue;
      var dp = annualCost(a, p, opts) - annualCost(b, p, opts), dq = annualCost(a, q, opts) - annualCost(b, q, opts);
      if (Math.abs(dp) < 1e-7 && Math.abs(dq) < 1e-7) continue; // identical over the segment: not a crossing
      if (Math.abs(dp) < 1e-7) { if (p > 0 || i === 0) add(p); continue; }
      if (dp * dq < 0) add(p + dp / (dp - dq) * (q - p));
      else if (Math.abs(dq) < 1e-7 && i === pts.length - 2) add(q);
    }
    return res;
  }

  function niceCeil(v) {
    if (!(v > 0)) return 10000;
    var m = Math.pow(10, Math.floor(Math.log10(v))), f = v / m;
    var n = f <= 1 ? 1 : f <= 1.5 ? 1.5 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 3 ? 3 : f <= 4 ? 4 : f <= 5 ? 5 : f <= 6 ? 6 : f <= 8 ? 8 : 10;
    return n * m;
  }

  function autoXMax(plans, opts) {
    var m = 0;
    plans.forEach(function (p) { kinks(p, opts).forEach(function (k) { if (k > m) m = k; }); });
    return niceCeil(Math.max(m * 1.3, 5000));
  }

  var api = { annualPremium: annualPremium, copayTotal: copayTotal, outOfPocket: outOfPocket, annualCost: annualCost,
    kinks: kinks, worstCase: worstCase, breakEvens: breakEvens, autoXMax: autoXMax, niceCeil: niceCeil, VISIT_KEYS: VISIT_KEYS };

  /* ---------------- UI ---------------- */
  var money = function (v) { return (v < 0 ? '−$' : '$') + Math.round(Math.abs(v)).toLocaleString('en-US'); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var FIELDS = ['name', 'premium', 'deductible', 'deductibleOut', 'coinsIn', 'coinsOut', 'oopIn', 'oopOut', 'employerFund', 'ownHsa', 'hdhp'];
  var VISIT_LABELS = { primary: 'Primary care visit', specialist: 'Specialist visit', urgent: 'Urgent care / ER', rx: 'Generic prescription fill' };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function encodePlan(p) {
    return FIELDS.map(function (f) {
      var v = p[f];
      if (f === 'hdhp') return v ? 1 : 0;
      if (f === 'oopOut' && (v === null || v === '')) return '';
      return v;
    }).join('~') + '~' + VISIT_KEYS.map(function (k) { return num((p.copays || {})[k]); }).join('.');
  }
  function decodePlan(s) {
    var a = s.split('~'); if (a.length < FIELDS.length + 1) return null;
    var p = { copays: {} };
    FIELDS.forEach(function (f, i) {
      if (f === 'name') p.name = a[i].slice(0, 40);
      else if (f === 'hdhp') p.hdhp = a[i] === '1';
      else if (f === 'oopOut') p.oopOut = a[i] === '' ? null : num(a[i]);
      else p[f] = num(a[i]);
    });
    var c = a[FIELDS.length].split('.');
    VISIT_KEYS.forEach(function (k, i) { p.copays[k] = num(c[i]); });
    return p;
  }

  function stateFromUrl(cfg) {
    var st = { freq: cfg.defaults.freq, inNetworkPct: cfg.defaults.inNetworkPct, expected: cfg.defaults.expected, taxRate: cfg.defaults.taxRate,
      xMax: cfg.defaults.xMax, visits: clone(cfg.defaults.visits), useVisits: false, plans: clone(cfg.plans) };
    if (typeof location === 'undefined') return st;
    var q = new URLSearchParams(location.search);
    var plans = [];
    ['p1', 'p2', 'p3'].forEach(function (k) { if (q.has(k)) { var p = decodePlan(q.get(k)); if (p) plans.push(p); } });
    if (plans.length >= 2) st.plans = plans;
    if (q.has('f')) st.freq = num(q.get('f'), st.freq);
    if (q.has('n')) st.inNetworkPct = Math.min(100, Math.max(0, num(q.get('n'), 100)));
    if (q.has('e')) st.expected = q.get('e') === '' ? '' : num(q.get('e'));
    if (q.has('t')) st.taxRate = num(q.get('t'));
    if (q.has('x')) st.xMax = num(q.get('x'));
    if (q.has('u')) st.useVisits = q.get('u') === '1';
    if (q.has('v')) { var v = q.get('v').split('.'); VISIT_KEYS.forEach(function (k, i) { st.visits[k] = num(v[i]); }); }
    return st;
  }

  function writeUrl(st) {
    if (typeof history === 'undefined') return;
    var q = new URLSearchParams(location.search);
    ['p1', 'p2', 'p3'].forEach(function (k) { q.delete(k); });
    st.plans.forEach(function (p, i) { q.set('p' + (i + 1), encodePlan(p)); });
    q.set('f', st.freq); q.set('n', st.inNetworkPct); q.set('e', st.expected); q.set('t', st.taxRate); q.set('x', st.xMax);
    q.set('u', st.useVisits ? 1 : 0); q.set('v', VISIT_KEYS.map(function (k) { return st.visits[k]; }).join('.'));
    history.replaceState(null, '', location.pathname + '?' + q.toString() + location.hash);
  }

  function mount(el) {
    var src = el.getAttribute('data-src') || '/components/health-plan-compare/presets.json';
    fetch(src).then(function (r) { return r.json(); }).then(function (cfg) { build(el, cfg); })
      .catch(function () { el.innerHTML = '<p class="hpc-err">The calculator could not load. Please refresh the page.</p>'; });
  }

  function build(el, cfg) {
    var st = stateFromUrl(cfg), uid = 'hpc' + Math.random().toString(36).slice(2, 7);
    var opts = function () { return { periods: st.freq, share: st.inNetworkPct / 100, visits: st.useVisits ? st.visits : null }; };

    function field(i, f, label, attrs, hint) {
      var p = st.plans[i], v = p[f] === null || p[f] === undefined ? '' : p[f], id = uid + '-' + i + '-' + f;
      return '<label class="hpc-f" for="' + id + '"><span>' + label + '</span><input id="' + id + '" data-plan="' + i + '" data-k="' + f + '" ' +
        (attrs || 'type="number" min="0" step="any" inputmode="decimal"') + ' value="' + esc(v) + '">' + (hint ? '<small>' + hint + '</small>' : '') + '</label>';
    }
    function planCard(i) {
      var p = st.plans[i], color = cfg.colors[i];
      var per = st.freq === 1 ? 'Annual premium (your share)' : 'Premium per paycheck (your share)';
      return '<div class="hpc-plan" style="--hpc-c:' + color + '">' +
        '<div class="hpc-plan-h"><span class="hpc-dot"></span>' + field(i, 'name', 'Plan name', 'type="text" maxlength="40"') +
        (i === 2 ? '<button type="button" class="hpc-btn hpc-btn-ghost hpc-noprint" data-act="remove">Remove plan</button>' : '') + '</div>' +
        '<div class="hpc-grid">' +
        field(i, 'premium', per, null, '<span data-annual="' + i + '"></span>') +
        field(i, 'deductible', 'In-network deductible') +
        field(i, 'coinsIn', 'In-network coinsurance you pay (%)', 'type="number" min="0" max="100" step="any"', 'After the deductible. 20% means the plan covers 80%.') +
        field(i, 'oopIn', 'In-network out-of-pocket max') +
        field(i, 'deductibleOut', 'Out-of-network deductible') +
        field(i, 'coinsOut', 'Out-of-network coinsurance you pay (%)', 'type="number" min="0" max="100" step="any"', 'Use 100% if out-of-network care is not covered (common for HMOs).') +
        field(i, 'oopOut', 'Out-of-network out-of-pocket max', 'type="number" min="0" step="any" placeholder="No limit"', 'Leave blank if there is no limit.') +
        field(i, 'employerFund', 'Employer HSA / HRA contribution (per year)', null, 'Optional. Lowers your net cost.') +
        '</div>' +
        '<label class="hpc-check"><input type="checkbox" data-plan="' + i + '" data-k="hdhp"' + (p.hdhp ? ' checked' : '') + '> High-deductible health plan (HSA-eligible)</label>' +
        (p.hdhp ? '<div class="hpc-grid">' + field(i, 'ownHsa', 'Your own planned HSA contribution (per year)', null, 'Used only for the illustrative tax-savings line.') + '</div>' : '') +
        '<details class="hpc-copays"><summary>Copays (used only if you turn on the visit estimate below)</summary><div class="hpc-grid">' +
        VISIT_KEYS.map(function (k) {
          var id = uid + '-' + i + '-cp-' + k;
          return '<label class="hpc-f" for="' + id + '"><span>' + VISIT_LABELS[k] + ' copay</span><input id="' + id + '" type="number" min="0" step="any" data-plan="' + i + '" data-copay="' + k + '" value="' + esc(num((p.copays || {})[k])) + '"' + (p.hdhp ? ' disabled' : '') + '></label>';
        }).join('') + '</div>' + (p.hdhp ? '<small>HDHPs usually apply the deductible before any copay, so copays are ignored for this plan.</small>' : '') + '</details>' +
        '</div>';
    }

    el.innerHTML =
      '<div class="hpc">' +
      '<div class="hpc-card hpc-example" role="note"><strong>Example numbers loaded.</strong> ' + esc(cfg.note) + ' Replace them with the figures from your employer\'s plan documents.</div>' +
      '<div class="hpc-card"><div class="hpc-toolbar">' +
      '<label class="hpc-f hpc-f-inline" for="' + uid + '-freq"><span>How premiums are entered</span><select id="' + uid + '-freq" data-g="freq">' +
      cfg.frequencies.map(function (f) { return '<option value="' + f.value + '"' + (f.value == st.freq ? ' selected' : '') + '>' + f.label + '</option>'; }).join('') + '</select></label>' +
      '<div class="hpc-actions hpc-noprint"><button type="button" class="hpc-btn" data-act="add">Add a third plan</button>' +
      '<button type="button" class="hpc-btn hpc-btn-ghost" data-act="reset">Reset to example</button>' +
      '<button type="button" class="hpc-btn hpc-btn-ghost" data-act="copy">Copy share link</button>' +
      '<button type="button" class="hpc-btn hpc-btn-ghost" data-act="print">Print</button></div></div>' +
      '<div class="hpc-plans" data-plans></div></div>' +
      '<div class="hpc-card"><h3 class="hpc-h">Your situation</h3><div class="hpc-grid">' +
      '<label class="hpc-f" for="' + uid + '-share"><span>Share of care in-network: <b data-sharev></b></span><input id="' + uid + '-share" type="range" min="0" max="100" step="5" data-g="inNetworkPct" value="' + st.inNetworkPct + '"></label>' +
      '<label class="hpc-f" for="' + uid + '-exp"><span>My expected medical spending (allowed amount)</span><input id="' + uid + '-exp" type="number" min="0" step="any" data-g="expected" value="' + esc(st.expected) + '"><small>Optional. Leave blank to hide the marker.</small></label>' +
      '<label class="hpc-f" for="' + uid + '-tax"><span>Marginal tax rate for HSA estimate (%)</span><input id="' + uid + '-tax" type="number" min="0" max="60" step="any" data-g="taxRate" value="' + esc(st.taxRate) + '"></label>' +
      '<label class="hpc-f" for="' + uid + '-xmax"><span>Chart x-axis maximum</span><input id="' + uid + '-xmax" type="number" min="0" step="1000" data-g="xMax" value="' + (st.xMax || '') + '" placeholder="Auto"><small>Leave blank for automatic.</small></label>' +
      '</div>' +
      '<label class="hpc-check"><input type="checkbox" data-g="useVisits"' + (st.useVisits ? ' checked' : '') + '> Add copays for an expected number of visits (counted toward each plan\'s in-network out-of-pocket max)</label>' +
      '<div class="hpc-grid" data-visits' + (st.useVisits ? '' : ' hidden') + '>' +
      VISIT_KEYS.map(function (k) { return '<label class="hpc-f" for="' + uid + '-v-' + k + '"><span>' + VISIT_LABELS[k] + 's per year</span><input id="' + uid + '-v-' + k + '" type="number" min="0" step="1" data-visit="' + k + '" value="' + esc(st.visits[k]) + '"></label>'; }).join('') +
      '</div></div>' +
      '<div class="hpc-card"><h3 class="hpc-h" id="' + uid + '-ct">Total yearly cost by medical spending</h3>' +
      '<div class="hpc-legend" data-legend></div><div class="hpc-chart" data-chart></div>' +
      '<div class="hpc-tip" data-tip hidden></div>' +
      '<div data-expected></div>' +
      '<details class="hpc-dt"><summary>Show chart data as a table</summary><div class="hpc-tw" data-table></div></details></div>' +
      '<div class="hpc-card"><h3 class="hpc-h">Summary</h3><div class="hpc-tw" data-summary></div><div data-be></div></div>' +
      '</div>';

    var $ = function (s) { return el.querySelector(s); };

    function renderPlans() {
      $('[data-plans]').innerHTML = st.plans.map(function (_, i) { return planCard(i); }).join('');
      $('[data-act="add"]').hidden = st.plans.length >= 3;
    }

    function render() {
      var o = opts(), plans = st.plans, xMax = st.xMax > 0 ? st.xMax : autoXMax(plans, o);
      $('[data-sharev]').textContent = st.inNetworkPct + '%';
      plans.forEach(function (p, i) {
        var a = el.querySelector('[data-annual="' + i + '"]');
        if (a) a.textContent = st.freq === 1 ? '' : '= ' + money(annualPremium(p, st.freq)) + ' per year';
      });
      $('[data-legend]').innerHTML = plans.map(function (p, i) { return '<span><i style="background:' + cfg.colors[i] + '"></i>' + esc(p.name || ('Plan ' + (i + 1))) + '</span>'; }).join('');
      drawChart(o, xMax);
      renderExpected(o);
      renderSummary(o, xMax);
      writeUrl(st);
    }

    var W = 760, H = 400, M = { l: 80, r: 36, t: 18, b: 52 };
    function drawChart(o, xMax) {
      var cw = $('[data-chart]').clientWidth || 760;
      if (cw < 560) { W = 440; H = 400; M = { l: 76, r: 14, t: 16, b: 50 }; } else { W = 760; H = 400; M = { l: 80, r: 36, t: 18, b: 52 }; }
      var plans = st.plans, n = 160, xs = [], i;
      var pts = [0, xMax];
      plans.forEach(function (p) { pts = pts.concat(kinks(p, o).filter(function (k) { return k < xMax; })); });
      for (i = 0; i <= n; i++) pts.push(xMax * i / n);
      pts = pts.sort(function (a, b) { return a - b; }).filter(function (v, j, a) { return j === 0 || v - a[j - 1] > 1e-9; });
      var ys = plans.map(function (p) { return pts.map(function (x) { return annualCost(p, x, o); }); });
      var yMin = Math.min(0, Math.min.apply(null, ys.map(function (a) { return Math.min.apply(null, a); })));
      var yMax = niceCeil(Math.max.apply(null, ys.map(function (a) { return Math.max.apply(null, a); })) * 1.08);
      var sx = function (x) { return M.l + (W - M.l - M.r) * x / xMax; }, sy = function (y) { return H - M.b - (H - M.t - M.b) * (y - yMin) / (yMax - yMin); };
      var g = '';
      for (i = 0; i <= 5; i++) {
        var yv = yMin + (yMax - yMin) * i / 5;
        g += '<line x1="' + M.l + '" x2="' + (W - M.r) + '" y1="' + sy(yv) + '" y2="' + sy(yv) + '" class="hpc-grid-l"/><text x="' + (M.l - 8) + '" y="' + (sy(yv) + 4) + '" text-anchor="end">' + money(yv) + '</text>';
      }
      var nx = W < 500 ? 4 : 5;
      for (i = 0; i <= nx; i++) {
        var xt = xMax * i / nx;
        g += '<text x="' + sx(xt) + '" y="' + (H - M.b + 18) + '" text-anchor="' + (i === nx ? 'end' : i === 0 ? 'start' : 'middle') + '">' + money(xt) + '</text>';
      }
      g += '<text x="' + (M.l + (W - M.l - M.r) / 2) + '" y="' + (H - 10) + '" text-anchor="middle" class="hpc-ax">Medical expenses incurred in a year (allowed amount)</text>';
      g += '<text transform="translate(13 ' + (M.t + (H - M.t - M.b) / 2) + ') rotate(-90)" text-anchor="middle" class="hpc-ax">Your total yearly cost</text>';
      var lines = ys.map(function (a, k) { return '<polyline fill="none" stroke="' + cfg.colors[k] + '" stroke-width="3" stroke-linejoin="round" points="' + a.map(function (y, j) { return sx(pts[j]).toFixed(1) + ',' + sy(y).toFixed(1); }).join(' ') + '"/>'; }).join('');
      var marks = '', labelN = 0;
      for (var a = 0; a < plans.length; a++) for (var b = a + 1; b < plans.length; b++) {
        breakEvens(plans[a], plans[b], o, xMax).forEach(function (be) {
          if (be.x <= 1e-6) return;
          var cx = sx(be.x), cy = sy(be.cost), up = labelN++ % 2 === 0;
          var tx = Math.min(W - M.r - 4, Math.max(M.l + 4, cx));
          marks += '<g class="hpc-be"><circle cx="' + cx + '" cy="' + cy + '" r="6" fill="#fff" stroke="#0b1b3a" stroke-width="2.5"/>' +
            '<text x="' + tx + '" y="' + (up ? cy - 14 : cy + 24) + '" text-anchor="' + (cx > W - 120 ? 'end' : cx < M.l + 120 ? 'start' : 'middle') + '">Equal at ' + money(be.x) + '</text></g>';
        });
      }
      var exp = st.expected === '' ? NaN : num(st.expected, NaN), em = '';
      if (isFinite(exp) && exp >= 0 && exp <= xMax) {
        em = '<line x1="' + sx(exp) + '" x2="' + sx(exp) + '" y1="' + M.t + '" y2="' + (H - M.b) + '" class="hpc-exp"/><text x="' + (sx(exp) + 5) + '" y="' + (M.t + 12) + '" class="hpc-exp-t">Your estimate</text>' +
          plans.map(function (p, k) { return '<circle cx="' + sx(exp) + '" cy="' + sy(annualCost(p, exp, o)) + '" r="4.5" fill="' + cfg.colors[k] + '"/>'; }).join('');
      }
      var desc = plans.map(function (p, k) { return (p.name || 'Plan ' + (k + 1)) + ' costs ' + money(annualCost(p, 0, o)) + ' with no medical spending and up to ' + money(ys[k][ys[k].length - 1]) + ' at ' + money(xMax); }).join('; ');
      $('[data-chart]').innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-labelledby="' + uid + '-st ' + uid + '-sd" preserveAspectRatio="xMidYMid meet">' +
        '<title id="' + uid + '-st">Total yearly cost (premiums plus out-of-pocket) for each plan as medical spending rises</title><desc id="' + uid + '-sd">' + esc(desc) + '. Circles mark spending levels where two plans cost the same.</desc>' +
        g + lines + em + marks + '<line class="hpc-hover" data-hl x1="0" x2="0" y1="' + M.t + '" y2="' + (H - M.b) + '" visibility="hidden"/>' +
        '<rect x="' + M.l + '" y="' + M.t + '" width="' + (W - M.l - M.r) + '" height="' + (H - M.t - M.b) + '" fill="transparent" data-hit/></svg>';
      var svg = $('[data-chart] svg'), hit = svg.querySelector('[data-hit]'), hl = svg.querySelector('[data-hl]'), tip = $('[data-tip]');
      function move(ev) {
        var r = svg.getBoundingClientRect(), px = (ev.clientX - r.left) * W / r.width;
        var x = Math.max(0, Math.min(xMax, (px - M.l) / (W - M.l - M.r) * xMax));
        hl.setAttribute('x1', sx(x)); hl.setAttribute('x2', sx(x)); hl.setAttribute('visibility', 'visible');
        var rows = plans.map(function (p, k) { return { k: k, c: annualCost(p, x, o) }; });
        var best = rows.reduce(function (m, r2) { return r2.c < m.c ? r2 : m; });
        tip.innerHTML = '<b>' + money(x) + ' of medical spending</b>' + rows.map(function (r2) { return '<div><i style="background:' + cfg.colors[r2.k] + '"></i>' + esc(plans[r2.k].name) + ': ' + money(r2.c) + (r2.k === best.k ? ' ✓' : '') + '</div>'; }).join('');
        tip.hidden = false;
        var cr = $('[data-chart]').getBoundingClientRect(), left = ev.clientX - cr.left + 14;
        if (left + 230 > cr.width) left = Math.max(0, ev.clientX - cr.left - 244);
        tip.style.left = left + 'px'; tip.style.top = (ev.clientY - cr.top + $('[data-chart]').offsetTop - 10) + 'px';
      }
      hit.addEventListener('pointermove', move); hit.addEventListener('pointerdown', move);
      hit.addEventListener('pointerleave', function () { tip.hidden = true; hl.setAttribute('visibility', 'hidden'); });
      // data table
      var steps = 10, rows = '';
      for (i = 0; i <= steps; i++) { var x = xMax * i / steps; rows += '<tr><td>' + money(x) + '</td>' + plans.map(function (p) { return '<td>' + money(annualCost(p, x, o)) + '</td>'; }).join('') + '</tr>'; }
      $('[data-table]').innerHTML = '<table class="hpc-t"><thead><tr><th scope="col">Medical spending</th>' + plans.map(function (p) { return '<th scope="col">' + esc(p.name) + '</th>'; }).join('') + '</tr></thead><tbody>' + rows + '</tbody></table>';
    }

    function renderExpected(o) {
      var box = $('[data-expected]'), exp = st.expected === '' ? NaN : num(st.expected, NaN);
      if (!isFinite(exp) || exp < 0) { box.innerHTML = ''; return; }
      var rows = st.plans.map(function (p, k) { return { k: k, p: p, c: annualCost(p, exp, o) }; });
      var best = rows.reduce(function (m, r) { return r.c < m.c ? r : m; });
      var hsa = rows.filter(function (r) { return r.p.hdhp && num(r.p.ownHsa) > 0; }).map(function (r) {
        var save = num(r.p.ownHsa) * Math.max(0, num(st.taxRate)) / 100;
        return '<li><b>' + esc(r.p.name) + ':</b> putting ' + money(num(r.p.ownHsa)) + ' of your own money into the HSA at a ' + num(st.taxRate) + '% marginal rate could save about ' + money(save) + ' in income tax, for an effective cost near ' + money(r.c - save) + '. Illustrative only: payroll and state taxes, contribution limits and eligibility rules are not modeled, and this saving is not included in the chart lines.</li>';
      }).join('');
      box.innerHTML = '<div class="hpc-exp-box"><p>At <b>' + money(exp) + '</b> of medical spending: ' +
        rows.map(function (r) { return '<span class="hpc-pill" style="--hpc-c:' + cfg.colors[r.k] + '">' + esc(r.p.name) + ' ' + money(r.c) + '</span>'; }).join(' ') +
        '</p><p><b>Lowest estimated cost: ' + esc(best.p.name) + '</b>' + (rows.length > 1 ? ', by ' + money(Math.min.apply(null, rows.filter(function (r) { return r !== best; }).map(function (r) { return r.c; })) - best.c) + ' over the next-lowest plan.' : '.') + '</p>' +
        (hsa ? '<ul class="hpc-small">' + hsa + '</ul>' : '') + '</div>';
    }

    function renderSummary(o, xMax) {
      var exp = st.expected === '' ? NaN : num(st.expected, NaN), plans = st.plans;
      var head = '<tr><th scope="col">Plan</th><th scope="col">Annual premium</th><th scope="col">Employer HSA/HRA</th><th scope="col">Cost at $0 spending</th>' +
        (isFinite(exp) ? '<th scope="col">Cost at ' + money(exp) + '</th>' : '') + '<th scope="col">Worst case</th></tr>';
      var body = plans.map(function (p, k) {
        var wc = worstCase(p, o), unl = !isFinite(wc);
        return '<tr><th scope="row"><i class="hpc-sw" style="background:' + cfg.colors[k] + '"></i>' + esc(p.name) + '</th><td>' + money(annualPremium(p, st.freq)) + '</td><td>' + money(num(p.employerFund)) + '</td><td>' + money(annualCost(p, 0, o)) + '</td>' +
          (isFinite(exp) ? '<td>' + money(annualCost(p, exp, o)) + '</td>' : '') + '<td>' + (unl ? 'No limit (out-of-network)' : money(wc)) + '</td></tr>';
      }).join('');
      $('[data-summary]').innerHTML = '<table class="hpc-t"><thead>' + head + '</thead><tbody>' + body + '</tbody></table><p class="hpc-small">Worst case = annual premium − employer HSA/HRA + out-of-pocket maximums for the networks you use at the current in-network share.</p>';
      var limit = Math.max(xMax, autoXMax(plans, o) * 4), items = '';
      for (var a = 0; a < plans.length; a++) for (var b = a + 1; b < plans.length; b++) {
        var be = breakEvens(plans[a], plans[b], o, limit).filter(function (e) { return e.x > 1e-6; });
        items += '<li><b>' + esc(plans[a].name) + ' vs ' + esc(plans[b].name) + ':</b> ' +
          (be.length ? be.map(function (e) { return 'equal at ' + money(e.x) + ' of spending (' + money(e.cost) + ' each)'; }).join('; ') : 'the lines do not cross up to ' + money(limit) + ' of spending') + '</li>';
      }
      $('[data-be]').innerHTML = '<h4 class="hpc-h4">Break-even spending between plans</h4><ul class="hpc-be-list">' + items + '</ul>';
    }

    el.addEventListener('input', function (e) {
      var t = e.target, i = t.getAttribute('data-plan');
      if (i !== null) {
        var p = st.plans[+i], k = t.getAttribute('data-k'), c = t.getAttribute('data-copay');
        if (c) p.copays[c] = num(t.value);
        else if (k === 'hdhp') { p.hdhp = t.checked; renderPlans(); }
        else if (k === 'name') p.name = t.value;
        else if (k === 'oopOut') p.oopOut = t.value === '' ? null : num(t.value);
        else if (k) p[k] = num(t.value);
      } else if (t.getAttribute('data-visit')) st.visits[t.getAttribute('data-visit')] = num(t.value);
      else if (t.getAttribute('data-g')) {
        var g = t.getAttribute('data-g');
        if (g === 'useVisits') { st.useVisits = t.checked; $('[data-visits]').hidden = !t.checked; }
        else if (g === 'expected') st.expected = t.value === '' ? '' : num(t.value);
        else if (g === 'freq') { st.freq = num(t.value, 26); renderPlans(); }
        else st[g] = num(t.value);
      }
      render();
    });
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      var act = b.getAttribute('data-act');
      if (act === 'add' && st.plans.length < 3) { var np = clone(cfg.plans[2] || cfg.plans[0]); np.name = 'Plan 3'; st.plans.push(np); }
      else if (act === 'remove') st.plans.splice(2, 1);
      else if (act === 'reset') {
        var q = new URLSearchParams(location.search), keep = q.get('embed') === '1' ? '?embed=1' : '';
        history.replaceState(null, '', location.pathname + keep + location.hash);
        var fresh = el.cloneNode(false); el.parentNode.replaceChild(fresh, el); build(fresh, cfg); return;
      }
      else if (act === 'print') { window.print(); return; }
      else if (act === 'copy') {
        var done = function () { b.textContent = 'Link copied'; setTimeout(function () { b.textContent = 'Copy share link'; }, 1800); };
        if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(done, function () { window.prompt('Copy this link:', location.href); });
        else window.prompt('Copy this link:', location.href);
        return;
      }
      renderPlans(); render();
    });
    var rt, lastNarrow = null;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { var n = $('[data-chart]').clientWidth < 560; if (n !== lastNarrow) { lastNarrow = n; render(); } }, 150); });
    renderPlans(); render();
  }
  api.mount = mount;
  return api;
});
