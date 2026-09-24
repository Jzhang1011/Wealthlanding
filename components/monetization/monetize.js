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

  function beaconInterest(payload) {
    try {
      var body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          '/api/interest',
          new Blob([body], { type: 'application/json' })
        );
      } else {
        fetch('/api/interest', {
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

  function submitToKit(config, fields) {
    var body = new URLSearchParams();
    body.set('email_address', fields.email);
    if (fields.first_name) body.set('first_name', fields.first_name);
    // Kit custom fields (create matching keys in Kit: city, interest, topic, source)
    body.set('fields[city]', fields.city || '');
    body.set('fields[interest]', fields.interest || '');
    if (fields.topic) body.set('fields[topic]', fields.topic);
    body.set('fields[source]', fields.source || 'city-monetize');

    return fetch(config.kitFormAction, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body: body.toString(),
      mode: 'cors'
    }).then(function (res) {
      // Kit often returns 200 JSON; some browsers see opaque failures on CORS
      if (res.ok || res.type === 'opaque') return { ok: true };
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (data && (data.subscription || data.status === 'success')) return { ok: true };
        var err =
          (data && (data.message || (data.errors && data.errors[0]))) ||
          'Something went wrong. Please try again.';
        return { ok: false, error: String(err) };
      });
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
          // CORS may block reading the response even when Kit accepted the POST.
          setMsg(box, 'Thanks — if that email is new, you are on the list.', true);
        })
        .finally(function () {
          btn.disabled = false;
        });
    });

    return box;
  }

  function renderOutbound(offer, city, config) {
    var box = el('div', { className: 'ad', 'data-offer': offer.id });
    if (offer.label) box.appendChild(el('div', { className: 'label', text: offer.label }));
    box.appendChild(el('h3', { text: offer.heading }));
    box.appendChild(el('p', { text: offer.text }));

    var hasDest = !!(offer.destination && String(offer.destination).trim());
    var actions = el('div', { className: 'wl-actions' });

    if (hasDest) {
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
    } else {
      var notifyBtn = el('button', {
        type: 'button',
        className: 'btn primary',
        text: 'Notify me when available'
      });
      actions.appendChild(notifyBtn);
      box.appendChild(actions);
      box.appendChild(
        el('p', {
          className: 'wl-coming-soon',
          text: 'Partner link coming soon — leave your email to get notified.'
        })
      );

      var notifyForm = el('div', { className: 'wl-notify-form', style: 'display:none' });
      var email = el('input', {
        type: 'email',
        placeholder: 'Email address',
        'aria-label': 'Email address',
        autocomplete: 'email'
      });
      var go = el('button', { type: 'button', text: 'Notify me' });
      notifyForm.appendChild(email);
      notifyForm.appendChild(el('div', { className: 'wl-actions' }, [go]));
      box.appendChild(notifyForm);

      notifyBtn.addEventListener('click', function () {
        notifyForm.style.display = 'block';
        notifyBtn.style.display = 'none';
        beaconInterest({
          offer: offer.id,
          city: city,
          interest: offer.interest,
          action: 'intent'
        });
      });

      go.addEventListener('click', function () {
        var value = (email.value || '').trim();
        if (!value || value.indexOf('@') < 1) {
          setMsg(notifyForm, 'Please enter a valid email.', false);
          return;
        }
        go.disabled = true;
        beaconInterest({
          offer: offer.id,
          city: city,
          interest: offer.interest,
          action: 'notify'
        });
        submitToKit(config, {
          email: value,
          city: city,
          interest: offer.interest,
          source: 'city-notify:' + slugify(city)
        })
          .then(function (result) {
            if (result.ok) {
              setMsg(notifyForm, 'You are on the notify list. Thank you.', true);
              email.value = '';
            } else {
              setMsg(notifyForm, result.error || 'Could not subscribe.', false);
            }
          })
          .catch(function () {
            setMsg(notifyForm, 'Thanks — we will notify you when this is ready.', true);
          })
          .finally(function () {
            go.disabled = false;
          });
      });
    }

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
          setMsg(box, 'Request received — we will follow up by email.', true);
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
