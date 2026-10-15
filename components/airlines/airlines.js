/**
 * WealthLanding airline loyalty section: shared renderer.
 *
 * Data:   /components/airlines/airlines.json  (programs, tiers, cards, hubs, city fit,
 *         hidden gems, sources, last-verified date). Edit that file and every page updates.
 * Styles: /components/airlines/airlines.css
 *
 * Pages place empty mount points such as
 *   <div data-wl-render="tiers" data-program="ua"></div>
 * and this script fills them in. Prose stays in the HTML pages.
 *
 * Supported data-wl-render values:
 *   program-cards   hub: one card per program
 *   compare-table   hub: side-by-side comparison table
 *   picker          hub: "which program for your city" select
 *   card-spend      hub: card-spend / flying-spend needed per tier (illustrative)
 *   coming-soon     hub: names of programs still to come (no links)
 *   facts           program: key facts list           (data-program)
 *   tiers           program: tier table                (data-program)
 *   tier-compare    program: tier comparison with companion benefits and who-it-is-for (data-program)
 *   tier-ladder     program: tiers as stair columns, paths as rows (data-program)
 *   partner-grid    program: alliance partner cards (data-program)
 *   fare-compare    program: one fare paid three ways + card-spend-alone (data-program, data-fare optional, default 5000)
 *   card-gallery    program: illustrated card visuals  (data-program)
 *   cardpath        program: card-only spend table     (data-program)
 *   gems            program: hidden gems cards         (data-program, data-limit optional)
 *   retired         program: perks that no longer exist (data-program)
 *   cities          program: hubs and best-fit cities  (data-program)
 *   sources         program: source links              (data-program)
 *   other-programs  program: links to the other two    (data-program)
 *   verified        any: "Last verified" + disclaimer
 */
