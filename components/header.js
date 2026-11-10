(function() {
  const head = document.head || document.getElementsByTagName('head')[0];

  if (!document.querySelector('link[href*="font-awesome"]')) {
    const fa = document.createElement('link');
    fa.rel = 'stylesheet';
    fa.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
    head.appendChild(fa);
  }

  if (!document.querySelector('link[data-wl-header-css]')) {
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = '/components/header.css';
    cssLink.setAttribute('data-wl-header-css', '1');
    head.appendChild(cssLink);
  }

  function wireHeader(root) {
    const mobileBtn = root.querySelector('#wlMobileMenuBtn');
    const closeBtn = root.querySelector('#wlCloseMobileDrawerBtn');
    const drawer = root.querySelector('#wlMobileDrawer');

    if (mobileBtn && drawer) {
      mobileBtn.addEventListener('click', function() {
        drawer.classList.add('js-open');
      });
    }
    if (drawer) {
      drawer.querySelectorAll('a').forEach(function(a) {
        a.addEventListener('click', function() { drawer.classList.remove('js-open'); });
      });
    }
    if (closeBtn && drawer) {
      closeBtn.addEventListener('click', function() {
        drawer.classList.remove('js-open');
      });
    }

    root.querySelectorAll('.wl-nav-item > .wl-nav-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        const megaMenu = this.nextElementSibling;
        if (!megaMenu) return;
        const isVisible = megaMenu.classList.contains('js-visible');
        root.querySelectorAll('.wl-nav-mega').forEach(function(menu) {
          menu.classList.remove('js-visible');
        });
        if (!isVisible) megaMenu.classList.add('js-visible');
      });
    });

    document.addEventListener('click', function(e) {
      if (!e.target.closest('.wl-nav-item')) {
        root.querySelectorAll('.wl-nav-mega').forEach(function(menu) {
          menu.classList.remove('js-visible');
        });
      }
    });
  }

  function loadSearch(root) {
    function start() {
      if (window.WLSearch) window.WLSearch.mount(root);
    }
    if (window.WLSearch) {
      start();
      return;
    }
    var existing = document.querySelector('script[data-wl-search-js]');
    if (existing) {
      if (existing.getAttribute('data-loaded') === '1') start();
      else existing.addEventListener('load', start);
      return;
    }
    var script = document.createElement('script');
    script.src = '/components/search.js';
    script.setAttribute('data-wl-search-js', '1');
    script.onload = function() {
      script.setAttribute('data-loaded', '1');
      start();
    };
    (document.head || document.body).appendChild(script);
  }

  function mount(html) {
    let target = document.getElementById('global-header-target');
    if (!target) {
      target = document.createElement('div');
      target.id = 'global-header-target';
      if (document.body.firstChild) {
        document.body.insertBefore(target, document.body.firstChild);
      } else {
        document.body.appendChild(target);
      }
    }
    target.style.position = 'relative';
    target.style.zIndex = '999999';
    target.style.overflow = 'visible';
    target.innerHTML = html;
    wireHeader(target);
    loadSearch(target);
  }

  function renderHeader() {
    fetch('/components/header-nav.html', { credentials: 'same-origin' })
      .then(function(r) {
        if (!r.ok) throw new Error('header-nav missing');
        return r.text();
      })
      .then(mount)
      .catch(function() {
        /* wl:nav-fallback:start */
        var WL_NAV_FALLBACK = "<li class=\"wl-nav-item\"><a class=\"wl-nav-link-direct\" href=\"/retirement/\">Retirement</a></li><li class=\"wl-nav-item\"><a class=\"wl-nav-link-direct\" href=\"/investment/\">Investing</a></li><li class=\"wl-nav-item\"><a class=\"wl-nav-link-direct\" href=\"/money/\">Money &amp; Lifestyle</a></li><li class=\"wl-nav-item\"><a class=\"wl-nav-link-direct\" href=\"/real-estate/\">Real Estate</a></li><li class=\"wl-nav-item\"><a class=\"wl-nav-link-direct\" href=\"/tools/\">Tools</a></li><li class=\"wl-nav-item\"><a class=\"wl-nav-link-direct\" href=\"/blogs/\">Blogs</a></li>";
        /* wl:nav-fallback:end */
        /* wl:search-markup:start */
        var WL_SEARCH_TOOLS = "<div class=\"wl-header-tools\">\n<div class=\"wl-search\" data-wl-search>\n <form class=\"wl-search-form\" action=\"/search/\" method=\"get\" role=\"search\">\n  <label class=\"wl-sr-only\" for=\"wlSearchInput-nav\">Search WealthLanding</label>\n  <input id=\"wlSearchInput-nav\" class=\"wl-search-input\" type=\"search\" name=\"q\" placeholder=\"Search\" autocomplete=\"off\" aria-autocomplete=\"list\" aria-controls=\"wlSearchResults-nav\" aria-expanded=\"false\" enterkeyhint=\"search\">\n  <button class=\"wl-search-submit\" type=\"submit\" aria-label=\"Submit search\"><i class=\"fa-solid fa-magnifying-glass\" aria-hidden=\"true\"></i></button>\n </form>\n <div id=\"wlSearchResults-nav\" class=\"wl-search-results\" hidden role=\"listbox\" aria-label=\"Search suggestions\"></div>\n</div>\n<button type=\"button\" class=\"wl-search-toggle\" id=\"wlSearchToggle\" aria-label=\"Open search\" aria-expanded=\"false\" aria-controls=\"wlSearchInput-nav\"><i class=\"fa-solid fa-magnifying-glass\" aria-hidden=\"true\"></i></button>\n<button id=\"wlMobileMenuBtn\" class=\"wl-mobile-toggle\" aria-label=\"Open menu\">\n <i class=\"fa-solid fa-bars\"></i>\n </button>\n</div>";
        /* wl:search-markup:end */
        mount(
          '<header class="wl-header-root"><div class="wl-header-container"><div class="wl-header-inner">' +
          '<a href="/" class="wl-brand-link"><img class="wl-brand-logo" src="/favicon.svg" alt="" width="40" height="40"><span class="wl-brand-text">Wealth<span class="wl-brand-accent">Landing</span></span></a>' +
          '<nav aria-label="Main"><ul class="wl-nav-list">' + WL_NAV_FALLBACK + '</ul></nav>' +
          WL_SEARCH_TOOLS +
          '</div></div></header>'
        );
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderHeader);
  } else {
    renderHeader();
  }
})();
