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
  function youtubeId(src) { var m = /youtube-nocookie\.com\/embed\/([A-Za-z0-9_-]+)/.exec(src || ''); return m ? m[1] : null; }
  function renderVideo(el, data) {
    var meta = data.meta, src = videoEmbedSrc(meta.videoUrl), yt = youtubeId(src);
    var allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';
    if (yt) {
      // Click-to-play facade: nothing loads from YouTube until the visitor presses play.
      var watch = 'https://www.youtube.com/watch?v=' + yt;
      el.innerHTML = '<div class="rc-video-frame rc-video-facade">' +
        '<button type="button" class="rc-video-play" aria-label="Play video: ' + esc(meta.videoTitle) + '">' +
        '<img src="https://i.ytimg.com/vi/' + yt + '/hqdefault.jpg" alt="" loading="lazy" decoding="async" width="480" height="360">' +
        '<span class="rc-video-play-icon" aria-hidden="true"></span>' +
        '<span class="rc-video-caption">' + esc(meta.videoTitle) + '</span></button></div>' +
        '<p class="rc-video-alt"><a href="' + watch + '" target="_blank" rel="noopener">Watch on YouTube</a></p>';
      el.querySelector('.rc-video-play').addEventListener('click', function () {
        var f = el.querySelector('.rc-video-frame');
        f.classList.remove('rc-video-facade');
        f.innerHTML = '<iframe src="' + esc(src) + '&autoplay=1" title="' + esc(meta.videoTitle) + ' (video)" loading="lazy" allow="' + allow +
          '" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>';
        var ifr = f.querySelector('iframe'); if (ifr) ifr.focus();
      });
      return;
    }
    if (src) {
      el.innerHTML = '<div class="rc-video-frame"><iframe src="' + esc(src) + '" title="' + esc(meta.videoTitle) +
        ' (video)" loading="lazy" allow="' + allow + '" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>';
      return;
    }
    if (meta.videoUrl && window.console) console.warn('Retirement Confidence: videoUrl is not a recognised YouTube or Vimeo link; showing the coming-soon panel.');
    el.innerHTML = '<div class="rc-video-soon" role="note" aria-label="Video coming soon">' +
      '<span class="rc-soon-badge">Video coming soon</span>' +
      '<strong>' + esc(meta.videoTitle) + '</strong>' +
      '<p>' + esc(meta.videoComingSoon) + ' In the meantime, the three layers and seven principles below cover the same ideas in writing.</p></div>';
  }

  /* ---- Hub: seven principle cards ---- */
  var ICONS = {"savings": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><ellipse cx=\"12\" cy=\"6\" rx=\"7\" ry=\"2.6\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\"/><path d=\"M5 6v4c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V6M5 10v4c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6v-4M5 14v4c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6v-4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\"/></svg>", "runway": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M12 3l7 3v5.5c0 4.4-3 8-7 9.5-4-1.5-7-5.1-7-9.5V6l7-3z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linejoin=\"round\"/><path d=\"M8.8 12.2l2.2 2.2 4.4-4.6\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>", "tax": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M4 20h16\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\"/><rect x=\"5.5\" y=\"12\" width=\"3\" height=\"6\" rx=\".6\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\"/><rect x=\"10.5\" y=\"8\" width=\"3\" height=\"10\" rx=\".6\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\"/><rect x=\"15.5\" y=\"4.5\" width=\"3\" height=\"13.5\" rx=\".6\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\"/></svg>"};
  function photo(data, key) { return (data.meta.photos || {})[key] || null; }

  function renderCards(el, data) {
    el.innerHTML = '<div class="rc-cards">' + data.articles.map(function (a) {
      var p = photo(data, a.heroPhoto) || { card: a.image, cardWidth: 720, cardHeight: 480 };
      return '<article class="rc-card"><a class="rc-card-art" href="' + esc(a.url) + '" tabindex="-1" aria-hidden="true">' +
        '<img src="' + esc(p.card) + '" alt="" width="' + p.cardWidth + '" height="' + p.cardHeight + '" loading="lazy" decoding="async"></a>' +
        '<span class="rc-card-badge" aria-hidden="true">' + esc(a.num) + '</span><div class="rc-card-body">' +
        '<span class="rc-card-principle">Principle ' + esc(a.num) + ' · ' + esc(a.principle) + '</span><h3>' + esc(a.title) + '</h3><p>' + esc(a.desc) + '</p>' +
        '<a class="rc-card-link" href="' + esc(a.url) + '">Explore this principle<span class="rc-sr">: ' + esc(a.principle) + '</span> <span aria-hidden="true">&rarr;</span></a></div></article>';
    }).join('') + '</div>';
  }

  /* ---- Hub: Where should you start? ---- */
  function renderStart(el, data) {
    var map = bySlug(data);
    el.innerHTML = '<div class="rc-start">' + data.startHere.map(function (s) {
      return '<div class="rc-start-item rc-start-' + esc(s.icon) + '"><span class="rc-start-icon">' + (ICONS[s.icon] || '') + '</span><div><q>' + esc(s.worry) + '</q><ul>' + s.links.map(function (slug) {
        var a = map[slug];
        return a ? '<li><a href="' + esc(a.url) + '">Principle ' + esc(a.num) + ': ' + esc(a.principle) + ' <span aria-hidden="true">&rarr;</span></a></li>' : '';
      }).join('') + '</ul></div></div>';
    }).join('') + '</div>';
  }

  /* ---- Photo credits for the photos used on this page (data-photos="key,key") ---- */
  function renderCredits(el, data) {
    var keys = (el.getAttribute('data-photos') || '').split(',').filter(function (k, i, arr) { return k && arr.indexOf(k) === i && photo(data, k); });
    if (!keys.length) return;
    el.innerHTML = '<p class="rc-photo-credits">Photos: ' + keys.map(function (k) {
      var p = photo(data, k);
      return '<a href="' + esc(p.sourceUrl) + '" rel="noopener" target="_blank">' + esc(p.photographer) + '</a>';
    }).join('; ') + ' on Unsplash, used under the <a href="https://unsplash.com/license" rel="noopener" target="_blank">Unsplash License</a>.</p>';
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

  /* ---- Happy Retirement blog page: featured series cards (Tailwind classes, matches that page) ---- */
  function renderBlogSeries(el, data) {
    var m = data.meta;
    el.innerHTML = '<div class="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6"><div>' +
      '<div class="text-sm font-semibold text-emerald-700 uppercase tracking-wider mb-2">Featured series</div>' +
      '<h2 id="rc-series-h" class="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">The 7 Principles of Retirement Confidence</h2>' +
      '<p class="text-slate-600 text-sm sm:text-base mt-2 max-w-2xl">A seven-part guide to the retirement decisions you can control: savings, Social Security, healthcare, taxes and withdrawals. Start with the overview, or jump to the principle that fits your question.</p></div>' +
      '<a href="' + esc(m.hubUrl) + '" class="shrink-0 inline-flex items-center text-sm font-bold text-white bg-slate-900 hover:bg-emerald-700 px-4 py-2 rounded-sm">Start with the series overview &rarr;</a></div>' +
      '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">' + data.articles.map(function (a) {
        return '<a href="' + esc(a.url) + '" class="group block bg-white border border-slate-200 rounded-sm overflow-hidden hover:border-emerald-400">' +
          '<img src="' + esc((photo(data, a.heroPhoto) || {}).card || a.image) + '" alt="" width="720" height="480" loading="lazy" class="w-full aspect-[3/2] object-cover bg-slate-100">' +
          '<div class="p-4"><div class="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Principle ' + esc(a.num) + ' · ' + esc(a.principle) + '</div>' +
          '<h3 class="text-base font-bold text-slate-900 leading-snug group-hover:text-emerald-700">' + esc(a.title) + '</h3></div></a>';
      }).join('') + '</div>';
  }

  /* ---- Article: links into the Retirement Lab (series.json toolLinks) ---- */
  function renderTools(el, data, slug) {
    var a = bySlug(data)[slug];
    if (!a || !a.toolLinks || !a.toolLinks.length) return;
    el.innerHTML = '<h2 id="put-to-work">Put this principle to work</h2><p>These WealthLanding tools and guides from the <a href="' + esc(data.meta.retirementUrl || '/retirement/') + '">Retirement Lab</a> help you apply this principle to your own numbers.</p><ul>' +
      a.toolLinks.map(function (t) { return '<li><a href="' + esc(t.url) + '">' + esc(t.label) + '</a><span>' + esc(t.why) + '</span></li>'; }).join('') + '</ul>';
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
    'video': renderVideo, 'tools': renderTools, 'blog-series': renderBlogSeries, 'photo-credits': renderCredits, 'principle-cards': renderCards, 'start-here': renderStart,
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