(function () {
  'use strict';
  if (window.__wlAirlines) return;
  window.__wlAirlines = true;

  var DATA_URL = '/components/airlines/airlines.json';
  var ORDER = ['ua', 'aa', 'dl'];
  var RANKS = ['Entry tier', 'Second tier', 'Third tier', 'Top tier'];

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function money(n) {
    return '$' + Math.round(n).toLocaleString('en-US');
  }
  function num(n) {
    return Math.round(n).toLocaleString('en-US');
  }
  function link(href, text, cls, external) {
    var a = el('a', cls, text);
    a.href = href;
    if (external) { a.target = '_blank'; a.rel = 'noopener'; }
    return a;
  }
  function tableWrap(table, label) {
    var w = el('div', 'wla-scroll');
    w.setAttribute('role', 'region');
    w.setAttribute('aria-label', label);
    w.tabIndex = 0;
    w.appendChild(table);
    return w;
  }
  function th(text, scope) {
    var c = el('th', null, text);
    if (scope) c.setAttribute('scope', scope);
    return c;
  }
  function pill(text, cls) { return el('span', 'wla-pill ' + (cls || ''), text); }

  /* ---------- card-spend math (illustrative) ---------- */
  // Returns the card spend (USD) needed to reach `threshold` units after `flyingUnits`
  // already earned, or null when the card's cap makes it unreachable on spend alone.
  function spendNeeded(card, threshold, flyingUnits) {
    var need = threshold - flyingUnits;
    if (need <= 0) return 0;
    var pd = card.perDollar;
    if (card.milestones && card.milestones.length) {
      var ms = card.milestones.slice().sort(function (a, b) { return a.at - b.at; });
      var total = function (s) {
        var t = flyingUnits + s * pd, b = 0;
        for (var i = 0; i < ms.length; i++) { if (t + b >= ms[i].at) b += ms[i].bonus; }
        return t + b;
      };
      var lo = 0, hi = 5000000;
      if (total(hi) < threshold) return null;
      while (hi - lo > 1) {
        var mid = Math.floor((lo + hi) / 2);
        if (total(mid) >= threshold) hi = mid; else lo = mid;
      }
      return Math.ceil(hi / 100) * 100;
    }
    var needSpendUnits = need - (card.bonus || 0);
    if (needSpendUnits <= 0) return 0;
    if (card.cap && needSpendUnits > card.cap) return null;
    return Math.ceil(needSpendUnits / pd / 100) * 100;
  }

  /* ---------- renderers ---------- */
  function renderProgramCards(root, data) {
    var grid = el('div', 'wla-cards');
    ORDER.forEach(function (id) {
      var p = data.programs[id];
      var c = el('a', 'wla-card wla-card-' + id);
      c.href = p.url;
      c.style.setProperty('--wla-accent', p.color);
      c.appendChild(el('div', 'wla-card-kicker', p.alliance));
      c.appendChild(el('h3', 'wla-card-title', p.name));
      c.appendChild(el('p', 'wla-card-body', p.compare.gemHeadline));
      var meta = el('p', 'wla-card-meta');
      meta.appendChild(el('strong', null, 'Top tier: '));
      meta.appendChild(document.createTextNode(p.tiers[p.tiers.length - 1].name));
      c.appendChild(meta);
      c.appendChild(el('span', 'wla-card-cta', 'Read the ' + p.short + ' guide \u2192'));
      grid.appendChild(c);
    });
    root.appendChild(grid);
  }

  function renderCompareTable(root, data) {
    var rows = [
      ['Currency', function (p) { return p.currency; }],
      ['Alliance', function (p) { return p.alliance; }],
      ['How status is earned', function (p) { return p.statusMechanics; }],
      ['Earning window', function (p) { return p.statusYear; }],
      ['Top-tier requirement', function (p) { return p.compare.topTierRequirement; }],
      ['Easiest card path', function (p) { return p.compare.easiestCardPath; }],
      ['Award flexibility (editorial 1\u20135)', function (p) {
        var f = el('div');
        f.appendChild(el('strong', 'wla-score', p.compare.awardFlexScore + ' / 5'));
        f.appendChild(el('span', null, ' ' + p.compare.awardFlexWhy));
        return f;
      }],
      ['Best-fit hubs and cities', function (p) { return p.compare.bestFitCities; }],
      ['Hidden-gem headline', function (p) { return p.compare.gemHeadline; }],
      ['Full guide', function (p) { return link(p.url, 'Read the ' + p.short + ' guide', 'wla-link'); }]
    ];
    var t = el('table', 'wla-table wla-compare');
    var cap = el('caption', 'wla-sr', 'Side-by-side comparison of United MileagePlus, American AAdvantage and Delta SkyMiles');
    t.appendChild(cap);
    var thead = el('thead'), hr = el('tr');
    hr.appendChild(th('', 'col'));
    ORDER.forEach(function (id) {
      var c = th(data.programs[id].name, 'col');
      c.style.borderTop = '4px solid ' + data.programs[id].color;
      hr.appendChild(c);
    });
    thead.appendChild(hr); t.appendChild(thead);
    var tb = el('tbody');
    rows.forEach(function (r) {
      var tr = el('tr');
      tr.appendChild(th(r[0], 'row'));
      ORDER.forEach(function (id) {
        var td = el('td');
        td.setAttribute('data-label', data.programs[id].short);
        var v = r[1](data.programs[id]);
        if (typeof v === 'string') td.textContent = v; else td.appendChild(v);
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    root.appendChild(tableWrap(t, 'Program comparison table (scrolls sideways on small screens)'));
  }

  function renderPicker(root, data) {
    var form = el('div', 'wla-picker');
    var label = el('label', 'wla-picker-label', 'Where do you live (or fly from most)?');
    label.setAttribute('for', 'wla-city');
    var select = el('select', 'wla-select');
    select.id = 'wla-city';
    var first = el('option', null, 'Choose your home metro or airport\u2026');
    first.value = '';
    select.appendChild(first);
    data.cities.forEach(function (c) {
      var o = el('option', null, c.label); o.value = c.id; select.appendChild(o);
    });
    var other = data.faqFallback.other;
    var oo = el('option', null, other.label); oo.value = 'other'; select.appendChild(oo);
    var out = el('div', 'wla-picker-out');
    out.setAttribute('aria-live', 'polite');
    form.appendChild(label); form.appendChild(select); form.appendChild(out);
    root.appendChild(form);

    function show(id) {
      out.textContent = '';
      if (!id) {
        out.appendChild(el('p', 'wla-muted', 'Pick a city to see which of the three programs has a hub where you live and why it may fit.'));
        return;
      }
      if (id === 'other') {
        var box = el('div', 'wla-result');
        box.appendChild(el('h3', 'wla-result-title', other.label));
        box.appendChild(el('p', null, other.why));
        out.appendChild(box);
        return;
      }
      var city = data.cities.filter(function (c) { return c.id === id; })[0];
      if (!city) return;
      var res = el('div', 'wla-result');
      res.appendChild(el('h3', 'wla-result-title', city.label));
      var grid = el('div', 'wla-result-grid');
      var order = city.best.concat(ORDER.filter(function (k) { return city.best.indexOf(k) === -1; }));
      order.forEach(function (k) {
        var p = data.programs[k];
        var hubs = city.hubs[k] || [];
        var isBest = city.best.indexOf(k) !== -1;
        var c = el('div', 'wla-mini' + (isBest ? ' wla-mini-best' : ''));
        c.style.setProperty('--wla-accent', p.color);
        var h = el('div', 'wla-mini-head');
        h.appendChild(el('strong', null, p.short));
        if (isBest) h.appendChild(pill(city.best.length > 1 ? 'Strong fit' : 'Best fit', 'wla-pill-best'));
        h.appendChild(pill(hubs.length ? 'Hub: ' + hubs.join(', ') : 'No hub here', hubs.length ? 'wla-pill-hub' : 'wla-pill-none'));
        c.appendChild(h);
        c.appendChild(el('p', 'wla-muted', p.alliance + ' \u00b7 ' + p.currency));
        c.appendChild(link(p.url, 'Read the ' + p.short + ' guide \u2192', 'wla-link'));
        grid.appendChild(c);
      });
      res.appendChild(grid);
      res.appendChild(el('p', null, city.why));
      var w = el('p', 'wla-watch'); w.appendChild(el('strong', null, 'Competitive reality: ')); w.appendChild(document.createTextNode(city.watch));
      res.appendChild(w);
      out.appendChild(res);
    }
    select.addEventListener('change', function () {
      show(select.value);
      try { history.replaceState(null, '', select.value ? '#city=' + select.value : location.pathname + location.search); } catch (e) {}
    });
    var m = (location.hash || '').match(/city=([a-z]+)/);
    if (m && (data.cities.some(function (c) { return c.id === m[1]; }) || m[1] === 'other')) select.value = m[1];
    show(select.value);
  }

  function renderCardSpend(root, data) {
    var ctl = el('div', 'wla-spend-ctl');
    var lab = el('label', 'wla-picker-label', 'Airfare you expect to spend with the airline this year (USD)');
    lab.setAttribute('for', 'wla-fly');
    var inp = el('input', 'wla-input'); inp.type = 'number'; inp.id = 'wla-fly'; inp.min = '0'; inp.step = '500'; inp.value = '0'; inp.inputMode = 'numeric';
    var hint = el('p', 'wla-muted', 'Leave at $0 for card spend alone. Any airfare you enter is converted to status points at each program\u2019s flying rate, and the card spend needed shrinks to match.');
    ctl.appendChild(lab); ctl.appendChild(inp); ctl.appendChild(hint);
    root.appendChild(ctl);
    var body = el('div', 'wla-spend-body');
    root.appendChild(body);

    function draw() {
      var flyDollars = Math.max(0, parseFloat(inp.value) || 0);
      body.textContent = '';
      ORDER.forEach(function (id) {
        var p = data.programs[id];
        var panel = el('section', 'wla-spend-panel');
        panel.style.setProperty('--wla-accent', p.color);
        var h = el('h3', 'wla-spend-title');
        h.appendChild(document.createTextNode(p.name));
        h.appendChild(el('span', 'wla-spend-sub', ' status in ' + p.flying.unit + ' \u00b7 flying earns ' + p.flying.perDollar + ' per $1'));
        panel.appendChild(h);
        var t = el('table', 'wla-table wla-spend');
        t.appendChild(el('caption', 'wla-sr', p.short + ': card spend needed for each tier'));
        var thead = el('thead'), hr = el('tr');
        ['Tier', 'Requirement', 'Airfare alone'].forEach(function (x) { hr.appendChild(th(x, 'col')); });
        p.cards.forEach(function (c) {
          var h2 = th('', 'col');
          h2.appendChild(el('span', null, c.name));
          h2.appendChild(el('span', 'wla-th-sub', c.perDollarLabel + (c.fee ? ' \u00b7 $' + c.fee + ' fee' : '')));
          hr.appendChild(h2);
        });
        thead.appendChild(hr); t.appendChild(thead);
        var tb = el('tbody');
        var flyUnits = flyDollars * p.flying.perDollar;
        p.tiers.forEach(function (tier, i) {
          var tr = el('tr');
          var c0 = th(tier.name, 'row'); c0.appendChild(el('span', 'wla-th-sub', RANKS[i]));
          tr.appendChild(c0);
          tr.appendChild(el('td', null, num(tier.threshold) + ' ' + p.flying.unit));
          var airfareOnly = tier.threshold / p.flying.perDollar;
          tr.appendChild(el('td', null, money(airfareOnly)));
          p.cards.forEach(function (c) {
            var s = spendNeeded(c, tier.threshold, flyUnits);
            var td = el('td');
            if (s === null) { td.appendChild(el('span', 'wla-muted', 'Not reachable on card spend alone')); }
            else if (s === 0) { td.appendChild(el('strong', null, '$0 more')); td.appendChild(el('span', 'wla-th-sub', 'covered by flying/headstart')); }
            else td.appendChild(el('strong', null, money(s)));
            tr.appendChild(td);
          });
          tb.appendChild(tr);
        });
        t.appendChild(tb);
        panel.appendChild(tableWrap(t, p.short + ' card spend table (scrolls sideways on small screens)'));
        var notes = el('ul', 'wla-notes');
        p.cards.forEach(function (c) {
          var li = el('li');
          li.appendChild(el('strong', null, c.name + ': '));
          var bits = [c.perDollarLabel];
          if (c.bonusLabel) bits.push(c.bonusLabel);
          if (c.milestoneLabel) bits.push(c.milestoneLabel);
          if (c.capLabel) bits.push('cap ' + c.capLabel);
          li.appendChild(document.createTextNode(bits.join('; ') + '. ' + (c.note || '')));
          notes.appendChild(li);
        });
        var basis = el('li'); basis.appendChild(el('strong', null, 'Flying basis: ')); basis.appendChild(document.createTextNode(p.flying.basis + '.'));
        notes.appendChild(basis);
        if (id === 'ua') {
          var f = el('li'); f.appendChild(el('strong', null, 'Required flying: ')); f.appendChild(document.createTextNode('every United tier also needs at least four United or United Express segments flown, however you earn the points.')); notes.appendChild(f);
        }
        panel.appendChild(notes);
        body.appendChild(panel);
      });
    }
    inp.addEventListener('input', draw);
    draw();
  }

  function renderComingSoon(root, data) {
    var p = el('p', 'wla-muted', 'More programs are on the way: ' + data.meta.comingSoon.join(', ') + ' and others. Each will get the same treatment: status rules, card route, award flexibility, hidden gems and city fit.');
    root.appendChild(p);
  }

  function renderFacts(root, data, id) {
    var p = data.programs[id];
    var dl = el('dl', 'wla-facts');
    [
      ['Currency', p.currency],
      ['Alliance', p.alliance],
      ['Status metric', p.statusMetric],
      ['Earning window', p.statusYear],
      ['U.S. hubs', p.hubs.map(function (h) { return h.code; }).join(', ')],
      ['Last verified', data.meta.lastVerifiedLabel]
    ].forEach(function (r) {
      var d = el('div', 'wla-fact');
      d.appendChild(el('dt', null, r[0])); d.appendChild(el('dd', null, r[1]));
      dl.appendChild(d);
    });
    root.appendChild(dl);
  }

  function renderTiers(root, data, id) {
    var p = data.programs[id];
    var hasCombo = p.tiers.some(function (t) { return t.combo; });
    var t = el('table', 'wla-table wla-tiers');
    t.appendChild(el('caption', 'wla-sr', p.name + ' status tiers, requirements and headline benefits'));
    var thead = el('thead'), hr = el('tr');
    ['Tier', 'Requirement (' + p.flying.unit + ')'].forEach(function (x) { hr.appendChild(th(x, 'col')); });
    hr.appendChild(th('Roughly equals in airfare', 'col'));
    hr.appendChild(th('Benefits that matter', 'col'));
    thead.appendChild(hr); t.appendChild(thead);
    var tb = el('tbody');
    p.tiers.forEach(function (tier) {
      var tr = el('tr');
      tr.appendChild(th(tier.name, 'row'));
      var req = el('td');
      req.appendChild(el('strong', null, num(tier.threshold) + ' ' + p.flying.unit));
      if (hasCombo && tier.combo) req.appendChild(el('span', 'wla-th-sub', 'or ' + tier.combo));
      tr.appendChild(req);
      tr.appendChild(el('td', null, money(tier.threshold / p.flying.perDollar)));
      var td = el('td'); var ul = el('ul', 'wla-list');
      tier.perks.forEach(function (x) { ul.appendChild(el('li', null, x)); });
      td.appendChild(ul); tr.appendChild(td);
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    root.appendChild(tableWrap(t, p.short + ' tier table (scrolls sideways on small screens)'));
    root.appendChild(el('p', 'wla-fine', 'Airfare column is the flying-only equivalent at ' + p.flying.basis + '. Taxes, Basic Economy and partner-flight rules can change the real number.'));
  }

  function renderCardPath(root, data, id) {
    var p = data.programs[id];
    var t = el('table', 'wla-table wla-cardpath');
    t.appendChild(el('caption', 'wla-sr', p.short + ' card spend needed for each tier'));
    var thead = el('thead'), hr = el('tr');
    hr.appendChild(th('Tier', 'col'));
    p.cards.forEach(function (c) {
      var h = th('', 'col'); h.appendChild(el('span', null, c.name));
      h.appendChild(el('span', 'wla-th-sub', c.perDollarLabel + (c.fee ? ' \u00b7 $' + c.fee + '/yr' : '')));
      hr.appendChild(h);
    });
    thead.appendChild(hr); t.appendChild(thead);
    var tb = el('tbody');
    p.tiers.forEach(function (tier) {
      var tr = el('tr'); tr.appendChild(th(tier.name, 'row'));
      p.cards.forEach(function (c) {
        var s = spendNeeded(c, tier.threshold, 0);
        var td = el('td');
        if (s === null) td.appendChild(el('span', 'wla-muted', 'Not reachable on spend alone'));
        else td.appendChild(el('strong', null, money(s)));
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    root.appendChild(tableWrap(t, p.short + ' card-spend table (scrolls sideways on small screens)'));
    var notes = el('ul', 'wla-notes');
    p.cards.forEach(function (c) {
      var li = el('li'); li.appendChild(el('strong', null, c.name + ': '));
      var bits = [];
      if (c.bonusLabel) bits.push(c.bonusLabel);
      if (c.milestoneLabel) bits.push(c.milestoneLabel);
      if (c.capLabel) bits.push('cap ' + c.capLabel);
      li.appendChild(document.createTextNode((bits.length ? bits.join('; ') + '. ' : '') + (c.note || '')));
      notes.appendChild(li);
    });
    root.appendChild(notes);
    root.appendChild(el('p', 'wla-fine', 'Illustrative: card spend alone, no airfare, one primary card, year after opening so annual bonuses apply. Real results shift with fees, spend caps and rule changes.'));
  }

  /* ---------- tier comparison: bags, seats, companions, who it is for ----------
     Reads the richer per-tier fields (bags, bagCompanions, eplus, eplusCompanions,
     seatCompanions, lounge, upgrades, plusPoints, whoFor). A row is skipped when no
     tier defines its field, so programs without those fields still render the
     requirement row only. */
  function renderTierCompare(root, data, id) {
    var p = data.programs[id];
    var tiers = p.tiers;
    function companions(n) {
      if (n == null) return null;
      if (n === 0) return 'Just you';
      if (n === 1) return 'You + 1 companion';
      return 'You + up to ' + n + ' companions';
    }
    function cell(t, fn) {
      var v = fn(t);
      if (v == null) return null;
      if (typeof v === 'string') return el('td', null, v);
      return v; // already a td element
    }
    function rich(t, main, sub) {
      if (main == null) return null;
      var td = el('td');
      td.appendChild(document.createTextNode(main));
      if (sub) td.appendChild(el('span', 'wla-th-sub', sub));
      return td;
    }
    var rows = [
      ['Requirement (' + p.flying.unit + ')', function (t) { return rich(t, num(t.threshold) + ' ' + p.flying.unit); }],
      ['Checked bags (Economy, domestic)', function (t) { return rich(t, t.bags, t.bagsNote); }],
      ['Free bags for companions', function (t) {
        var c = companions(t.bagCompanions);
        return rich(t, c, c ? 'Same reservation / itinerary' : null);
      }],
      ['Economy Plus', function (t) { return rich(t, t.eplus); }],
      ['Economy Plus for companions', function (t) { return rich(t, companions(t.eplusCompanions)); }],
      ['Preferred seating for companions', function (t) { return rich(t, companions(t.seatCompanions)); }],
      ['Lounge access', function (t) { return rich(t, t.lounge); }],
      ['Complimentary upgrades', function (t) { return rich(t, t.upgrades); }],
      ['PlusPoints', function (t) {
        if (t.plusPoints == null) return null;
        return rich(t, t.plusPoints > 0 ? num(t.plusPoints) + ' PlusPoints' : 'None');
      }],
      ['Who it is for', function (t) {
        if (!t.whoFor) return null;
        var td = el('td', 'wla-whofor'); td.textContent = t.whoFor; return td;
      }]
    ];
    var kept = rows.filter(function (r) {
      return tiers.some(function (t) { return r[1](t) !== null; });
    });
    var t = el('table', 'wla-table wla-tier-compare');
    t.appendChild(el('caption', 'wla-sr', p.name + ' tier comparison: bags, seats, companions and who each tier fits'));
    var thead = el('thead'), hr = el('tr');
    hr.appendChild(th('', 'col'));
    tiers.forEach(function (tier) {
      var h = th('', 'col');
      h.appendChild(el('span', null, tier.name));
      h.appendChild(el('span', 'wla-th-sub', num(tier.threshold) + ' ' + p.flying.unit));
      hr.appendChild(h);
    });
    thead.appendChild(hr); t.appendChild(thead);
    var tb = el('tbody');
    kept.forEach(function (r) {
      var tr = el('tr');
      tr.appendChild(th(r[0], 'row'));
      tiers.forEach(function (tier) { tr.appendChild(cell(tier, r[1]) || el('td', 'wla-muted', '—')); });
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    root.appendChild(tableWrap(t, p.short + ' tier comparison (scrolls sideways on small screens)'));
    if (p.tierCompareNote) root.appendChild(el('p', 'wla-fine', p.tierCompareNote));
  }

  /* ---------- fare comparison: one fare, three ways ----------
     Row 1: the fare paid with a non-program card (flight points only).
     Rows 2..n: the same fare paid with each program card (flight + card-spend points).
     Then: what card spend alone buys toward the entry tier. All numbers derive from
     program.flying and program.cards, so the same renderer works for other programs. */
  function renderFareCompare(root, data, id) {
    var p = data.programs[id];
    var fare = parseFloat(root.getAttribute('data-fare') || '5000') || 5000;
    var unit = p.flying.unit;
    var entry = p.tiers[0];
    var flightPts = Math.round(fare * p.flying.perDollar);

    var t = el('table', 'wla-table wla-fare-compare');
    t.appendChild(el('caption', 'wla-sr', 'One ' + money(fare) + ' fare paid three ways'));
    var thead = el('thead'), hr = el('tr');
    ['What you do', 'Points from flying', 'Points from card spend', 'Total ' + unit, 'Share of ' + entry.name].forEach(function (x) { hr.appendChild(th(x, 'col')); });
    thead.appendChild(hr); t.appendChild(thead);
    var tb = el('tbody');
    var totals = [];
    function addRow(label, sub, cardPts) {
      var total = flightPts + cardPts;
      totals.push(total);
      var tr = el('tr');
      var c0 = th(label, 'row'); if (sub) c0.appendChild(el('span', 'wla-th-sub', sub));
      tr.appendChild(c0);
      tr.appendChild(el('td', null, num(flightPts)));
      tr.appendChild(el('td', null, cardPts ? '+' + num(cardPts) : '0'));
      var cT = el('td'); cT.appendChild(el('strong', null, num(total) + ' ' + unit)); tr.appendChild(cT);
      var pct = Math.min(100, Math.round(total / entry.threshold * 100));
      var cP = el('td');
      var bar = el('div', 'wla-bar'); var fill = el('div', 'wla-bar-fill'); fill.style.width = pct + '%'; bar.appendChild(fill);
      cP.appendChild(bar); cP.appendChild(el('span', 'wla-th-sub', pct + '% of ' + entry.name));
      tr.appendChild(cP);
      tb.appendChild(tr);
    }
    addRow('Pay the fare with a non-' + p.short + ' card', 'Any other card — you keep its own rewards, but earn no ' + unit + ' from the card', 0);
    p.cards.forEach(function (c) {
      addRow('Pay the fare with the ' + c.name, c.perDollarLabel + (c.fee ? ' · $' + c.fee + '/yr' : ''), Math.round(fare * c.perDollar));
    });
    t.appendChild(tb);
    root.appendChild(tableWrap(t, 'Fare comparison (scrolls sideways on small screens)'));
    var lo = Math.min.apply(null, totals), hi = Math.max.apply(null, totals);
    var loPct = Math.round(lo / entry.threshold * 100), hiPct = Math.round(hi / entry.threshold * 100);
    root.appendChild(el('p', 'wla-fine', 'One ' + money(fare) + ' fare earns ' + loPct + '%–' + hiPct + '% of the ' + num(entry.threshold) + ' ' + unit + ' ' + entry.name + ' needs. A second fare like it clears ' + entry.name + ' either way — the card just gets you there a little faster, and its points stack on every fare you buy.'));
    // Card spend alone, entry tier
    var h = el('h4', 'wla-fare-sub', 'What card spend alone buys (' + entry.name + ' = ' + num(entry.threshold) + ' ' + unit + ')');
    root.appendChild(h);
    var ul = el('ul', 'wla-notes');
    p.cards.forEach(function (c) {
      var s = spendNeeded(c, entry.threshold, 0);
      var li = el('li'); li.appendChild(el('strong', null, c.name + ': '));
      li.appendChild(document.createTextNode(s === null ? 'not reachable on card spend alone (cap ' + (c.capLabel || 'applies') + ').' : money(s) + ' of card spend' + (c.bonus ? ', after the ' + num(c.bonus) + '-' + unit + ' yearly bonus' : '') + '.'));
      ul.appendChild(li);
    });
    var li2 = el('li'); li2.appendChild(el('strong', null, 'Still required: '));
    li2.appendChild(document.createTextNode('at least four paid segments on ' + p.airline + (p.id === 'ua' ? ' / United Express' : '') + ' in the year, however you earn the points.'));
    ul.appendChild(li2);
    root.appendChild(ul);
  }

  /* ---------- card gallery: illustrated card visuals ----------
     Stylized CSS card faces driven by program.cards — not official card art. */
  function renderCardGallery(root, data, id) {
    var p = data.programs[id];
    var grid = el('div', 'wla-cc-grid');
    p.cards.forEach(function (c) {
      if (c.gallery === false) return; // generic fallback card: math only, no gallery face
      var card = el('article', 'wla-cc');
      var face = el('div', 'wla-cc-face');
      face.style.setProperty('--wla-accent', p.color);
      var top = el('div', 'wla-cc-top');
      top.appendChild(el('span', 'wla-cc-globe', ''));
      top.appendChild(el('span', 'wla-cc-brand', p.short.toUpperCase()));
      face.appendChild(top);
      face.appendChild(el('div', 'wla-cc-chip', ''));
      var cardNum = el('div', 'wla-cc-num'); cardNum.textContent = '•••• •••• •••• ••••';
      face.appendChild(cardNum);
      var bot = el('div', 'wla-cc-bot');
      bot.appendChild(el('span', 'wla-cc-name', c.name));
      bot.appendChild(el('span', 'wla-cc-issuer', c.issuer));
      face.appendChild(bot);
      card.appendChild(face);
      var body = el('div', 'wla-cc-body');
      body.appendChild(el('h4', 'wla-cc-title', c.name));
      var dl = el('dl', 'wla-cc-dl');
      [['Annual fee', c.fee != null ? '$' + c.fee : 'Varies'], ['Status earn rate', c.perDollarLabel], ['Annual cap', c.capLabel || '—'], ['Yearly bonus', c.bonus ? num(c.bonus) + ' ' + c.unit : 'None']].forEach(function (r) {
        var d = el('div'); d.appendChild(el('dt', null, r[0])); d.appendChild(el('dd', null, r[1])); dl.appendChild(d);
      });
      body.appendChild(dl);
      if (c.note) body.appendChild(el('p', 'wla-cc-note', c.note));
      card.appendChild(body);
      grid.appendChild(card);
    });
    root.appendChild(grid);
    root.appendChild(el('p', 'wla-fine', 'Card faces are illustrations drawn for this guide, not the official card art.'));
  }

  /* ---------- tier ladder (transposed): tiers are stair columns, paths are rows ----------
     Tier columns are steps: Silver lowest, 1K highest (margin-top shrinks per tier).
     Each step header carries the tier's benefits summary; each row is one path. */
  function renderTierLadder(root, data, id) {
    var p = data.programs[id];
    var tiers = p.tiers;
    var pathCards = p.pathsCards
      ? p.cards.filter(function (c) { return p.pathsCards.indexOf(c.id) !== -1; })
      : p.cards.slice();
    // Fare needed when paying the fare with `card`: flying points + card-spend points,
    // plus yearly bonus and milestones triggered by the running total, cap-aware.
    // Binary search so milestone steps are exact (closed form is wrong past the first).
    function fareNeeded(card, threshold) {
      var flyRate = p.flying.perDollar, cardRate = card.perDollar;
      var milestones = (card.milestones || []).slice().sort(function (a, b) { return a.at - b.at; });
      function total(f) {
        var cardLP = f * cardRate;
        if (card.cap != null && cardLP > card.cap) cardLP = card.cap;
        var t = f * flyRate + cardLP, b = card.bonus || 0;
        for (var i = 0; i < milestones.length; i++) { if (t + b >= milestones[i].at) b += milestones[i].bonus; }
        return t + b;
      }
      if (total(0) >= threshold) return 0;
      var lo = 0, hi = 5000000;
      while (hi - lo > 1) { var mid = Math.floor((lo + hi) / 2); if (total(mid) >= threshold) hi = mid; else lo = mid; }
      return hi;
    }
    function amountCell(amount, unitLabel, tierColor) {
      var d = el('div', 'wla-ladder-cell');
      d.style.setProperty('--wla-tier', tierColor);
      d.appendChild(el('strong', null, money(amount)));
      d.appendChild(el('span', 'wla-th-sub', unitLabel));
      return d;
    }
    var paths = [];
    paths.push({ kind: 'fare', label: p.airline + ' fare on another card', sub: 'Flight points only', cell: function (tier) {
      return amountCell(Math.ceil(tier.threshold / p.flying.perDollar), 'of ' + p.airline + ' fares', tier.color || p.color);
    } });
    pathCards.forEach(function (c) {
      paths.push({ kind: 'fare', label: p.airline + ' fare on the ' + c.name, sub: c.perDollarLabel + ' on the fare itself', cell: function (tier) {
        return amountCell(fareNeeded(c, tier.threshold), 'of ' + p.airline + ' fares', tier.color || p.color);
      } });
    });
    pathCards.forEach(function (c) {
      paths.push({ kind: 'spend', label: 'Other spend on the ' + c.name, sub: c.perDollarLabel + ' on everyday spend', cell: function (tier) {
        var s = spendNeeded(c, tier.threshold, 0);
        if (s === null) { var nr = el('div', 'wla-ladder-cell wla-muted', 'Not reachable (cap)'); nr.style.setProperty('--wla-tier', tier.color || p.color); return nr; }
        return amountCell(s, 'of card spend', tier.color || p.color);
      } });
    });
    if (p.partnerPQP) {
      paths.push({ kind: 'partner', label: 'Partner flights', sub: p.partnerPQP.label, cell: function (tier) {
        var d = el('div', 'wla-ladder-cell');
        d.style.setProperty('--wla-tier', tier.color || p.color);
        d.appendChild(el('strong', null, num(tier.threshold * p.partnerPQP.milesPerPQP) + ' award miles'));
        d.appendChild(el('span', 'wla-th-sub', 'flown on partner airlines'));
        return d;
      } });
    }
    var wrap = el('div', 'wla-ladder-wrap');
    var grid = el('div', 'wla-ladder');
    grid.style.setProperty('grid-template-columns', '230px repeat(' + tiers.length + ', 1fr)');
    var corner = el('div', 'wla-ladder-corner');
    corner.appendChild(el('strong', null, 'Tier →'));
    corner.appendChild(el('span', 'wla-th-sub', 'Paths ↓ are how you earn'));
    grid.appendChild(corner);
    tiers.forEach(function (t, i) {
      var h = el('div', 'wla-ladder-tier');
      h.style.setProperty('--wla-tier', t.color || p.color);
      h.style.setProperty('margin-top', ((tiers.length - 1 - i) * 1.5) + 'rem');
      var band = el('div', 'wla-step-band');
      band.appendChild(el('div', 'wla-step-kicker', 'Step ' + (i + 1)));
      band.appendChild(el('h4', 'wla-step-title', t.name.replace(/^Premier /, '')));
      band.appendChild(el('div', 'wla-step-threshold', num(t.threshold) + ' ' + p.flying.unit));
      h.appendChild(band);
      var ul = el('ul', 'wla-step-perks');
      if (t.bags) ul.appendChild(el('li', null, t.bags + (t.bagCompanions ? ' · bags for you + up to ' + t.bagCompanions : '')));
      if (t.eplus) ul.appendChild(el('li', null, (t.seatLabel || 'Economy Plus') + ' ' + t.eplus.toLowerCase() + (t.eplusCompanions != null ? ' · you + ' + (t.eplusCompanions === 1 ? '1 companion' : 'up to ' + t.eplusCompanions + ' companions') : '')));
      if (t.lounge) ul.appendChild(el('li', null, t.lounge));
      if (t.upgrades) ul.appendChild(el('li', null, 'Upgrades from ' + t.upgrades.toLowerCase()));
      if (t.plusPoints) ul.appendChild(el('li', null, num(t.plusPoints) + ' PlusPoints'));
      h.appendChild(ul);
      if (t.whoFor) h.appendChild(el('p', 'wla-step-who', t.whoFor));
      grid.appendChild(h);
    });
    paths.forEach(function (path, ri) {
      var lab = el('div', 'wla-ladder-path wla-kind-' + (path.kind || 'fare') + (ri > 0 ? ' wla-ladder-row' : ''));
      lab.appendChild(el('strong', null, path.label));
      lab.appendChild(el('span', 'wla-th-sub', path.sub));
      grid.appendChild(lab);
      tiers.forEach(function (t) {
        var c = path.cell(t);
        if (ri > 0) c.className = c.className + ' wla-ladder-row';
        grid.appendChild(c);
      });
    });
    wrap.appendChild(grid);
    root.appendChild(wrap);
    root.appendChild(el('p', 'wla-fine', 'Scroll sideways to see all four tiers.'));
    var notes = el('ul', 'wla-notes');
    var b = el('li'); b.appendChild(el('strong', null, 'Yearly card bonus included: '));
    b.appendChild(document.createTextNode('card rows assume the yearly card bonus applies (card open on Dec 31 of the prior year).'));
    notes.appendChild(b);
    if (p.partnerPQP && p.partnerPQP.capNote) {
      var pc = el('li'); pc.appendChild(el('strong', null, 'Partner flights: '));
      pc.appendChild(document.createTextNode(p.partnerPQP.capNote));
      notes.appendChild(pc);
    }
    var seg = el('li'); seg.appendChild(el('strong', null, 'Still required: '));
    seg.appendChild(document.createTextNode('at least four paid segments on ' + p.airline + (p.id === 'ua' ? ' / United Express' : '') + ' in the year, however you earn the points.'));
    notes.appendChild(seg);
    root.appendChild(notes);
    root.appendChild(el('p', 'wla-fine', 'Each row is one path on its own. In real life you mix them — the ladder is for comparing the paths, not for picking one.'));
  }

  /* ---------- alliance partner grid ---------- */
  function renderPartnerGrid(root, data, id) {
    var p = data.programs[id];
    var list = p.alliancePartners || [];
    if (!list.length) return;
    var grid = el('div', 'wla-partners');
    list.forEach(function (a) {
      var c = el('article', 'wla-partner');
      c.style.setProperty('--wla-accent', a.color);
      c.appendChild(el('div', 'wla-partner-name', a.name));
      c.appendChild(el('div', 'wla-partner-region', a.region));
      c.appendChild(el('p', 'wla-partner-note', a.note));
      grid.appendChild(c);
    });
    root.appendChild(grid);
  }

  function renderGems(root, data, id, retired, limit) {
    var p = data.programs[id];
    var list = (retired ? p.retired : p.gems) || [];
    if (limit) list = list.slice(0, limit);
    if (!list.length) return;
    var grid = el('div', retired ? 'wla-gems wla-gems-retired' : 'wla-gems');
    list.forEach(function (g) {
      var c = el('article', 'wla-gem');
      c.appendChild(el('h3', 'wla-gem-title', g.title));
      c.appendChild(el('p', null, g.body));
      var s = el('p', 'wla-gem-src'); s.appendChild(document.createTextNode('Source: '));
      s.appendChild(link(g.url, g.source, 'wla-link', true));
      c.appendChild(s);
      grid.appendChild(c);
    });
    root.appendChild(grid);
  }

  function renderCities(root, data, id) {
    var p = data.programs[id];
    var rows = data.cities.filter(function (c) { return (c.hubs[id] || []).length; });
    var t = el('table', 'wla-table wla-cities');
    t.appendChild(el('caption', 'wla-sr', 'Metros where ' + p.short + ' operates a hub'));
    var thead = el('thead'), hr = el('tr');
    ['Home metro', p.short + ' hub', 'Fit'].forEach(function (x) { hr.appendChild(th(x, 'col')); });
    thead.appendChild(hr); t.appendChild(thead);
    var tb = el('tbody');
    rows.forEach(function (c) {
      var tr = el('tr'); tr.appendChild(th(c.label, 'row'));
      tr.appendChild(el('td', null, c.hubs[id].join(', ')));
      var best = c.best.indexOf(id) !== -1;
      var others = ORDER.filter(function (k) { return k !== id && (c.hubs[k] || []).length; }).map(function (k) { return data.programs[k].short; });
      var td = el('td');
      td.appendChild(pill(best ? (c.best.length > 1 ? 'Strong fit' : 'Best fit') : 'Hub here', best ? 'wla-pill-best' : 'wla-pill-hub'));
      if (others.length) td.appendChild(el('span', 'wla-th-sub', 'Also a hub for ' + others.join(' and ')));
      tr.appendChild(td);
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    root.appendChild(tableWrap(t, p.short + ' hub metros table'));
    root.appendChild(el('p', 'wla-fine', 'Hubs reflect each airline\u2019s published U.S. hub list. Nonstop reach from smaller airports varies by season and changes often; check the airline\u2019s route map for your airport.'));
  }

  function renderSources(root, data, id) {
    var p = data.programs[id];
    var ul = el('ul', 'wla-sources');
    p.sources.forEach(function (s) {
      var li = el('li'); li.appendChild(link(s.url, s.label, 'wla-link', true)); ul.appendChild(li);
    });
    root.appendChild(ul);
  }

  function renderOther(root, data, id) {
    var wrap = el('div', 'wla-others');
    ORDER.filter(function (k) { return k !== id; }).forEach(function (k) {
      var p = data.programs[k];
      var a = el('a', 'wla-other', p.name); a.href = p.url; a.style.setProperty('--wla-accent', p.color);
      wrap.appendChild(a);
    });
    var hub = el('a', 'wla-other wla-other-hub', 'Compare all programs'); hub.href = data.meta.hubUrl;
    wrap.appendChild(hub);
    root.appendChild(wrap);
  }

  function renderVerified(root, data) {
    var box = el('div', 'wla-verified');
    box.appendChild(el('strong', null, 'Last verified: ' + data.meta.lastVerifiedLabel + '. '));
    box.appendChild(document.createTextNode(data.meta.disclaimer));
    root.appendChild(box);
  }

  var RENDER = {
    'program-cards': renderProgramCards,
    'compare-table': renderCompareTable,
    'picker': renderPicker,
    'card-spend': renderCardSpend,
    'coming-soon': renderComingSoon,
    'verified': renderVerified
  };
  var RENDER_P = {
    'facts': renderFacts,
    'tiers': renderTiers,
    'tier-compare': renderTierCompare,
    'tier-ladder': renderTierLadder,
    'partner-grid': renderPartnerGrid,
    'fare-compare': renderFareCompare,
    'card-gallery': renderCardGallery,
    'cardpath': renderCardPath,
    'cities': renderCities,
    'sources': renderSources,
    'other-programs': renderOther
  };

  function run(data) {
    var nodes = document.querySelectorAll('[data-wl-render]');
    Array.prototype.forEach.call(nodes, function (node) {
      var kind = node.getAttribute('data-wl-render');
      var prog = node.getAttribute('data-program');
      try {
        node.textContent = '';
        if (RENDER[kind]) RENDER[kind](node, data);
        else if (kind === 'gems') renderGems(node, data, prog, false, parseInt(node.getAttribute('data-limit') || '0', 10));
        else if (kind === 'retired') renderGems(node, data, prog, true);
        else if (RENDER_P[kind] && data.programs[prog]) RENDER_P[kind](node, data, prog);
        node.setAttribute('data-wl-ready', '1');
      } catch (e) {
        node.textContent = 'This section could not load. Please refresh the page.';
        if (window.console) console.error('[wl-airlines]', kind, e);
      }
    });
  }

  function start() {
    fetch(DATA_URL, { credentials: 'same-origin' })
      .then(function (r) { if (!r.ok) throw new Error('airlines.json ' + r.status); return r.json(); })
      .then(run)
      .catch(function (e) {
        if (window.console) console.error('[wl-airlines]', e);
        Array.prototype.forEach.call(document.querySelectorAll('[data-wl-render]'), function (n) {
          n.textContent = 'This section could not load. Please refresh the page.';
        });
      });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
