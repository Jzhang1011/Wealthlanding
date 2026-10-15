/* WealthLanding Retirement Confidence series renderer.
   Reads /components/retirement-confidence/series.json and fills mount points marked data-rc="...".
   Mounts may contain static fallback HTML; it is replaced once data loads. */
(function () {
  'use strict';
  var DATA_URL = '/components/retirement-confidence/series.json';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function bySlug(data) {
    var m = {};
    data.articles.forEach(function (a, i) { a._i = i; m[a.slug] = a; });
    return m;
  }

  /* ---- Video: YouTube or Vimeo URL from series.json; empty URL shows a "coming soon" panel ---- */
  function videoEmbedSrc(url) {
    if (!url) return null;
    var m;
    try {
      var u = new URL(url, window.location.origin);
      var host = u.hostname.replace(/^www\./, '').replace(/^m\./, '');
      if (host === 'youtu.be') m = u.pathname.slice(1);
      else if (/(^|\.)youtube(-nocookie)?\.com$/.test(host)) {
        if (u.searchParams.get('v')) m = u.searchParams.get('v');
        else { var p = u.pathname.match(/\/(embed|shorts|live)\/([^/?#]+)/); if (p) m = p[2]; }
      }
      if (m && /^[A-Za-z0-9_-]{6,20}$/.test(m)) {
        return 'https://www.youtube-nocookie.com/embed/' + m + '?cc_load_policy=1&rel=0&modestbranding=1';
      }
      if (/(^|\.)vimeo\.com$/.test(host)) {
        var v = u.pathname.match(/(?:\/video)?\/(\d{5,12})(?:\/([0-9a-f]+))?/);
        if (v) return 'https://player.vimeo.com/video/' + v[1] + '?' + (v[2] ? 'h=' + v[2] + '&' : '') + 'texttrack=en&dnt=1';
      }
    } catch (e) { /* fall through */ }
    return null;
  }
  function renderVideo(el, data) {
    var meta = data.meta, src = videoEmbedSrc(meta.videoUrl);
    if (src) {
      el.innerHTML = '<div class="rc-video-frame"><iframe src="' + esc(src) + '" title="' + esc(meta.videoTitle) +
        ' (video)" loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>';
      return;
    }
    if (meta.videoUrl && window.console) console.warn('Retirement Confidence: videoUrl is not a recognised YouTube or Vimeo link; showing the coming-soon panel.');
    el.innerHTML = '<div class="rc-video-soon" role="note" aria-label="Video coming soon">' +
      '<span class="rc-soon-badge">Video coming soon</span>' +
      '<strong>' + esc(meta.videoTitle) + '</strong>' +
      '<p>' + esc(meta.videoComingSoon) + ' In the meantime, the three layers and seven principles below cover the same ideas in writing.</p></div>';
  }

  /* ---- Hub: seven principle cards ---- */
  function renderCards(el, data) {
    el.innerHTML = '<div class="rc-cards">' + data.articles.map(function (a) {
      return '<article class="rc-card">' +
        '<div class="rc-card-art"><img src="' + esc(a.image) + '" alt="' + esc(a.imageAlt) + '" width="800" height="350" loading="lazy" decoding="async"></div>' +
        '<div class="rc-card-body">' +
        '<span class="rc-card-num">PRINCIPLE ' + esc(a.num) + '</span>' +
        '<span class="rc-card-principle">' + esc(a.principle) + '</span>' +
        '<h3>' + esc(a.title) + '</h3>' +
        '<p>' + esc(a.desc) + '</p>' +
        '<a class="rc-card-link" href="' + esc(a.url) + '">Explore this principle<span class="rc-sr">: ' + esc(a.principle) + '</span> <span aria-hidden="true">&rarr;</span></a>' +
        '</div></article>';
    }).join('') + '</div>';
  }

  /* ---- Hub: Where should you start? ---- */
  function renderStart(el, data) {
    var map = bySlug(data);
    el.innerHTML = '<div class="rc-start">' + data.startHere.map(function (s) {
      return '<div class="rc-start-item"><q>' + esc(s.worry) + '</q><ul>' + s.links.map(function (slug) {
        var a = map[slug];
        return a ? '<li>Start with <a href="' + esc(a.url) + '">Principle ' + esc(a.num) + ': ' + esc(a.title) + '</a></li>' : '';
      }).join('') + '</ul></div>';
    }).join('') + '</div>';
  }

  /* ---- Article: table of contents from the article's own H2s ---- */
  function renderToc(el) {
    var body = document.querySelector('.rc-body');
    if (!body) return;
    var hs = body.querySelectorAll('h2[id]');
    if (hs.length < 3) { el.hidden = true; return; }
    var items = Array.prototype.map.call(hs, function (h) {
      return '<li><a href="#' + esc(h.id) + '">' + esc(h.textContent) + '</a></li>';
    }).join('');
    el.innerHTML = '<nav class="rc-toc" aria-labelledby="rc-toc-h"><h2 id="rc-toc-h">On this page</h2><ol>' + items + '</ol></nav>';
  }

  /* ---- Article: related reading (2–3 links from series.json) ---- */
  function renderRelated(el, data, slug) {
    var map = bySlug(data), a = map[slug];
    if (!a) return;
    var items = (a.related || []).map(function (s) { return map[s]; }).filter(Boolean);
    el.innerHTML = '<section class="rc-related" aria-labelledby="rc-related-h"><h2 id="rc-related-h">Related principles</h2><ul>' +
      items.map(function (r) {
        return '<li><a href="' + esc(r.url) + '">Principle ' + esc(r.num) + ': ' + esc(r.title) + '</a><span>' + esc(r.desc) + '</span></li>';
      }).join('') + '</ul></section>';
  }

  /* ---- Article: previous / next in the series + back to hub ---- */
  function renderSeriesNav(el, data, slug) {
    var map = bySlug(data), a = map[slug];
    if (!a) return;
    var prev = data.articles[a._i - 1], next = data.articles[a._i + 1], html = '<nav class="rc-seriesnav" aria-label="Series navigation">';
    html += prev ? '<a class="rc-prev" href="' + esc(prev.url) + '"><small>&larr; Previous principle</small><strong>' + esc(prev.num) + ' · ' + esc(prev.principle) + '</strong></a>'
      : '<a class="rc-prev" href="' + esc(data.meta.hubUrl) + '"><small>&larr; Series overview</small><strong>The Three Layers of Control</strong></a>';
    html += next ? '<a class="rc-next" href="' + esc(next.url) + '"><small>Next principle &rarr;</small><strong>' + esc(next.num) + ' · ' + esc(next.principle) + '</strong></a>'
      : '<a class="rc-next" href="' + esc(data.meta.hubUrl) + '#principles"><small>Series complete &rarr;</small><strong>Review all seven principles</strong></a>';
    el.innerHTML = html + '</nav><p class="rc-backhub"><a href="' + esc(data.meta.hubUrl) + '">&larr; Back to the Retirement Confidence Hub</a></p>';
  }

  /* ---- Article: sources + disclaimer ---- */
  function renderSources(el, data, slug) {
    var a = bySlug(data)[slug];
    if (!a) return;
    el.innerHTML = '<section class="rc-sources" aria-labelledby="rc-sources-h"><h2 id="rc-sources-h">Sources</h2><ol>' +
      a.sources.map(function (s) { return '<li><a href="' + esc(s.url) + '" rel="noopener" target="_blank">' + esc(s.label) + '</a></li>'; }).join('') +
      '</ol><p class="rc-fine">Last reviewed ' + esc(data.meta.lastReviewedLabel) + '. Figures for 2026 are the latest published at review; most are updated every autumn or winter.</p>' +
      '<p class="rc-disclaimer"><strong>Educational content only.</strong> ' + esc(data.meta.disclaimer) + '</p></section>';
  }
  function renderDisclaimer(el, data) {
    el.innerHTML = '<p class="rc-disclaimer"><strong>Educational content only.</strong> ' + esc(data.meta.disclaimer) + '</p>';
  }
  function renderReviewed(el, data) { el.textContent = data.meta.lastReviewedLabel; }

  var RENDER = {
    'video': renderVideo, 'principle-cards': renderCards, 'start-here': renderStart,
    'related': renderRelated, 'series-nav': renderSeriesNav, 'sources': renderSources,
    'disclaimer': renderDisclaimer, 'reviewed': renderReviewed
  };

  function run(data) {
    document.querySelectorAll('[data-rc]').forEach(function (el) {
      var kind = el.getAttribute('data-rc');
      if (kind === 'toc') { renderToc(el); return; }
      var fn = RENDER[kind];
      if (!fn) return;
      try { fn(el, data, el.getAttribute('data-slug') || document.body.getAttribute('data-rc-slug')); }
      catch (e) { if (window.console) console.error('Retirement Confidence: could not render ' + kind, e); }
    });
  }

  function start() {
    var toc = document.querySelector('[data-rc="toc"]');
    if (toc) renderToc(toc);
    fetch(DATA_URL, { credentials: 'same-origin' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(run)
      .catch(function (e) { if (window.console) console.warn('Retirement Confidence: series data unavailable, static fallback content kept.', e); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
