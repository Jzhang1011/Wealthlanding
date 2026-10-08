/* WealthLanding blog share bar.
   Include on every blog post before </body>:
     <script src="/blogs/share.js" defer></script>
   The bar injects itself right under the article title (first h1),
   with X / Facebook / LinkedIn / Email / Copy-link actions.
   Self-contained: no Tailwind, no Font Awesome, no external requests. */
(function () {
  var CSS = [
    '#wl-sharebar{display:flex;align-items:center;gap:8px;margin:16px 0 4px;flex-wrap:wrap}',
    '#wl-sharebar .wl-share-label{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#64748b;margin-right:2px}',
    '#wl-sharebar a,#wl-sharebar button{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9999px;background:rgba(241,245,249,.92);border:1px solid #e2e8f0;cursor:pointer;padding:0;transition:transform .15s ease,background .15s ease}',
    '#wl-sharebar a:hover,#wl-sharebar button:hover{background:#e2e8f0;transform:translateY(-1px)}',
    '#wl-sharebar svg{width:16px;height:16px;fill:#334155;display:block}',
    '#wl-sharebar .wl-copied{font-size:11px;font-weight:700;color:#15803d;display:none;margin-left:2px}',
    '#wl-sharebar.wl-done .wl-copied{display:inline}'
  ].join('');

  var ICONS = {
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.451-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644z"/></svg>',
    fb: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>',
    li: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>',
    link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>'
  };

  function init() {
    if (document.getElementById('wl-sharebar')) return;

    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var pageUrl = encodeURIComponent(location.href.split('#')[0]);
    var pageTitle = encodeURIComponent(document.title.replace(/\s*[|–—-]\s*Wealthlanding.*$/i, '').trim());

    var bar = document.createElement('div');
    bar.id = 'wl-sharebar';
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Share this article');
    bar.innerHTML =
      '<span class="wl-share-label">Share</span>' +
      '<a href="https://twitter.com/intent/tweet?text=' + pageTitle + '&url=' + pageUrl + '" target="_blank" rel="noopener" aria-label="Share on X" data-wlshare>' + ICONS.x + '</a>' +
      '<a href="https://www.facebook.com/sharer/sharer.php?u=' + pageUrl + '" target="_blank" rel="noopener" aria-label="Share on Facebook" data-wlshare>' + ICONS.fb + '</a>' +
      '<a href="https://www.linkedin.com/sharing/share-offsite/?url=' + pageUrl + '" target="_blank" rel="noopener" aria-label="Share on LinkedIn" data-wlshare>' + ICONS.li + '</a>' +
      '<a href="mailto:?subject=' + pageTitle + '&body=' + pageTitle + '%0A' + pageUrl + '" aria-label="Share by email">' + ICONS.mail + '</a>' +
      '<button type="button" aria-label="Copy link" id="wl-copylink">' + ICONS.link + '</button>' +
      '<span class="wl-copied">Copied!</span>';

    bar.querySelectorAll('[data-wlshare]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        window.open(a.href, 'wlshare', 'width=600,height=540,menubar=no,toolbar=no');
      });
    });

    bar.querySelector('#wl-copylink').addEventListener('click', function () {
      var done = function () {
        bar.classList.add('wl-done');
        setTimeout(function () { bar.classList.remove('wl-done'); }, 1800);
      };
      var url = location.href.split('#')[0];
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done, done);
      } else {
        var ta = document.createElement('textarea');
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (err) {}
        document.body.removeChild(ta);
        done();
      }
    });

    var h1 = document.querySelector('main h1, article h1, h1');
    if (h1) {
      h1.parentNode.insertBefore(bar, h1.nextSibling);
    } else {
      var host = document.querySelector('article, main');
      if (host) host.insertBefore(bar, host.firstChild);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
