/**
 * WealthLanding loyalty sections: shared rendering core.
 *
 * Used by the airline section (/components/airlines/airlines.js) and the hotel
 * section (/components/hotels/hotels.js). Load this file first, then the section script.
 *
 * It provides:
 *   - DOM helpers: el, money, num, link, tableWrap, th, pill
 *   - Generic renderers that work on any program data with the same shape:
 *       gems / retired   program.gems[] / program.retired[]  {title, body, source, url}
 *       sources          program.sources[]                   {label, url}
 *       other-programs   links to the other programs in `order` plus the hub
 *       verified         meta.lastVerifiedLabel + meta.disclaimer
 *   - mount(): fetches one JSON file and fills every
 *       <div data-wl-render="kind" data-program="id"></div>
 *     that belongs to the section's set. A mount point belongs to the set named by the
 *     nearest ancestor (or itself) with data-wl-set="..."; with no data-wl-set it belongs
 *     to "airlines", so the existing airline pages need no changes.
 */
(function () {
  'use strict';
  if (window.WLLoyalty) return;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function money(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function num(n) { return Math.round(n).toLocaleString('en-US'); }
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

  /* ---------- generic renderers ---------- */
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
      if (g.url) {
        var s = el('p', 'wla-gem-src'); s.appendChild(document.createTextNode('Source: '));
        s.appendChild(link(g.url, g.source, 'wla-link', true));
        c.appendChild(s);
      }
      grid.appendChild(c);
    });
    root.appendChild(grid);
  }

  function renderSources(root, data, id) {
    var ul = el('ul', 'wla-sources');
    data.programs[id].sources.forEach(function (s) {
      var li = el('li'); li.appendChild(link(s.url, s.label, 'wla-link', true)); ul.appendChild(li);
    });
    root.appendChild(ul);
  }

  /* opts: {order, hubIcon (glyph), hubLabel} */
  function renderOther(root, data, id, opts) {
    var wrap = el('div', 'wla-others');
    opts.order.filter(function (k) { return k !== id; }).forEach(function (k) {
      var p = data.programs[k];
      var a = el('a', 'wla-other', null); a.href = p.url; a.style.setProperty('--wla-accent', p.color);
      if (p.allianceIcon) {
        var img = el('img', 'wla-other-icon', null);
        img.src = p.allianceIcon; img.alt = p.alliance + ' logo';
        a.appendChild(img);
      } else if (p.glyph) {
        a.appendChild(el('span', 'wla-other-icon wla-other-icon-glyph', p.glyph));
      }
      a.appendChild(el('span', 'wla-other-name', p.name));
      wrap.appendChild(a);
    });
    var hub = el('a', 'wla-other wla-other-hub', null); hub.href = data.meta.hubUrl;
    hub.appendChild(el('span', 'wla-other-icon wla-other-icon-glyph', opts.hubIcon || '\u2192'));
    hub.appendChild(el('span', 'wla-other-name', opts.hubLabel || 'Compare all programs'));
    wrap.appendChild(hub);
    root.appendChild(wrap);
  }

  function renderVerified(root, data) {
    var box = el('div', 'wla-verified');
    box.appendChild(el('strong', null, 'Last verified: ' + data.meta.lastVerifiedLabel + '. '));
    box.appendChild(document.createTextNode(data.meta.disclaimer));
    root.appendChild(box);
  }

  /* ---------- mount ---------- */
  /*
   * opts: {
   *   set:      'airlines' | 'hotels' | ...   (which mount points to fill)
   *   dataUrl:  JSON file to fetch
   *   order:    program ids in display order
   *   hub:      { name: fn(root, data) }       renderers that take no program
   *   program:  { name: fn(root, data, id) }   renderers that need data-program
   *   hubIcon, hubLabel: used by other-programs
   *   tag:      console prefix
   * }
   * Generic renderers are registered automatically and can be overridden.
   */
  function mount(opts) {
    var tag = '[' + (opts.tag || 'wl-loyalty') + ']';
    var hubR = { 'verified': renderVerified };
    var progR = {
      'sources': renderSources,
      'other-programs': function (root, data, id) { renderOther(root, data, id, opts); }
    };
    Object.keys(opts.hub || {}).forEach(function (k) { hubR[k] = opts.hub[k]; });
    Object.keys(opts.program || {}).forEach(function (k) { progR[k] = opts.program[k]; });

    function nodes() {
      return Array.prototype.filter.call(document.querySelectorAll('[data-wl-render]'), function (n) {
        var owner = n.closest('[data-wl-set]');
        return (owner ? owner.getAttribute('data-wl-set') : 'airlines') === opts.set;
      });
    }
    function fail(n) { n.textContent = 'This section could not load. Please refresh the page.'; }

    function run(data) {
      nodes().forEach(function (node) {
        var kind = node.getAttribute('data-wl-render');
        var prog = node.getAttribute('data-program');
        try {
          node.textContent = '';
          if (hubR[kind]) hubR[kind](node, data);
          else if (kind === 'gems') renderGems(node, data, prog, false, parseInt(node.getAttribute('data-limit') || '0', 10));
          else if (kind === 'retired') renderGems(node, data, prog, true);
          else if (progR[kind] && data.programs[prog]) progR[kind](node, data, prog);
          node.setAttribute('data-wl-ready', '1');
        } catch (e) {
          fail(node);
          if (window.console) console.error(tag, kind, e);
        }
      });
    }

    function start() {
      fetch(opts.dataUrl, { credentials: 'same-origin' })
        .then(function (r) { if (!r.ok) throw new Error(opts.dataUrl + ' ' + r.status); return r.json(); })
        .then(run)
        .catch(function (e) {
          if (window.console) console.error(tag, e);
          nodes().forEach(fail);
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  }

  window.WLLoyalty = {
    el: el, money: money, num: num, link: link, tableWrap: tableWrap, th: th, pill: pill,
    renderGems: renderGems, renderSources: renderSources, renderOther: renderOther, renderVerified: renderVerified,
    mount: mount
  };
})();
