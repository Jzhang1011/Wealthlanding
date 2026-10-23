/* WealthLanding — Health cost charts (shared, data-driven).
   Usage: <div data-hc-chart="mercer-trend"></div> and <div data-hc-calc></div>,
   with <script src="/components/health-costs/health-costs.js" data-src="/components/health-costs/health-costs.json" defer></script>.
   Every figure lives in health-costs.json with its source. Charts are inline SVG with a title,
   caption, source line and a data table alternative; they re-render on resize for mobile. */
(function () {
  'use strict';
  var script = document.currentScript;
  var SRC = (script && script.getAttribute('data-src')) || '/components/health-costs/health-costs.json';
  var NS = 'http://www.w3.org/2000/svg';
  var COLORS = { navy: '#0d2946', amber: '#e99a16', muted: '#9fb0c3' };
  var uid = 0;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmt(v, c) {
    if (c.unit === '$') return '$' + Math.round(v).toLocaleString('en-US');
    if (c.format === 'k') return v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : Math.round(v / 1000) + 'K';
    return v.toFixed(c.decimals) + c.unit;
  }
  function full(v, c) { return c.format === 'k' ? v.toLocaleString('en-US') : fmt(v, c); }
  function el(tag, attrs, text) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }
  function svgRoot(w, h, id) {
    return el('svg', { width: w, height: h, viewBox: '0 0 ' + w + ' ' + h, role: 'img', 'aria-labelledby': id + '-t', 'aria-describedby': id + '-c', class: 'hc-svg' });
  }

  function bars(c, w, id) {
    var h = 280, padL = 8, padT = 26, padB = 30, n = c.data.length;
    var max = Math.max.apply(null, c.data.map(function (d) { return d[1]; })) * 1.12;
    var svg = svgRoot(w, h, id), slot = (w - padL * 2) / n, bw = Math.max(8, slot * 0.66);
    var narrow = slot < 34;
    svg.appendChild(el('line', { x1: padL, x2: w - padL, y1: h - padB, y2: h - padB, stroke: '#dfe7ef' }));
    c.data.forEach(function (d, i) {
      var last = c.highlightLast && i === n - 1;
      var bh = (d[1] / max) * (h - padT - padB), x = padL + i * slot + (slot - bw) / 2, y = h - padB - bh;
      svg.appendChild(el('rect', { x: x, y: y, width: bw, height: bh, rx: 4, fill: last ? COLORS.amber : COLORS.navy }));
      if (!narrow || last || i % 2 === 0) svg.appendChild(el('text', { x: x + bw / 2, y: y - 6, 'text-anchor': 'middle', class: 'hc-val' + (last ? ' hc-strong' : '') }, fmt(d[1], c)));
      var lab = narrow && /^\d{4}$/.test(d[0]) ? "'" + d[0].slice(2) : d[0];
      svg.appendChild(el('text', { x: x + bw / 2, y: h - padB + 18, 'text-anchor': 'middle', class: 'hc-lab' }, lab));
    });
    return svg;
  }

  function hbars(c, w, id) {
    var row = 54, padT = 6, labW = w, h = padT + c.data.length * row;
    var max = c.max || Math.max.apply(null, c.data.map(function (d) { return d[1]; })) * 1.15;
    var svg = svgRoot(w, h, id), track = w - 70;
    c.data.forEach(function (d, i) {
      var y = padT + i * row, bw = Math.max(3, (d[1] / max) * track);
      svg.appendChild(el('text', { x: 0, y: y + 14, class: 'hc-lab hc-left' }, d[0]));
      svg.appendChild(el('rect', { x: 0, y: y + 22, width: track, height: 18, rx: 9, fill: '#f0f4f8' }));
      var bar = el('rect', { x: 0, y: y + 22, width: bw, height: 18, rx: 9, fill: COLORS[d[2]] || COLORS.navy });
      if (d[3] === 'up to') { bar.setAttribute('fill-opacity', '0.55'); bar.setAttribute('stroke', COLORS.amber); bar.setAttribute('stroke-dasharray', '4 3'); }
      svg.appendChild(bar);
      svg.appendChild(el('text', { x: bw + 8, y: y + 36, class: 'hc-val hc-strong' }, (d[3] === 'up to' ? '≤ ' : '') + fmt(d[1], c)));
    });
    return svg;
  }

  function stacked(c, w, id) {
    var h = 300, padT = 30, padB = 30, n = c.data.length;
    var max = Math.max.apply(null, c.data.map(function (d) { return d[1] + d[2]; })) * 1.1;
    var svg = svgRoot(w, h, id), slot = w / n, bw = Math.min(120, slot * 0.6), H = h - padT - padB;
    svg.appendChild(el('line', { x1: 0, x2: w, y1: h - padB, y2: h - padB, stroke: '#dfe7ef' }));
    c.data.forEach(function (d, i) {
      var x = i * slot + (slot - bw) / 2, hw = d[1] / max * H, he = d[2] / max * H, base = h - padB;
      svg.appendChild(el('rect', { x: x, y: base - hw, width: bw, height: hw, fill: COLORS.amber }));
      svg.appendChild(el('rect', { x: x, y: base - hw - he, width: bw, height: he, fill: COLORS.navy, rx: 6 }));
      svg.appendChild(el('text', { x: x + bw / 2, y: base - hw / 2 + 4, 'text-anchor': 'middle', class: 'hc-val hc-on-amber' }, fmt(d[1], c)));
      svg.appendChild(el('text', { x: x + bw / 2, y: base - hw - he / 2 + 4, 'text-anchor': 'middle', class: 'hc-val hc-on-navy' }, fmt(d[2], c)));
      svg.appendChild(el('text', { x: x + bw / 2, y: base - hw - he - 8, 'text-anchor': 'middle', class: 'hc-val hc-strong' }, fmt(d[3] || d[1] + d[2], c)));
      svg.appendChild(el('text', { x: x + bw / 2, y: base + 18, 'text-anchor': 'middle', class: 'hc-lab' }, d[0]));
    });
    return svg;
  }

  function table(c) {
    var head = c.type === 'stacked' ? [c.labelHeader].concat(c.seriesHeaders) : [c.labelHeader, c.valueHeader];
    var rows = c.data.map(function (d) {
      var cells = c.type === 'stacked' ? [d[0], fmt(d[1], c), fmt(d[2], c), fmt(d[3] || d[1] + d[2], c)] : [d[0], (d[3] === 'up to' ? 'Up to ' : '') + full(d[1], c)];
      return '<tr>' + cells.map(function (x, j) { return j ? '<td>' + esc(x) + '</td>' : '<th scope="row">' + esc(x) + '</th>'; }).join('') + '</tr>';
    }).join('');
    return '<details class="hc-table"><summary>Show the data as a table</summary><div class="tablewrap"><table class="datatable"><thead><tr>' +
      head.map(function (x) { return '<th scope="col">' + esc(x) + '</th>'; }).join('') + '</tr></thead><tbody>' + rows + '</tbody></table></div></details>';
  }

  function sourceLine(keys, data) {
    return 'Source: ' + keys.map(function (k) { var s = data.sources[k]; return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.label) + '</a>'; }).join('; ') + '.';
  }

  function renderChart(host, c, data) {
    var id = 'hc' + (++uid);
    host.classList.add('hc-figure');
    host.innerHTML = '<figure><h3 class="hc-title" id="' + id + '-t">' + esc(c.title) + '</h3>' +
      (c.type === 'stacked' ? '<div class="hc-legend" aria-hidden="true"><span><i style="background:' + COLORS.amber + '"></i>Worker pays</span><span><i style="background:' + COLORS.navy + '"></i>Employer pays</span></div>' : '') +
      '<div class="hc-plot"></div><figcaption id="' + id + '-c">' + esc(c.caption) + '</figcaption><p class="hc-source">' + sourceLine(c.source, data) + '</p>' + table(c) + '</figure>';
    var plot = host.querySelector('.hc-plot');
    var draw = function () {
      var w = Math.max(260, Math.floor(plot.clientWidth || 600));
      if (plot._w === w) return; plot._w = w;
      plot.innerHTML = '';
      var svg = (c.type === 'bars' ? bars : c.type === 'stacked' ? stacked : hbars)(c, w, id);
      svg.insertBefore(el('title', {}, c.title), svg.firstChild);
      plot.appendChild(svg);
    };
    draw();
    window.addEventListener('resize', draw);
  }

  function renderCalc(host, data) {
    var k = data.calculator;
    host.classList.add('hc-calc');
    host.innerHTML =
      '<h3>Illustrative calculator: what an increase could mean for your paycheck</h3>' +
      '<p class="hc-note">Starts with KFF’s 2026 averages for family coverage ($28,303 total premium; workers pay 27%, or about $7,471 a year). Replace them with figures from your own benefits portal. This is an illustration, not a forecast of your plan.</p>' +
      '<div class="hc-inputs">' +
      '<label>Total annual premium ($)<input type="number" inputmode="decimal" min="0" step="100" data-k="prem" value="' + k.defaultPremium + '"></label>' +
      '<label>Your share of the premium (%)<input type="number" inputmode="decimal" min="0" max="100" step="1" data-k="share" value="' + k.defaultShare + '"></label>' +
      '<label>Premium increase (%)<input type="number" inputmode="decimal" min="0" max="50" step="0.1" data-k="inc" value="' + k.defaultIncrease + '"></label>' +
      '<label>Your share next year (%)<input type="number" inputmode="decimal" min="0" max="100" step="1" data-k="share2" value="' + k.defaultShare + '"></label>' +
      '</div><div class="hc-out" aria-live="polite"></div>' +
      '<p class="hc-source">Default inputs: ' + sourceLine(['kff'], data).replace('Source: ', '') + ' 8.2% default increase: ' + sourceLine(['mercer'], data).replace('Source: ', '') + '</p>';
    var out = host.querySelector('.hc-out');
    function v(n) { var x = parseFloat(host.querySelector('[data-k="' + n + '"]').value); return isFinite(x) && x >= 0 ? x : 0; }
    function money(x) { return '$' + Math.round(x).toLocaleString('en-US'); }
    function update() {
      var p = v('prem'), s = v('share') / 100, i = v('inc') / 100, s2 = v('share2') / 100;
      var now = p * s, next = p * (1 + i) * s2, diff = next - now;
      out.innerHTML = '<div><small>You pay now</small><strong>' + money(now) + '/yr</strong><span>' + money(now / 26) + ' per biweekly paycheck</span></div>' +
        '<div><small>You would pay</small><strong>' + money(next) + '/yr</strong><span>' + money(next / 26) + ' per biweekly paycheck</span></div>' +
        '<div class="hc-diff"><small>Change</small><strong>' + (diff >= 0 ? '+' : '−') + money(Math.abs(diff)) + '/yr</strong><span>' + (now > 0 ? (diff / now * 100).toFixed(1) + '% change in your cost' : '') + '</span></div>';
    }
    host.addEventListener('input', update);
    update();
  }

  function init() {
    var hosts = document.querySelectorAll('[data-hc-chart],[data-hc-calc]');
    if (!hosts.length) return;
    fetch(SRC).then(function (r) { return r.json(); }).then(function (data) {
      hosts.forEach(function (h) {
        if (h.hasAttribute('data-hc-calc')) renderCalc(h, data);
        else if (data.charts[h.getAttribute('data-hc-chart')]) renderChart(h, data.charts[h.getAttribute('data-hc-chart')], data);
      });
    }).catch(function () {
      hosts.forEach(function (h) { h.innerHTML = '<p class="hc-note">Chart data could not load. The figures are listed in the Sources section below.</p>'; });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
