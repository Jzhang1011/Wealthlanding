/* WealthLanding click-to-play YouTube facade (shared).
   Nothing loads from YouTube until the visitor presses play; then a youtube-nocookie iframe replaces the thumbnail.

   Declarative use (static pages):
     <div data-yt-facade data-yt-id="VIDEO_ID" data-yt-title="Video title">
       <a href="https://www.youtube.com/watch?v=VIDEO_ID">Watch on YouTube</a>   <!-- no-JS fallback -->
     </div>
     <link rel="stylesheet" href="/components/video/yt-facade.css">
     <script src="/components/video/yt-facade.js" defer></script>

   Programmatic use: WLYouTube.facade(el, { id, title, prefix }) where prefix (default "wl-yt") names the classes
   (prefix-frame, prefix-facade, prefix-play, prefix-play-icon, prefix-caption, prefix-alt), so a page can keep its own styles.
   WLYouTube.id(url) extracts an id from youtu.be, youtube.com/watch, /embed, /shorts or /live URLs. */
(function () {
  'use strict';
  if (window.WLYouTube) return;
  var ID_RE = /^[A-Za-z0-9_-]{6,20}$/;
  var ALLOW = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function idFrom(url) {
    if (!url) return null;
    if (ID_RE.test(url)) return url;
    try {
      var u = new URL(url, window.location.origin), m = null;
      var host = u.hostname.replace(/^www\./, '').replace(/^m\./, '');
      if (host === 'youtu.be') m = u.pathname.slice(1);
      else if (/(^|\.)youtube(-nocookie)?\.com$/.test(host)) {
        if (u.searchParams.get('v')) m = u.searchParams.get('v');
        else { var p = u.pathname.match(/\/(embed|shorts|live)\/([^/?#]+)/); if (p) m = p[2]; }
      }
      return m && ID_RE.test(m) ? m : null;
    } catch (e) { return null; }
  }
  function embedSrc(id) {
    return 'https://www.youtube-nocookie.com/embed/' + id + '?cc_load_policy=1&rel=0&modestbranding=1';
  }
  function facade(el, opts) {
    var id = idFrom(opts && opts.id), title = (opts && opts.title) || 'Video', px = (opts && opts.prefix) || 'wl-yt';
    if (!el || !id) return false;
    var watch = 'https://www.youtube.com/watch?v=' + id;
    el.innerHTML = '<div class="' + px + '-frame ' + px + '-facade">' +
      '<button type="button" class="' + px + '-play" aria-label="Play video: ' + esc(title) + '">' +
      '<img src="https://i.ytimg.com/vi/' + id + '/hqdefault.jpg" alt="" loading="lazy" decoding="async" width="480" height="360">' +
      '<span class="' + px + '-play-icon" aria-hidden="true"></span>' +
      '<span class="' + px + '-caption">' + esc(title) + '</span></button></div>' +
      '<p class="' + px + '-alt"><a href="' + watch + '" target="_blank" rel="noopener">Watch on YouTube</a></p>';
    el.querySelector('.' + px + '-play').addEventListener('click', function () {
      var f = el.querySelector('.' + px + '-frame');
      f.classList.remove(px + '-facade');
      f.innerHTML = '<iframe src="' + embedSrc(id) + '&autoplay=1" title="' + esc(title) + ' (video)" loading="lazy" allow="' + ALLOW +
        '" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>';
      var ifr = f.querySelector('iframe'); if (ifr) ifr.focus();
    });
    el.setAttribute('data-yt-ready', '1');
    return true;
  }
  function init() {
    var nodes = document.querySelectorAll('[data-yt-facade]:not([data-yt-ready])');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      facade(n, { id: n.getAttribute('data-yt-id'), title: n.getAttribute('data-yt-title'), prefix: n.getAttribute('data-yt-prefix') || undefined });
    }
  }
  window.WLYouTube = { facade: facade, id: idFrom, embedSrc: embedSrc, init: init };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
