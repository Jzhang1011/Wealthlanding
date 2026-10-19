/**
 * WealthLanding hotel loyalty section: renderer.
 *
 * Data:   /components/hotels/hotels.json (programs, tiers, cards, redemption rules,
 *         traveler fit, hidden gems, unverified items, sources, last-verified date).
 * Core:   /components/loyalty/loyalty-core.js (load first). Helpers, gems, sources,
 *         other-programs, verified and the mount loop are shared with the airline section.
 * Styles: /components/airlines/airlines.css (shared wla- classes) + /components/hotels/hotels.css
 *
 * Mount points live inside an element with data-wl-set="hotels", for example
 *   <main data-wl-set="hotels"> ... <div data-wl-render="tier-compare" data-program="mb"></div>
 *
 * Supported data-wl-render values:
 *   program-cards   hub: one card per program
 *   compare-table   hub: side-by-side comparison
 *   fit-matrix      hub: traveler type x program (editorial)
 *   card-routes     hub: status and night credits from each co-brand card
 *   facts           program: key facts                    (data-program)
 *   tier-compare    program: tiers x benefits table       (data-program)
 *   cards           program: co-brand cards table         (data-program)
 *   redemption      program: award rules list             (data-program)
 *   transfer        program: transferable-points note     (data-program)
 *   fit             program: traveler-type fit table      (data-program)
 *   not-for         program: who it is not for            (data-program)
 *   unverified      program: claims we could not confirm  (data-program)
 *   gems, sources, other-programs, verified: from the shared core
 */
