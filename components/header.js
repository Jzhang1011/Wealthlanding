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
  }

  function renderHeader() {
    fetch('/components/header-nav.html', { credentials: 'same-origin' })
      .then(function(r) {
        if (!r.ok) throw new Error('header-nav missing');
        return r.text();
      })
      .then(mount)
      .catch(function() {
        mount(
          '<header class="wl-header-root"><div class="wl-header-container"><div class="wl-header-inner">' +
          '<a href="/" class="wl-brand-link"><span class="wl-brand-text">Wealth<span class="wl-brand-accent">Landing</span></span></a>' +
          '<nav><ul class="wl-nav-list">' +
          '<li class="wl-nav-item"><a class="wl-nav-link-direct" href="/learn/">Learn</a></li>' +
          '<li class="wl-nav-item"><a class="wl-nav-link-direct" href="/tools/">Tools</a></li>' +
          '<li class="wl-nav-item"><a class="wl-nav-link-direct" href="/retirement/">Retirement</a></li>' +
          '<li class="wl-nav-item"><a class="wl-nav-link-direct" href="/blogs/">Blog</a></li>' +
          '</ul></nav></div></div></header>'
        );
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderHeader);
  } else {
    renderHeader();
  }
})();
