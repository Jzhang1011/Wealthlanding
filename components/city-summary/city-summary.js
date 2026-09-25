/**
 * WealthLanding shared "city summary box" for overseas city deep dives.
 *
 * Data:   /components/city-summary/cities.json  (one entry per city, keyed by the
 *         cities/<slug>.html filename slug). Edit that file to update every page.
 * Styles: /components/city-summary/city-summary.css
 * Loaded: automatically by /components/monetization/monetize.js on
 *         /Retirement-simulator/cities/<slug>.html pages. It can also be included directly.
 *
 * Placement: inside an explicit <div data-wl-city-summary></div> mount if the page
 * has one; otherwise before the first <section class="section"> inside <main>
 * (the first article card, right after the hero / dashboard strip).
 * Fails silently if the page, slug, data, or anchor is missing.
 */
(function () {
  'use strict';
  if (window.__wlCitySummary) return;
  window.__wlCitySummary = true;

  var MARKER = '/Retirement-simulator/cities/';
  var path = (window.location && window.location.pathname) || '';
  var at = path.indexOf(MARKER);
  if (at === -1) return;
  var m = path.slice(at + MARKER.length).match(/^([a-z0-9_]+)(?:\.html)?\/?$/i);
  if (!m) return;
  var slug = m[1].toLowerCase();
  var base = path.slice(0, at); // '' when the site is served at the domain root
  var DATA_URL = base + '/components/city-summary/cities.json';
  var CSS_URL = base + '/components/city-summary/city-summary.css';

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function list(title, items, mod) {
    if (!items || !items.length) return null;
    var col = el('div', 'wl-cs-col wl-cs-' + mod);
    col.appendChild(el('h3', null, title));
    var ul = el('ul');
    items.forEach(function (t) { ul.appendChild(el('li', null, t)); });
    col.appendChild(ul);
    return col;
  }

  function build(d, data) {
    var id = 'wl-city-summary-title';
    var box = el('section', 'section wl-city-summary');
    box.setAttribute('aria-labelledby', id);

    box.appendChild(el('div', 'kicker', 'At a glance'));
    var head = el('div', 'wl-cs-head');
    var h2 = el('h2', null, (d.city || '') + ' at a glance');
    h2.id = id;
    head.appendChild(h2);
    var badge = [d.countryCode, d.tier, d.badgeLabel].filter(Boolean).join(' · ');
    if (badge) {
      var b = el('span', 'wl-cs-badge', badge);
      var place = [d.city, d.country && d.country !== d.city ? d.country : null].filter(Boolean).join(', ');
      if (place) b.title = place;
      head.appendChild(b);
    }
    box.appendChild(head);

    if (d.tagline) box.appendChild(el('p', 'wl-cs-tagline', d.tagline));
    if (d.whoFor) box.appendChild(el('p', 'wl-cs-who', d.whoFor));

    if (d.monthlyRange) {
      var range = el('div', 'wl-cs-range');
      var left = el('div');
      left.appendChild(el('span', 'wl-cs-range-label', 'Illustrative monthly total'));
      if (d.rangeLabel) left.appendChild(el('span', 'wl-cs-range-sub', d.rangeLabel));
      range.appendChild(left);
      var val = el('strong', 'wl-cs-range-value', d.monthlyRange);
      val.appendChild(el('span', null, ' / month'));
      range.appendChild(val);
      box.appendChild(range);
    }
    if (d.costNote) {
      var note = el('p', 'wl-cs-note');
      note.appendChild(el('strong', null, 'Illustrative costs only. '));
      note.appendChild(document.createTextNode(d.costNote));
      box.appendChild(note);
    }

    var fit = list('Often a fit', d.fit, 'fit');
    var mis = list('Often a mismatch', d.mismatch, 'mismatch');
    if (fit || mis) {
      var grid = el('div', 'wl-cs-grid');
      if (fit) grid.appendChild(fit);
      if (mis) grid.appendChild(mis);
      box.appendChild(grid);
    }

    if (d.healthcare || d.visa) {
      var cav = el('div', 'wl-cs-grid wl-cs-caveats');
      if (d.healthcare) {
        var hc = el('div', 'wl-cs-col');
        hc.appendChild(el('h3', null, 'Healthcare (high level)'));
        hc.appendChild(el('p', null, d.healthcare));
        var link = data.healthcareLink;
        if (link && link.href) {
          var p = el('p', 'wl-cs-link');
          var a = el('a', null, (link.text || 'Learn more') + ' →');
          a.href = (link.href.charAt(0) === '/' ? base : '') + link.href;
          p.appendChild(a);
          hc.appendChild(p);
        }
        cav.appendChild(hc);
      }
      if (d.visa) {
        var vc = el('div', 'wl-cs-col');
        vc.appendChild(el('h3', null, 'Visa & residency caveats'));
        vc.appendChild(el('p', null, d.visa));
        cav.appendChild(vc);
      }
      box.appendChild(cav);
    }

    if (d.disclaimer) box.appendChild(el('p', 'wl-cs-disclaimer', d.disclaimer));
    return box;
  }

  function mountPoint() {
    var mount = document.querySelector('[data-wl-city-summary]');
    if (mount) return { parent: mount, before: null, clear: true };
    var first = document.querySelector('main section.section');
    if (first && first.parentNode) return { parent: first.parentNode, before: first };
    return null;
  }

  function ensureCss(done) {
    if (document.getElementById('wl-city-summary-css')) return done();
    var link = document.createElement('link');
    link.id = 'wl-city-summary-css';
    link.rel = 'stylesheet';
    link.href = CSS_URL;
    var called = false;
    function once() { if (!called) { called = true; done(); } }
    link.onload = once;
    link.onerror = once;
    setTimeout(once, 1500);
    document.head.appendChild(link);
  }

  function run() {
    if (document.querySelector('.wl-city-summary')) return;
    fetch(DATA_URL, { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        var d = data && data.cities && data.cities[slug];
        if (!d || !mountPoint()) return;
        ensureCss(function () {
          try {
            var spot = mountPoint();
            if (!spot || document.querySelector('.wl-city-summary')) return;
            if (spot.clear) spot.parent.innerHTML = '';
            spot.parent.insertBefore(build(d, data), spot.before);
          } catch (e) { /* never break the page */ }
        });
      })
      .catch(function () { /* fail silently */ });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