(function () {
  'use strict';
  if (window.__wlHotels) return;
  window.__wlHotels = true;
  var L = window.WLLoyalty;
  if (!L) { if (window.console) console.error('[wl-hotels] loyalty-core.js must load first'); return; }
  var el = L.el, money = L.money, link = L.link, tableWrap = L.tableWrap, th = L.th, pill = L.pill;

  var ORDER = ['mb', 'hh', 'wh', 'ihg'];
  var FIT_CLASS = { 'Strong': 'wla-pill-best', 'Good': 'wla-pill-hub', 'Mixed': 'wla-pill-none', 'Weak': 'wla-pill-none' };

  function fee(c) { return c.fee == null ? 'See issuer' : (c.fee === 0 ? '$0' : money(c.fee)); }
  function headRow(table, labels) {
    var thead = el('thead'), hr = el('tr');
    labels.forEach(function (x) { hr.appendChild(th(x, 'col')); });
    thead.appendChild(hr); table.appendChild(thead);
  }

  /* ---------- hub ---------- */
  function renderProgramCards(root, data) {
    var grid = el('div', 'wla-cards wlh-cards');
    ORDER.forEach(function (id) {
      var p = data.programs[id];
      var c = el('a', 'wla-card wlh-card');
      c.href = p.url;
      c.style.setProperty('--wla-accent', p.color);
      if (p.img) {
        var img = el('img', 'wlh-card-img');
        img.src = p.img; img.alt = p.imgAlt || ''; img.width = 720; img.height = 450; img.loading = 'lazy';
        c.appendChild(img);
      }
      c.appendChild(el('div', 'wla-card-kicker', p.currency));
      c.appendChild(el('h3', 'wla-card-title', p.name));
      c.appendChild(el('p', 'wla-card-body', p.compare.gem));
      var meta = el('p', 'wla-card-meta');
      meta.appendChild(el('strong', null, 'Top tier: '));
      meta.appendChild(document.createTextNode(p.compare.topTier));
      c.appendChild(meta);
      c.appendChild(el('span', 'wla-card-cta', 'Read the ' + p.short + ' guide \u2192'));
      grid.appendChild(c);
    });
    root.appendChild(grid);
  }

  function renderCompareTable(root, data) {
    var rows = [
      ['Elite tiers', function (p) { return p.tiers.map(function (t) { return t.name; }).join(', '); }],
      ['How status is earned', function (p) { return p.statusMechanics; }],
      ['Top-tier requirement', function (p) { return p.compare.topTier; }],
      ['Breakfast or lounge', function (p) { return p.compare.breakfast; }],
      ['Award pricing', function (p) { return p.compare.pricing; }],
      ['Long-stay award perk', function (p) { return p.compare.longStay; }],
      ['Strongest card path', function (p) { return p.compare.cardPath; }],
      ['Hidden-gem headline', function (p) { return p.compare.gem; }],
      ['Full guide', function (p) { return link(p.url, 'Read the ' + p.short + ' guide', 'wla-link'); }]
    ];
    var t = el('table', 'wla-table wla-compare wlh-compare');
    t.appendChild(el('caption', 'wla-sr', 'Hotel loyalty programs compared'));
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
      var tr = el('tr'); tr.appendChild(th(r[0], 'row'));
      ORDER.forEach(function (id) {
        var v = r[1](data.programs[id]); var td = el('td');
        if (typeof v === 'string') td.textContent = v; else td.appendChild(v);
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    root.appendChild(tableWrap(t, 'Hotel program comparison table'));
  }

  function renderFitMatrix(root, data) {
    var types = data.programs[ORDER[0]].fit.map(function (f) { return f[0]; });
    var t = el('table', 'wla-table wlh-fit-matrix');
    t.appendChild(el('caption', 'wla-sr', 'Which hotel program fits which kind of traveler'));
    headRow(t, ['Traveler type'].concat(ORDER.map(function (id) { return data.programs[id].short; })));
    var tb = el('tbody');
    types.forEach(function (type, i) {
      var tr = el('tr'); tr.appendChild(th(type, 'row'));
      ORDER.forEach(function (id) {
        var f = data.programs[id].fit[i]; var td = el('td');
        td.appendChild(pill(f[1], FIT_CLASS[f[1]]));
        td.appendChild(el('span', 'wla-th-sub', f[2]));
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    root.appendChild(tableWrap(t, 'Traveler fit table'));
  }

  function renderCardRoutes(root, data) {
    var t = el('table', 'wla-table wlh-cardroutes');
    t.appendChild(el('caption', 'wla-sr', 'Status and night credits from hotel co-brand cards'));
    headRow(t, ['Card', 'Program', 'Annual fee', 'Status for holding it', 'Night credits', 'Spend to the next tier']);
    var tb = el('tbody');
    ORDER.forEach(function (id) {
      var p = data.programs[id];
      p.cards.forEach(function (c) {
        var tr = el('tr'); tr.appendChild(th(c.name, 'row'));
        tr.appendChild(el('td', null, p.short));
        tr.appendChild(el('td', null, fee(c)));
        tr.appendChild(el('td', null, c.status));
        tr.appendChild(el('td', c.enc ? null : 'wla-muted', c.enc || 'None described'));
        tr.appendChild(el('td', c.spend ? null : 'wla-muted', c.spend || '\u2014'));
        tb.appendChild(tr);
      });
    });
    t.appendChild(tb);
    root.appendChild(tableWrap(t, 'Hotel co-brand card routes table'));
  }

  /* ---------- program ---------- */
  function renderFacts(root, data, id) {
    var p = data.programs[id];
    var dl = el('dl', 'wla-facts');
    p.facts.concat([['Last verified', data.meta.lastVerifiedLabel]]).forEach(function (r) {
      var d = el('div', 'wla-fact');
      d.appendChild(el('dt', null, r[0])); d.appendChild(el('dd', null, r[1]));
      dl.appendChild(d);
    });
    root.appendChild(dl);
  }

  function renderTierCompare(root, data, id) {
    var p = data.programs[id];
    var rows = [
      ['How to qualify', 'req'], ['Bonus points on stays', 'bonus'], ['Room upgrades', 'upgrade'],
      ['Late checkout', 'late'], ['Breakfast, lounge or welcome amenity', 'food']
    ].filter(function (r) { return p.tiers.some(function (t) { return t[r[1]]; }); });
    var t = el('table', 'wla-table wla-tier-compare wlh-tier-compare');
    t.appendChild(el('caption', 'wla-sr', p.name + ' elite tiers and benefits'));
    headRow(t, ['Benefit'].concat(p.tiers.map(function (x) { return x.name; })));
    var tb = el('tbody');
    rows.forEach(function (r) {
      var tr = el('tr'); tr.appendChild(th(r[0], 'row'));
      p.tiers.forEach(function (tier) {
        var v = tier[r[1]];
        tr.appendChild(v ? el('td', r[1] === 'req' ? 'wlh-strong' : null, v) : el('td', 'wla-muted', '\u2014'));
      });
      tb.appendChild(tr);
    });
    var tr = el('tr'); tr.appendChild(th('Also worth knowing', 'row'));
    p.tiers.forEach(function (tier) {
      var td = el('td');
      if (tier.extras && tier.extras.length) {
        var ul = el('ul', 'wla-list');
        tier.extras.forEach(function (x) { ul.appendChild(el('li', null, x)); });
        td.appendChild(ul);
      } else { td.className = 'wla-muted'; td.textContent = '\u2014'; }
      tr.appendChild(td);
    });
    tb.appendChild(tr);
    t.appendChild(tb);
    root.appendChild(tableWrap(t, p.short + ' tier comparison table'));
    if (p.tierNote) root.appendChild(el('p', 'wla-fine', p.tierNote));
  }

  function renderCards(root, data, id) {
    var p = data.programs[id];
    var t = el('table', 'wla-table wlh-cards-table');
    t.appendChild(el('caption', 'wla-sr', p.name + ' co-brand credit cards'));
    headRow(t, ['Card', 'Annual fee', 'Status', 'Night credits', 'Spend route', 'Free night']);
    var tb = el('tbody');
    p.cards.forEach(function (c) {
      var tr = el('tr'); var h = th(c.name, 'row');
      h.appendChild(el('span', 'wla-th-sub', c.issuer)); tr.appendChild(h);
      tr.appendChild(el('td', null, fee(c)));
      tr.appendChild(el('td', null, c.status));
      [c.enc, c.spend, c.night].forEach(function (v) { tr.appendChild(el('td', v ? null : 'wla-muted', v || '\u2014')); });
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    root.appendChild(tableWrap(t, p.short + ' co-brand cards table'));
    if (p.cardNote) root.appendChild(el('p', 'wla-fine', p.cardNote));
  }

  function renderRedemption(root, data, id) {
    var dl = el('dl', 'wlh-rules');
    data.programs[id].redemption.forEach(function (r) {
      var d = el('div', 'wlh-rule');
      d.appendChild(el('dt', null, r[0])); d.appendChild(el('dd', null, r[1]));
      dl.appendChild(d);
    });
    root.appendChild(dl);
  }

  function renderTransfer(root, data, id) {
    root.appendChild(el('p', null, data.programs[id].transfer));
  }

  function renderFit(root, data, id) {
    var p = data.programs[id];
    var t = el('table', 'wla-table wlh-fit');
    t.appendChild(el('caption', 'wla-sr', 'Which travelers ' + p.short + ' fits'));
    headRow(t, ['Traveler type', 'Fit', 'Why']);
    var tb = el('tbody');
    p.fit.forEach(function (f) {
      var tr = el('tr'); tr.appendChild(th(f[0], 'row'));
      var td = el('td'); td.appendChild(pill(f[1], FIT_CLASS[f[1]])); tr.appendChild(td);
      tr.appendChild(el('td', null, f[2]));
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    root.appendChild(tableWrap(t, p.short + ' traveler fit table'));
    root.appendChild(el('p', 'wla-fine', 'Fit ratings are an editorial judgment from the benefits and rules on this page, not an official rating.'));
  }

  function list(key) {
    return function (root, data, id) {
      var items = data.programs[id][key] || [];
      if (!items.length) return;
      var ul = el('ul');
      items.forEach(function (x) { ul.appendChild(el('li', null, x)); });
      root.appendChild(ul);
    };
  }

  L.mount({
    set: 'hotels',
    dataUrl: '/components/hotels/hotels.json',
    order: ORDER,
    hub: {
      'program-cards': renderProgramCards,
      'compare-table': renderCompareTable,
      'fit-matrix': renderFitMatrix,
      'card-routes': renderCardRoutes
    },
    program: {
      'facts': renderFacts,
      'tier-compare': renderTierCompare,
      'cards': renderCards,
      'redemption': renderRedemption,
      'transfer': renderTransfer,
      'fit': renderFit,
      'not-for': list('notFor'),
      'unverified': list('unverified')
    },
    hubIcon: '\u2302',
    hubLabel: 'Compare all hotel programs',
    tag: 'wl-hotels'
  });
})();
