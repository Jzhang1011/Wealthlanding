/**
 * WealthLanding Worker: static assets + monetization click / interest tracking.
 *
 * Routes:
 *   GET  /go/:offerId?city=...  → 302 to offer destination (or soft fallback)
 *   POST /api/interest          → log anonymous interest beacon
 *   POST /api/subscribe         → relay newsletter/referral signup to Kit API v4
 *   everything else             → env.ASSETS
 *
 * Analytics Engine binding: INTEREST (dataset wl_interest)
 * Dataset must exist in the Cloudflare dashboard (Workers > Analytics Engine).
 * If the binding is missing, tracking no-ops and redirects still work when a
 * destination URL is present in offers.json.
 *
 * Secret: KIT_API_KEY (Kit v4 API key, Settings → Developers in Kit).
 * Set via `wrangler secret put KIT_API_KEY` or the Cloudflare dashboard
 * (Worker → Settings → Variables → Secrets). Subscriptions are relayed
 * server-side because direct browser → app.kit.com POSTs are blocked by
 * ad/tracker blockers for a large share of visitors.
 */

const OFFERS_PATH = '/components/monetization/offers.json';

function json(data, status, extraHeaders) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign(
      {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store'
      },
      extraHeaders || {}
    )
  });
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  // Same-origin toolkits only need a permissive echo for sendBeacon edge cases.
  const allow = origin || '*';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin'
  };
}

async function loadOffers(env, request) {
  try {
    const url = new URL(OFFERS_PATH, request.url);
    const res = await env.ASSETS.fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function findOffer(config, offerId) {
  if (!config || !Array.isArray(config.offers)) return null;
  return config.offers.find((o) => o && o.id === offerId) || null;
}

function writeInterest(env, row) {
  try {
    if (!env.INTEREST || typeof env.INTEREST.writeDataPoint !== 'function') return;
    // Analytics Engine free tier: indexes (strings), blobs (strings), doubles (numbers)
    env.INTEREST.writeDataPoint({
      indexes: [String(row.offer || ''), String(row.city || ''), String(row.action || '')],
      blobs: [
        String(row.interest || ''),
        String(row.topic || ''),
        String(row.referrer || ''),
        String(row.path || ''),
        String(row.destination || '')
      ],
      doubles: [Date.now()]
    });
  } catch {
    /* never fail the request because of telemetry */
  }
}

async function handleGo(request, env, offerId) {
  const url = new URL(request.url);
  const city = url.searchParams.get('city') || '';
  const config = await loadOffers(env, request);
  const offer = findOffer(config, offerId);
  const destination = offer && offer.destination ? String(offer.destination).trim() : '';

  writeInterest(env, {
    offer: offerId,
    city,
    action: 'click',
    interest: (offer && offer.interest) || '',
    referrer: request.headers.get('Referer') || '',
    path: url.pathname,
    destination
  });

  if (destination) {
    return Response.redirect(destination, 302);
  }

  // No partner URL yet — soft landing so bookmarks don't 404.
  const fallback = new URL('/Retirement-simulator/RetiringOverseas.html', request.url);
  fallback.searchParams.set('from', 'go');
  fallback.searchParams.set('offer', offerId);
  if (city) fallback.searchParams.set('city', city);
  return Response.redirect(fallback.toString(), 302);
}

async function handleInterest(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'method_not_allowed' }, 405, corsHeaders(request));
  }

  let payload = {};
  try {
    const ct = request.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      payload = await request.json();
    } else {
      const text = await request.text();
      payload = text ? JSON.parse(text) : {};
    }
  } catch {
    payload = {};
  }

  writeInterest(env, {
    offer: payload.offer || '',
    city: payload.city || '',
    action: payload.action || 'interest',
    interest: payload.interest || '',
    topic: payload.topic || '',
    referrer: request.headers.get('Referer') || '',
    path: payload.path || ''
  });

  return json({ ok: true }, 200, corsHeaders(request));
}

const KIT_API_BASE = 'https://api.kit.com/v4';

function kitFormId(config) {
  try {
    const m = String((config && config.kitFormAction) || '').match(/\/forms\/(\d+)\//);
    if (m) return m[1];
  } catch {
    /* fall through to default */
  }
  return '9874203';
}

function isValidEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

async function handleSubscribe(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'method_not_allowed' }, 405, corsHeaders(request));
  }
  if (!env.KIT_API_KEY) {
    return json({ ok: false, error: 'subscribe_unavailable' }, 503, corsHeaders(request));
  }

  let payload = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const email = String(payload.email || '').trim();
  if (!isValidEmail(email)) {
    return json({ ok: false, error: 'invalid_email' }, 400, corsHeaders(request));
  }
  const firstName = String(payload.first_name || payload.name || '').trim();
  const fields = {};
  for (const key of ['city', 'interest', 'topic', 'source']) {
    if (payload[key]) fields[key] = String(payload[key]).slice(0, 200);
  }

  const config = await loadOffers(env, request);
  const formId = kitFormId(config);
  const kitHeaders = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Kit-Api-Key': env.KIT_API_KEY
  };

  try {
    // 1. Upsert the subscriber with custom fields.
    const subscriberBody = { email_address: email, fields };
    if (firstName) subscriberBody.first_name = firstName;
    const upsert = await fetch(KIT_API_BASE + '/subscribers', {
      method: 'POST',
      headers: kitHeaders,
      body: JSON.stringify(subscriberBody)
    });
    if (!upsert.ok) {
      const detail = await upsert.text().catch(() => '');
      console.error('[wl-worker] kit subscriber upsert failed', upsert.status, detail.slice(0, 200));
      return json({ ok: false, error: 'subscribe_failed' }, 502, corsHeaders(request));
    }

    // 2. Add to the form (respects the form's double opt-in setting).
    const add = await fetch(KIT_API_BASE + '/forms/' + formId + '/subscribers', {
      method: 'POST',
      headers: kitHeaders,
      body: JSON.stringify({ email_address: email })
    });
    if (!add.ok) {
      const detail = await add.text().catch(() => '');
      console.error('[wl-worker] kit form subscribe failed', add.status, detail.slice(0, 200));
      return json({ ok: false, error: 'subscribe_failed' }, 502, corsHeaders(request));
    }

    writeInterest(env, {
      offer: 'subscribe',
      city: fields.city || '',
      action: 'subscribe',
      interest: fields.interest || '',
      topic: fields.topic || '',
      referrer: request.headers.get('Referer') || '',
      path: '/api/subscribe',
      destination: ''
    });

    return json({ ok: true }, 200, corsHeaders(request));
  } catch (err) {
    console.error('[wl-worker] subscribe error', err);
    return json({ ok: false, error: 'subscribe_failed' }, 502, corsHeaders(request));
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    try {
      if (pathname === '/api/interest' || pathname === '/api/interest/') {
        return await handleInterest(request, env);
      }

      if (pathname === '/api/subscribe' || pathname === '/api/subscribe/') {
        return await handleSubscribe(request, env);
      }

      const goMatch = pathname.match(/^\/go\/([^/]+)\/?$/);
      if (goMatch) {
        return await handleGo(request, env, decodeURIComponent(goMatch[1]));
      }
    } catch (err) {
      // Fall through to assets on unexpected handler errors.
      console.error('[wl-worker]', err);
    }

    if (!env.ASSETS || typeof env.ASSETS.fetch !== 'function') {
      return new Response('Assets binding missing', { status: 500 });
    }
    return env.ASSETS.fetch(request);
  }
};
