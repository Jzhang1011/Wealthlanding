/**
 * WealthLanding shared monetization toolkit.
 * Mount: <div data-wl-monetize data-city="Bangkok"></div>
 * Config: /components/monetization/offers.json
 */
(function () {
  'use strict';

  var CONFIG_URL = '/components/monetization/offers.json';
  var CSS_URL = '/components/monetization/monetize.css';

  function slugify(city) {
    return String(city || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function applyTokens(text, city) {
    return String(text || '').replace(/\{city\}/g, city || '');
  }

  function mergeOffer(base, city, config) {
    var overrides = (config.cityOverrides && config.cityOverrides[city]) || {};
    var cityOver = overrides[base.id] || {};
    var out = {};
    for (var k in base) if (Object.prototype.hasOwnProperty.call(base, k)) out[k] = base[k];
    for (var k2 in cityOver) if (Object.prototype.hasOwnProperty.call(cityOver, k2)) out[k2] = cityOver[k2];
    out.heading = applyTokens(out.heading, city);
    out.text = applyTokens(out.text, city);
    return out;
  }

  function ensureCss() {
    if (document.getElementById('wl-monetize-css')) return;
    var link = document.createElement('link');
    link.id = 'wl-monetize-css';
    link.rel = 'stylesheet';
    link.href = CSS_URL;
    document.head.appendChild(link);
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        if (key === 'className') node.className = attrs[key];
        else if (key === 'text') node.textContent = attrs[key];
        else if (key === 'html') node.innerHTML = attrs[key];
        else if (attrs[key] != null) node.setAttribute(key, attrs[key]);
      });
    }
    (children || []).forEach(function (c) {
      if (c == null) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function setMsg(host, text, ok) {
    var msg = host.querySelector('.wl-msg');
    if (!msg) {
      msg = el('div', { className: 'wl-msg' });
      host.appendChild(msg);
    }
    msg.textContent = text || '';
    msg.className = 'wl-msg ' + (ok ? 'ok' : 'err');
  }

  // Public API host: the Cloudflare worker serving /api/* (same-origin /api/*
  // on www.wealthlanding.com is served by the static host and 405s, so the
  // client talks to the worker's custom domain instead).
  var API_BASE = 'https://api.wealthlanding.com';

  function beaconInterest(payload) {
    try {
      var body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          API_BASE + '/api/interest',
          new Blob([body], { type: 'application/json' })
        );
      } else {
        fetch(API_BASE + '/api/interest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: body,
          keepalive: true
        }).catch(function () {});
      }
    } catch (e) {
      /* tracking must never break UX */
    }
  }

  // Subscriptions go through our worker (POST https://api.wealthlanding.com/api/subscribe),
  // which relays to the Kit API server-side. If the worker fails, fall back to a
  // form POST to the public Kit form action (offers.json kitFormAction / form 9874203).
  var KIT_FORM_ACTION = 'https://app.kit.com/forms/9874203/subscriptions';

  function fallbackToKitForm(config, fields) {
    var action = (config && config.kitFormAction) || KIT_FORM_ACTION;
    var body = new URLSearchParams();
    body.set('email_address', fields.email);
    if (fields.first_name) body.set('first_name', fields.first_name);
    return fetch(action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: body.toString(),
      mode: 'cors',
      credentials: 'omit',
      redirect: 'follow'
    }).then(function (res) {
      if (res.ok || (res.status >= 300 && res.status < 400)) return { ok: true };
      return { ok: false, error: 'Could not subscribe. Please try again.' };
    }).catch(function () {
      return { ok: false, error: 'Could not subscribe. Please check your connection and try again.' };
    });
  }

  function submitToKit(config, fields) {
    return fetch(API_BASE + '/api/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        email: fields.email,
        first_name: fields.first_name || '',
        city: fields.city || '',
        interest: fields.interest || '',
        topic: fields.topic || '',
        source: fields.source || 'city-monetize'
      })
    }).then(function (res) {
      return res
        .json()
        .catch(function () {
          return {};
        })
        .then(function (data) {
          if (res.ok && data && data.ok) return { ok: true };
          if (data && data.error === 'invalid_email') {
            return { ok: false, error: 'Please enter a valid email.' };
          }
          return fallbackToKitForm(config, fields);
        });
    }).catch(function () {
      return fallbackToKitForm(config, fields);
    });
  }

  function renderLeadCapture(offer, city, config) {
    var box = el('div', { className: 'leadbox', 'data-offer': offer.id });
    box.appendChild(el('h3', { text: offer.heading }));
    box.appendChild(el('p', { text: offer.text }));

    var email = el('input', {
      type: 'email',
      name: 'email',
      placeholder: 'Email address',
      required: 'required',
      'aria-label': 'Email address',
      autocomplete: 'email'
    });
    var btn = el('button', { type: 'button', text: offer.buttonLabel || 'Get it' });
    var actions = el('div', { className: 'wl-actions' }, [btn]);

    box.appendChild(email);
    box.appendChild(actions);

    btn.addEventListener('click', function () {
      var value = (email.value || '').trim();
      if (!value || value.indexOf('@') < 1) {
        setMsg(box, 'Please enter a valid email.', false);
        return;
      }
      btn.disabled = true;
      setMsg(box, 'Sending…', true);
      beaconInterest({
        offer: offer.id,
        city: city,
        interest: offer.interest,
        action: 'submit'
      });
      submitToKit(config, {
        email: value,
        city: city,
        interest: offer.interest,
        source: 'city-lead:' + slugify(city)
      })
        .then(function (result) {
          if (result.ok) {
            setMsg(box, 'Thanks — check your inbox shortly.', true);
            email.value = '';
          } else {
            setMsg(box, result.error || 'Could not subscribe. Please try again.', false);
          }
        })
        .catch(function () {
          // Never claim success when the request failed.
          setMsg(box, 'Could not subscribe. Please check your connection and try again.', false);
        })
        .finally(function () {
          btn.disabled = false;
        });
    });

    return box;
  }

  function renderOutbound(offer, city, config) {
    var hasDest = !!(offer.destination && String(offer.destination).trim());
    if (!hasDest) {
      // No live partner URL: omit the box rather than show a stub.
      return null;
    }
    var box = el('div', { className: 'ad', 'data-offer': offer.id });
    if (offer.label) box.appendChild(el('div', { className: 'label', text: offer.label }));
    box.appendChild(el('h3', { text: offer.heading }));
    box.appendChild(el('p', { text: offer.text }));

    var actions = el('div', { className: 'wl-actions' });
    var href =
      '/go/' +
      encodeURIComponent(offer.id) +
      '?city=' +
      encodeURIComponent(slugify(city));
    var link = el('a', {
      className: 'btn primary',
      href: href,
      rel: 'noopener sponsored',
      text: offer.buttonLabel || 'Learn more'
    });
    link.addEventListener('click', function () {
      beaconInterest({
        offer: offer.id,
        city: city,
        interest: offer.interest,
        action: 'click'
      });
    });
    actions.appendChild(link);
    box.appendChild(actions);
    return box;
  }

  function renderReferral(offer, city, config) {
    var box = el('div', { className: 'ad', 'data-offer': offer.id });
    if (offer.label) box.appendChild(el('div', { className: 'label', text: offer.label }));
    box.appendChild(el('h3', { text: offer.heading }));
    box.appendChild(el('p', { text: offer.text }));

    var name = el('input', {
      type: 'text',
      placeholder: 'Your name',
      'aria-label': 'Your name',
      autocomplete: 'name'
    });
    var email = el('input', {
      type: 'email',
      placeholder: 'Email address',
      'aria-label': 'Email address',
      autocomplete: 'email'
    });
    var select = el('select', { 'aria-label': 'Topic' });
    select.appendChild(el('option', { value: '', text: 'Select a topic' }));
    (offer.topics || []).forEach(function (t) {
      select.appendChild(el('option', { value: t, text: t }));
    });

    box.appendChild(el('div', { className: 'wl-field' }, [name]));
    box.appendChild(el('div', { className: 'wl-field' }, [email]));
    box.appendChild(el('div', { className: 'wl-field' }, [select]));

    var btn = el('button', {
      type: 'button',
      className: 'btn primary',
      text: offer.buttonLabel || 'Request a referral'
    });
    box.appendChild(el('div', { className: 'wl-actions' }, [btn]));

    btn.addEventListener('click', function () {
      var n = (name.value || '').trim();
      var e = (email.value || '').trim();
      var topic = select.value || '';
      if (!n) {
        setMsg(box, 'Please enter your name.', false);
        return;
      }
      if (!e || e.indexOf('@') < 1) {
        setMsg(box, 'Please enter a valid email.', false);
        return;
      }
      if (!topic) {
        setMsg(box, 'Please select a topic.', false);
        return;
      }
      btn.disabled = true;
      setMsg(box, 'Sending…', true);
      beaconInterest({
        offer: offer.id,
        city: city,
        interest: offer.interest,
        topic: topic,
        action: 'referral'
      });
      submitToKit(config, {
        email: e,
        first_name: n,
        city: city,
        interest: offer.interest,
        topic: topic,
        source: 'city-referral:' + slugify(city)
      })
        .then(function (result) {
          if (result.ok) {
            setMsg(box, 'Request received — we will follow up by email.', true);
            name.value = '';
            email.value = '';
            select.value = '';
          } else {
            setMsg(box, result.error || 'Could not send request.', false);
          }
        })
        .catch(function () {
          // Never claim the request was received when it actually failed.
          setMsg(box, 'Could not send your request. Please check your connection and try again.', false);
        })
        .finally(function () {
          btn.disabled = false;
        });
    });

    return box;
  }

  function renderMount(mount, config) {
    var city = (mount.getAttribute('data-city') || '').trim();
    if (!city) {
      mount.textContent = '';
      return;
    }
    mount.classList.add('wl-monetize');
    mount.innerHTML = '';

    (config.offers || []).forEach(function (raw) {
      if (!raw || raw.enabled === false) return;
      var offer = mergeOffer(raw, city, config);
      var node;
      if (offer.type === 'lead-capture') node = renderLeadCapture(offer, city, config);
      else if (offer.type === 'outbound') node = renderOutbound(offer, city, config);
      else if (offer.type === 'referral-request') node = renderReferral(offer, city, config);
      if (node) mount.appendChild(node);
    });

    if (config.disclosure) {
      mount.appendChild(el('p', { className: 'wl-disclosure', text: config.disclosure }));
    }
  }

  function init(config) {
    ensureCss();
    var mounts = document.querySelectorAll('[data-wl-monetize]');
    mounts.forEach(function (m) {
      try {
        renderMount(m, config);
      } catch (err) {
        console.warn('[wl-monetize] render failed', err);
      }
    });
  }

  function boot() {
    fetch(CONFIG_URL, { credentials: 'same-origin' })
      .then(function (r) {
        if (!r.ok) throw new Error('offers.json HTTP ' + r.status);
        return r.json();
      })
      .then(init)
      .catch(function (err) {
        console.warn('[wl-monetize] config load failed', err);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

/* City summary box: on overseas city deep dives (/Retirement-simulator/cities/<slug>.html),
 * load the shared renderer. Content lives in /components/city-summary/cities.json. */
(function () {
  try {
    var path = (window.location && window.location.pathname) || '';
    var at = path.indexOf('/Retirement-simulator/cities/');
    if (at === -1 || document.getElementById('wl-city-summary-js')) return;
    var s = document.createElement('script');
    s.id = 'wl-city-summary-js';
    s.src = path.slice(0, at) + '/components/city-summary/city-summary.js';
    s.async = true;
    document.head.appendChild(s);
  } catch (e) { /* never break the page */ }
})();
